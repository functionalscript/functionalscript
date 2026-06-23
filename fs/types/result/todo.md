# TODO

## Consolidate `tryCatch` implementations

**Priority:** P3
**Status:** open

> **Update (post-#943):** `fs/io` was merged into `fs/effects/node/module.ts`. The copies now live in that file (`tc`, `tryCatch`, `asyncTryCatch`) plus `fs/types/result`. Paths below referencing `fs/io/...` now mean `fs/effects/node/module.ts`.

The same "wrap `f()` in `try/catch`, return `Result<T, unknown>`" helper is written out in three places, plus an async sibling that is structurally identical. All bodies are byte-equivalent modulo `await` and `Promise<...>`.

### Proposed consolidation

`tryCatch` and `asyncTryCatch` are side-effecting (`try/catch` is not a FunctionalScript construct), so their definitions belong in `.ts` modules. The right home is `fs/types/result/module.ts`:

```ts
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

Drop the `default` export — use named exports.

Then `fs/effects/node/module.ts` imports both instead of re-defining them.

### Caveats

- No consumers of `types/result/module.ts` today, so switching to named exports is risk-free.
- `fs/effects/node/module.f.ts`'s private `tc` can only be deleted if the adapter routes through `io.asyncTryCatch`.
- Before removing `Io.tryCatch`/`Io.asyncTryCatch` fields, audit `fs/effects/mock/` and `fs/effects/node/virtual/` to confirm no test replaces them.

---
