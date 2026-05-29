# 65X-sandbox-async. `sandbox` does not await async test functions

**Priority:** P3
**Status:** open
**Blocked by:** [i206](./206-worker-sandbox.md)

## Problem

`sandbox` runs `fn()` synchronously and catches only synchronous throws:

```ts
sandbox: f => {
    const start = now()
    try {
        const result: Result<unknown, unknown> = ['ok', f()]
        return { result, duration: now() - start }
    } catch(e) {
        return { result: ['error', e], duration: now() - start }
    }
}
```

If `fn` is async, `f()` returns a `Promise` with no synchronous throw. The sandbox
records `['ok', Promise<...>]` and returns immediately. Any failure that occurs after
an `await` inside `fn` becomes an unhandled rejection — the self-hosted runner (`fjs t`)
reports the test as passed when it should fail.

Demonstrated by the `async.fail.ts` and `async-subtests.fail.ts` scenario files:
both exit 0 with the `fjs` runner when exit 1 is expected.

## Proposal

### Short-term: async sandbox variant

Add `asyncSandbox` that awaits the result before returning:

```ts
export type AsyncSandbox = readonly['asyncSandbox', <T>(f: () => Promise<T>) => SandboxResult<T>]
```

The handler in `fromIo` would `await f()` inside a try/catch and measure time with
`performance.now()` around the await. `defaultTest` would detect async functions
(via `instanceof Promise` on the result of `fn()`) and route to `asyncSandbox`.

### Long-term: worker-based sandbox

See [i206](./206-worker-sandbox.md). A worker-based sandbox naturally handles async
functions and adds hard timeout/memory limits.

## Related

- [i206](./206-worker-sandbox.md) — worker sandbox; the long-term fix
- [i65X-async-test-functions](./65X-async-test-functions.md) — broader async test
  issue; the `registerModule` path is fixed, this issue tracks the `sandbox` path
- [i183](./183-tf-framework-scenario-tests.md) — scenario matrix that surfaces this gap
