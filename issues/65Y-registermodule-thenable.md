# 65Y-registermodule-thenable. `registerModule` misses rejecting thenables

**Priority:** P3
**Status:** open

## Problem

`registerModule` checks `r instanceof Promise` to decide whether to await a test
function's return value:

```ts
const r = fn()
const er = r instanceof Promise ? awaitPromise(r) : pure(r)
```

JavaScript's `await` resolves any *thenable* — any object with a `.then` method —
not only `Promise` instances. A plain thenable that calls its `reject` callback is
treated as a successful plain return value by `registerModule`, so the test passes
when it should fail.

`sandbox` (used by `fjs t`) uses `await f()` which resolves any thenable correctly,
so the two execution paths disagree:

| runner | `thenable.fail.ts` exit code | correct? |
|--------|------------------------------|----------|
| fjs    | 1                            | yes      |
| node   | 0                            | **no**   |
| bun    | 0                            | **no**   |
| deno   | 0                            | **no**   |
| playwright | 0                        | **no**   |

Demonstrated by `fs/dev/tf/scenarios/thenable.fail.ts`.

## Proposal

Replace the `instanceof Promise` guard with a thenable check:

```ts
const isThenable = (r: unknown): r is PromiseLike<unknown> =>
    r !== null &&
    (typeof r === 'object' || typeof r === 'function') &&
    typeof (r as Record<string, unknown>)['then'] === 'function'
```

Then in `registerModule`:

```ts
const r = fn()
const er = isThenable(r) ? awaitPromise(r as Promise<unknown>) : pure(r)
```

`awaitPromise` already takes `Promise<T>` but `PromiseLike<T>` is structurally
compatible — a type cast or a small signature change is sufficient.

## Related

- [i65X-sandbox-async](./65X-sandbox-async.md) — sibling fix that made `sandbox` async
- [i65X-async-test-functions](./65X-async-test-functions.md) — original async test issue
