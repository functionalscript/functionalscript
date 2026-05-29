# 65X-async-test-functions. Async test functions are not awaited

**Priority:** P3
**Status:** open
**Blocked by:** [i206](./206-worker-sandbox.md) (for the sandbox path)

## Problem

Test functions that return a `Promise` (async functions) are silently broken in
both execution paths.

### `registerModule` path (external frameworks: node, bun, deno, playwright)

In `fs/dev/tf/module.f.ts`, `registerOne` calls `fn()` but ignores the returned
Promise:

```ts
const r = fn()                                  // async fn → r is Promise<void>
const sub = collectTests([...path, null], false, r)  // Promise has no named fn exports → []
if (sub.length === 0) { return pure(undefined) }     // returns immediately
```

Any `throw` after an `await` inside `fn` becomes an unhandled rejection — the test
is declared passed before the Promise settles. Demonstrated by the
`fs/dev/tf/scenarios/async.fail.ts` scenario: all three runners (node, bun, deno)
exit 0 when exit 1 is expected.

### `sandbox` path (self-hosted `fjs t` runner)

`sandbox(fn)` in `module.f.ts` runs `fn()` synchronously and catches only
synchronous throws. An async `fn` returns a `Promise`; sandbox records
`['ok', Promise<void>]` and returns immediately. The async rejection is never
observed.

## Proposal

### `registerModule` fix

In the `module.f.ts` thunk, detect a Promise return and await it before
proceeding. Since `module.f.ts` is pure FunctionalScript and cannot use
`await`, the awaiting must happen in the `module.ts` adapter. One approach:
introduce a new `Await` effect operation that takes a `() => Promise<unknown>`
and resolves it:

```ts
export type Await = readonly['await', <T>(f: () => Promise<T>) => T]
```

The thunk then becomes:
```ts
(t): Effect<Test | All | Await, void> => {
    if (throws) { return await_(fn) }
    // ... await fn(), then collectTests on resolved value
}
```

Alternatively, keep the detection in `module.ts` by changing `TestFn` to
`() => unknown` and wrapping async results in `module.ts` before passing them
to `collectTests`.

### `sandbox` fix

`sandbox` needs an async-aware variant. See [i206](./206-worker-sandbox.md)
for the worker-based sandbox design, which would naturally handle async
functions by running them inside a worker that can await the result.

A simpler short-term fix: add `asyncSandbox` that wraps `fn` in an async
`try/catch` and awaits the result before returning `SandboxResult<T>`.

## Evidence

Scenario matrix after adding `async.pass.ts` and `async.fail.ts` to
`fs/dev/tf/scenarios/`:

| Scenario | Expected | node | bun | deno | playwright |
|----------|----------|------|-----|------|------------|
| `async.pass.ts` | exit 0 | ✓ | ✓ | ✓ | ✗ exit 1 |
| `async.fail.ts` | exit 1 | ✗ exit 0 | ✗ exit 0 | ✗ exit 0 | ✓ |

Playwright's inverted results suggest an additional issue with how it handles
`proof.ts` files (the async failure is caught, but the passing test unexpectedly
fails — likely a "no tests found" or TypeScript transformer issue specific to
`.proof.ts` under Playwright).

## Related

- [i206](./206-worker-sandbox.md) — worker-based sandbox; async-aware by design
- [i183](./183-tf-framework-scenario-tests.md) — scenario test matrix that
  exposed this gap
