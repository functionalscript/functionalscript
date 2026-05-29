# 192. `effects/node`: an `errorExit` helper for "print an error, exit 1"

**Priority:** P3
**Status:** open

Both CLI entry points encode "write an error line, then yield exit code 1" by
hand:

```ts
// fs/cas/module.f.ts:95
const e = (s: string): Effect<NodeOp, number> =>
    begin
        .step(() => error(s))
        .step(() => pure(1))
```

```ts
// fs/fjs/module.f.ts:32
case undefined:
    return error('Error: command is required').step(() => pure(1))
default:
    return error(`Error: Unknown command "${command}"`).step(() => pure(1))
```

Same effect program in both: emit `error(s)`, then `pure(1)`. `cas` names it `e`
locally; `fjs` inlines it three times.

## Proposed abstraction

Move it next to the other `NodeOp` combinators in
`fs/types/effects/node/module.f.ts`:

```ts
// fs/types/effects/node
export const errorExit = (s: string): Effect<NodeOp, number> =>
    error(s).step(() => pure(1))
```

`cas` drops its local `e` and imports `errorExit`; `fjs` replaces its three
inline `error(...).step(() => pure(1))` with `errorExit(...)`.

## Why this qualifies

- DRY with two real consumers (`cas`, `fjs`) — and four call sites total. CLI
  "fail with a message and a non-zero code" is a recurring program shape that
  belongs with the `NodeProgram`/`error`/`pure` vocabulary.

## Caveats

- The two spellings differ cosmetically: `cas` prefixes `begin.step(...)` while
  `fjs` starts from `error(...)` directly. Confirm `begin.step(() => error(s))`
  and `error(s)` produce the same effect (they should — `begin` is the empty
  program) before collapsing onto one form.
- Pin the exit code in the helper to `1`; any command needing a different code
  keeps its own `error(...).step(() => pure(n))`.
- The helper lands in `types/effects/node`, the shared home for both CLIs; this
  is a cross-module move, so register/verify imports accordingly.

## Related

- [i176](./README.md) — same spirit of lifting open-coded effect idioms
  (`readJsonFile`/`writeJsonFile`) into shared helpers.
