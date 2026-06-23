# TODO

## `orNotFound` combinator

**Priority:** P4
**Status:** open

`fs/cas/module.f.ts` spells out the same three-way `IoResult` policy in two places: `ok → continue`, `ENOENT → benign default`, `other error → throw`. Add one combinator beside `isNotFound` in `fs/effects/node/module.f.ts`:

```ts
export const orNotFound =
    <O extends Operation, T>(effect: Effect<O, IoResult<T>>) =>
    <N>(notFound: N) =>
    <Q extends Operation, R>(onOk: (value: T) => Effect<Q, R>): Effect<O | Q, R | N> =>
        effect.step<Q, R | N>(r => {
            if (r[0] === 'ok') { return onOk(r[1]) }
            if (isNotFound(r[1])) { return pure(notFound) }
            throw r[1]
        })
```

CAS call sites then carry only their differences:

```ts
read: (key) => orNotFound(readFile(toPath(key)))(undefined)(pure),
list: () => orNotFound(access('.cas'))<readonly Vec[]>([])(() => readdir(...))
```

### Tasks

- [ ] Add `orNotFound` to `fs/effects/node/module.f.ts`.
- [ ] Rewrite `read` and `list` in `fs/cas/module.f.ts` to use it.
- [ ] Cover all three branches (`ok`, `ENOENT`, non-`ENOENT` throw) in `fs/effects/node/proof.f.ts`.

### Related

- `208-try-catch-consolidate` (now `fs/types/result/todo.md`) — consolidating `tryCatch` helpers that *produce* `IoResult`; this is about *consuming* one uniformly. Complementary.

---

## `readJsonFile` / `writeJsonFile` helpers

**Priority:** P3
**Status:** on-hold

> **Drift note (2026-06-12).** The `dev/version` module is gone and `fs/dev/module.f.ts` no longer reads or writes `deno.json`. The only remaining JSON-file call site is the `ci` write, which is below the second-consumer bar for extracting `writeJsonFile`, and there are no production JSON-file reads at all. On hold until a second real consumer appears; the design below remains valid when it does.

Three modules independently open-code "read a file, UTF-8 decode it, JSON-parse it" and "JSON-stringify a value, UTF-8 encode it, write the file". This is a single concern currently scattered and copied.

### Proposed abstraction

A small shared module (e.g. `fs/effects/node/json/module.f.ts`) over the existing effects:

```ts
export const readJsonFile = (path: string): Effect<ReadFile, unknown> => begin
    .step(() => readFile(path))
    .step(v => pure(JSON.parse(utf8ToString(unwrap(v)))))

export const writeJsonFile = (path: string) => (value: unknown): Effect<WriteFile, void> =>
    writeFile(path, utf8(JSON.stringify(value, null, 2)))
```

### Caveats

- `readJsonFile` returns `unknown`; callers run their own RTTI validation.
- Confirm the `Effect` result type of `writeFile` so the helper's signature matches.
- Must depend only on `effects`, `text`, and `result` — not on Node built-ins.

### Related

- `fs/effects/node/module.f.ts` — `readFile`/`writeFile` effects.
- `fs/text/module.f.ts` — `utf8`/`utf8ToString`.

---

## `RequestListener` stateful

**Priority:** P3
**Status:** open

`RequestListener` should not be stateless. Options:

1. Pass a state parameter.
2. In-memory key-value storage accessed via effects.
3. One function for all events that also passes state, similar to a `scan` function.

---
