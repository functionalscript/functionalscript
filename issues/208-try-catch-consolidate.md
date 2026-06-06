# 208. `tryCatch`: consolidate three near-identical implementations

**Priority:** P3
**Status:** open

> **Update (post-#943):** `fs/io/module.ts` and `fs/io/module.f.ts` were merged
> into `fs/effects/node/module.ts` (the `fs/io` module is gone), so the copies
> this issue tracks now live in that single file (`tc`, `tryCatch`,
> `asyncTryCatch`) plus `fs/types/result`. Removing the unused `tryCatch` /
> `asyncTryCatch` members is also covered by
> [i664-drop-io-interface](./664-drop-io-interface.md); re-scope against the
> merged file. Paths below referencing `fs/io/...` now mean `fs/effects/node/module.ts`.

The same "wrap `f()` in `try/catch`, return `Result<T, unknown>`" helper is
written out in **three** places, plus an async sibling that is structurally
identical:

```ts
// fs/types/result/module.ts:3
const tryCatch
    : <T>(f: () => T) => Result<T, unknown>
    = f => {
        // Side effect: `try catch` is not allowed in FunctionalScript.
        try {
            return ok(f())
        } catch (e) {
            return error(e)
        }
    }
export default { tryCatch } as const
```

```ts
// fs/io/module.ts:71
export const tryCatch: <T>(f: () => T) => Result<T, unknown> = f => {
    try {
        return ok(f())
    } catch (e) {
        return error(e)
    }
}
```

```ts
// fs/io/module.f.ts:189
const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}
```

```ts
// fs/io/module.ts:88 — inlined in the `io` literal
asyncTryCatch: async f => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
},
```

All four bodies are byte-equivalent modulo `await` and the `Promise<...>`
return type. The same `ok`/`error` constructors are used; the same
`Result<T, unknown>` shape comes back; the same comment in
`types/result/module.ts` admits the side effect.

## Why three copies exist

- `fs/types/result/module.ts` exposes `tryCatch` as a side-effecting default
  export that FunctionalScript modules cannot use directly (no `try/catch` in
  `.f.ts`). It is **never imported** by anything else in the tree:

  ```
  $ grep -rn "from .*types/result/module.ts" fs   # zero hits
  ```

- `fs/io/module.ts` re-defines `tryCatch` because it is the one calling its
  own field at `io.tryCatch` (the `Io` interface in `fs/io/module.f.ts:155`
  requires it).

- `fs/io/module.f.ts` re-defines `tc` privately because the `fromIo` adapter
  needs an async try/catch internally and the `Io.asyncTryCatch` field
  routes through `io.asyncTryCatch` — but `fromIo` is a `.f.ts` module and
  cannot itself contain a `try/catch`, so it re-wraps every effect operation
  with the same async-tc shape.

The net result is one helper definition in `types/result/module.ts` that is
dead, one identical copy in `io/module.ts`, one private async copy in
`io/module.f.ts`, and one inline async copy in `io/module.ts` — three real
copies plus a dead one.

## Proposed consolidation

`tryCatch` and `asyncTryCatch` are inherently side-effecting (`try/catch`
is not a FunctionalScript construct), so their **definitions** belong in
`.ts` modules, not `.f.ts`. The right home is `fs/types/result/module.ts`,
already established as the side-effect bridge for `Result`:

```ts
// fs/types/result/module.ts
import { ok, error, type Result } from './module.f.ts'

export const tryCatch
    : <T>(f: () => T) => Result<T, unknown>
    = f => {
        try { return ok(f()) }
        catch (e) { return error(e) }
    }

export const asyncTryCatch
    : <T>(f: () => Promise<T>) => Promise<Result<T, unknown>>
    = async f => {
        try { return ok(await f()) }
        catch (e) { return error(e) }
    }
```

(Drop the `default` export — every other module here uses named exports.)

Then:

- `fs/io/module.ts` imports both and references them in the `io` literal
  instead of re-defining `tryCatch` and inlining `asyncTryCatch`.
- `fs/io/module.f.ts` cannot import a `.ts` file (FunctionalScript modules
  reach into `.ts` siblings only via the runtime), so the **private** `tc`
  stays — but it should call `io.asyncTryCatch` indirectly. Concretely: the
  adapter has access to the `Io` instance at construction time (`fromIo` is
  invoked with it), so the private `tc` can be replaced by capturing
  `io.asyncTryCatch` in the closure and calling it. The body of `tc`
  duplicates a side effect the `Io` interface already requires the caller
  to supply.

## Why this qualifies

- DRY across **three** real implementations of the same try/catch wrapper
  (plus a fourth inline one) — well past the second-consumer bar in
  `AGENTS.md`.
- Separation of concerns: side-effecting `try/catch` and `await` belong in
  `.ts` modules; `fs/io/module.ts` should not re-implement what
  `fs/types/result/module.ts` already provides.
- Eliminates a dead export (`types/result/module.ts` default) by making it
  the actual canonical home.

## Caveats

- `fs/types/result/module.ts` currently uses a `default` export; switching
  to named exports is a tiny breaking change to consumers of that file —
  but there **are no consumers** today, so this is risk-free.
- `fs/io/module.f.ts`'s private `tc` can only be deleted if the adapter
  routes through `io.asyncTryCatch`. If that indirection is unwanted (it
  adds one promise-resolution per effect), keep `tc` and just note the
  shape parity; the two copies in `io/module.ts` and the dead one in
  `types/result/module.ts` are the unambiguous wins.
- `Io.tryCatch` and `Io.asyncTryCatch` are interface fields, not constants;
  collapsing them to direct imports of the shared helpers means `Io`
  loses two fields. Callers that destructure them off `io` still work;
  callers that *replace* them for testing (mock IO) lose an injection
  point. Audit `fs/effects/mock/` and `fs/effects/node/virtual/`
  before removing the fields — if no test replaces them, drop them.

## Related

- i192 — same spirit of lifting open-coded
  helpers into shared modules.
- i149 — `Sandbox` replaces a `tryCatch + measure`
  combination; the consolidation here is for the remaining standalone
  `tryCatch` sites.
