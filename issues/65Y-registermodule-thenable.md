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

## Research

How other frameworks handle thenable return values from test functions:

| Framework | Mechanism | Awaits thenables? |
|-----------|-----------|-------------------|
| Node.js `node:test` | [`Promise.resolve(ret)`](https://github.com/nodejs/node/blob/main/lib/internal/test_runner/test.js) on the sync/async path; `util.types.isPromise()` only guards the callback-style error | **Yes** |
| Bun `bun:test` (native) | [`dynamicDowncast<JSC::JSPromise>`](https://github.com/oven-sh/bun/blob/main/src/bun.js/bindings/bindings.cpp) — strict JSC type check | **No** |
| Bun `node:test` polyfill | [`instanceof Promise`](https://github.com/oven-sh/bun/blob/main/src/js/node/test.ts) | **No** |
| Deno native | [plain `await fn()`](https://github.com/denoland/deno/blob/main/runtime/js/40_test.js) | **Yes** |
| Deno `node:test` polyfill | [explicit `typeof value.then === 'function'`](https://github.com/denoland/deno/blob/main/ext/node/polyfills/testing.ts) | **Yes** |
| Playwright | [plain `await fn()`](https://github.com/microsoft/playwright/blob/main/packages/playwright/src/worker/workerMain.ts) | **Yes** |
| Jest (jest-circus) | [`typeof candidate.then === 'function'`](https://github.com/jestjs/jest/blob/main/packages/jest-util/src/isPromise.ts) | **Yes** |
| Vitest | [plain `await fn()`](https://github.com/vitest-dev/vitest/blob/main/packages/runner/src/run.ts); typed as `Awaitable<T> = T \| PromiseLike<T>` | **Yes** |

**Conclusions:**

- The consensus is to support thenables. Most frameworks either use plain `await` (which the JS spec requires to call `.then` on any thenable) or an explicit duck-type check on `.then`.
- Bun is the outlier — both its native runner and its `node:test` polyfill perform strict native-Promise checks. A failing thenable will be missed on Bun regardless of our fix.
- The Deno `node:test` polyfill has the most explicit and portable version: `typeof value.then === 'function'`.
- Jest's `isPromise` also checks `typeof r === 'object' || typeof r === 'function'` to match the `PromiseLike<T>` TypeScript interface exactly.

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
