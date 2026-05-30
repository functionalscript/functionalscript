# 65Y-registermodule-thenable. Inconsistent thenable handling between `sandbox` and `registerModule`

**Priority:** P3
**Status:** open

## Problem

The two test execution paths handle non-`Promise` thenables differently:

- **`sandbox`** (used by `fjs t`) uses `await f()`. JavaScript's `await` resolves any *thenable* — any object with a `.then` method — not only `Promise` instances. So a test that returns `{ then(_, reject) { reject('err') } }` is caught as a failure.
- **`registerModule`** (used by node/bun/deno/playwright) checks `r instanceof Promise`. A plain thenable is not a `Promise` instance, so it is treated as a plain return value — the test passes when it should fail.

Demonstrated by `fs/dev/tf/scenarios/thenable.fail.ts`:

| runner | exit code | correct? |
|--------|-----------|----------|
| fjs    | 1         | **no** — spuriously awaits the thenable |
| node   | 0         | yes — thenable is a plain value |
| bun    | 0         | yes — thenable is a plain value |
| deno   | 0         | yes — thenable is a plain value |
| playwright | 0     | yes — thenable is a plain value |

### Why thenables should NOT be awaited

FunctionalScript does not allow creating `Promise` objects directly (they are an Effect), but plain thenables are just ordinary objects with a `then` property and can be created freely. If a test function returns `{ then: f }`, it is almost certainly a plain data object — not an async operation. Awaiting it is surprising and incorrect.

The thenable pattern is largely a legacy of pre-`async/await` JavaScript (jQuery Deferred, Q, Bluebird). FunctionalScript has no such legacy. The correct convention is: **only await actual `Promise` instances**.

Under this convention, `registerModule`'s `instanceof Promise` check is correct; `sandbox`'s `await f()` is the bug.

### Bonus problem: `instanceof Promise` leaks into FunctionalScript code

`registerModule` in `fs/dev/tf/module.f.ts` currently contains:

```ts
const r = fn()
const er = r instanceof Promise ? awaitPromise(r) : pure(r)
```

`instanceof Promise` is a runtime concern that should not appear in a `.f.ts` file. FunctionalScript code should be agnostic about what `Promise` is.

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

Most frameworks await thenables for backwards-compatibility with legacy Promise libraries. FunctionalScript has no such requirement and can make the stricter, cleaner choice.

## Proposal

Move the `instanceof Promise` guard into `awaitPromise`'s handler and use `awaitPromise` in both paths. FunctionalScript code then has no knowledge of `Promise` at all.

**1. Widen `Await` to accept `unknown`** (`fs/types/effects/node/module.f.ts`):

```ts
// before
export type Await = readonly['await', (p: Promise<unknown>) => unknown]

// after
export type Await = readonly['await', (p: unknown) => unknown]
```

**2. Move the `instanceof Promise` check into the `await` handler** (`fs/io/module.ts`):

```ts
await: async (p: unknown) => p instanceof Promise ? await p : p
```

If `p` is not a real `Promise`, the handler returns it immediately without awaiting.

**3. Simplify `registerModule`** (`fs/dev/tf/module.f.ts`) — no more `instanceof` in `.f.ts`:

```ts
// before
const r = fn()
const er = r instanceof Promise ? awaitPromise(r) : pure(r)

// after
const er = awaitPromise(fn())
```

**4. Fix `sandbox` handler** (`fs/io/module.ts`) — use `instanceof Promise` instead of `await f()`:

```ts
sandbox: async <T>(f: () => T) => {
    let result: Result<T, unknown>
    let after: number
    const before = performance.now()
    try {
        const raw = f()
        const value = raw instanceof Promise ? await raw : raw
        after = performance.now()
        result = ok(value as T)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
}
```

The two `instanceof Promise` checks in steps 2 and 4 could share a module-level helper in `module.ts` to avoid duplication.

## Related

- [i65X-sandbox-async](./65X-sandbox-async.md) — made `sandbox` async; this issue corrects its over-broad thenable handling
- [i65X-async-test-functions](./65X-async-test-functions.md) — original async test issue
