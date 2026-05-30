# 65Y-registermodule-thenable. Inconsistent thenable handling between `sandbox` and `registerModule`

**Priority:** P3
**Status:** done

## Problem

The two test execution paths handled non-`Promise` thenables differently:

- **`sandbox`** (used by `fjs t`) used `await f()`. JavaScript's `await` resolves any *thenable* — any object with a `.then` method — not only `Promise` instances.
- **`registerModule`** (used by node/bun/deno/playwright) checked `r instanceof Promise`, treating plain thenables as plain return values.

Additionally, `instanceof Promise` was leaking into FunctionalScript code (`module.f.ts`), which should not need to know what `Promise` is.

## Research

How other frameworks handle thenable return values from test functions:

| Framework | Mechanism | Awaits thenables? |
|-----------|-----------|-------------------|
| Node.js `node:test` | [`Promise.resolve(ret)`](https://github.com/nodejs/node/blob/main/lib/internal/test_runner/test.js) on the sync/async path | **Yes** |
| Bun `bun:test` (native) | [`dynamicDowncast<JSC::JSPromise>`](https://github.com/oven-sh/bun/blob/main/src/bun.js/bindings/bindings.cpp) — strict JSC type check | **No** |
| Bun `node:test` polyfill | [`instanceof Promise`](https://github.com/oven-sh/bun/blob/main/src/js/node/test.ts) | **No** |
| Deno native | [plain `await fn()`](https://github.com/denoland/deno/blob/main/runtime/js/40_test.js) | **Yes** |
| Deno `node:test` polyfill | [explicit `typeof value.then === 'function'`](https://github.com/denoland/deno/blob/main/ext/node/polyfills/testing.ts) | **Yes** |
| Playwright | [plain `await fn()`](https://github.com/microsoft/playwright/blob/main/packages/playwright/src/worker/workerMain.ts) | **Yes** |
| Jest (jest-circus) | [`typeof candidate.then === 'function'`](https://github.com/jestjs/jest/blob/main/packages/jest-util/src/isPromise.ts) | **Yes** |
| Vitest | [plain `await fn()`](https://github.com/vitest-dev/vitest/blob/main/packages/runner/src/run.ts) | **Yes** |

**Conclusions:**

- The consensus among most frameworks is to support thenables — they use plain `await` (which the JS spec requires to call `.then` on any thenable) or an explicit duck-type check on `.then`. The motivation is backwards-compatibility with legacy Promise libraries (jQuery Deferred, Q, Bluebird).
- Bun is the notable exception — both its native runner and its `node:test` polyfill perform strict native-Promise-only checks. A failing thenable will be missed on Bun regardless of any duck-type fix.
- The Deno `node:test` polyfill has the most explicit portable version: `typeof value.then === 'function'`.
- The legacy-compatibility motivation does not apply to FunctionalScript, which has no pre-`async/await` codebase to support.

## Decision

FunctionalScript does not allow creating `Promise` objects directly; they only arise
as return values of `async` functions. A plain `{ then: f }` object is almost certainly
a data value, not an async operation. **Only real `Promise` instances are awaited;
thenables are treated as ordinary values.**

As a corollary, exporting a function named `then` from a module is forbidden — see
[issues/lang/3240-export.md](./lang/3240-export.md).

## Fix

The key insight: `async (p) => p` where `p` is a thenable still follows it, because the `async` wrapper returns `Promise.resolve(p)` which calls `.then()`. To avoid this, the handler boxes the return value in an array — arrays have no `.then`, so `Promise.resolve([p])` resolves immediately without following `p`.

- **`fs/types/effects/node/module.f.ts`**: `Await` changed to `(p: unknown) => readonly [unknown]` (boxed return); private `awaitPromise` creates the low-level effect; public `awaitIfPromise` unboxes via `.step(([x]) => pure(x))`.
- **`fs/io/module.ts`**: handler `async (p: unknown): Promise<readonly [unknown]> => [p instanceof Promise ? await p : p]` — boxes the result so `async` machinery never sees a bare thenable.
- **`fs/io/module.f.ts`**: `await` on `Io` interface typed as `(p: unknown) => Promise<readonly [unknown]>`; used directly as the asyncRun handler.
- **`fs/dev/tf/module.f.ts`**: `registerModule` uses `awaitIfPromise(fn())` — no `instanceof Promise` in FunctionalScript code.
- **`fs/types/effects/node/virtual/module.f.ts`**: `await: (state, p) => [state, [p]]` — boxes in the virtual runner too.
- **`fs/dev/tf/README.md`**: convention documented.
- **`fs/dev/tf/scenarios/thenable2.pass.f.ts`**: scenario verifying `{ then: () => 'ok' }` is treated as a plain sub-tree, not followed.

## Related

- [i65X-sandbox-async](./65X-sandbox-async.md) — sibling fix that made `sandbox` async
- [i65X-async-test-functions](./65X-async-test-functions.md) — original async test issue
