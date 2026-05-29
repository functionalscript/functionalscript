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

Make the existing `sandbox` handler async — no new operation type needed. The handler
in `fromIo` awaits the result if it is a `Promise`:

```ts
sandbox: async f => {
    const start = now()
    try {
        const value = await f()
        return { result: ok(value), duration: now() - start }
    } catch(e) {
        return { result: error(e), duration: now() - start }
    }
}
```

`asyncRun` already does `await operation(...)`, so returning a `Promise<SandboxResult<T>>`
from the handler is handled automatically. No changes needed in `module.f.ts` or the
`Sandbox` type — `f: () => T` already covers `() => Promise<T>` since `Promise<T>` is
assignable to `T = unknown`.

The long-term worker-based sandbox ([i206](./206-worker-sandbox.md)) would also handle
async naturally.

## Related

- [i206](./206-worker-sandbox.md) — worker sandbox; the long-term fix
- [i65X-async-test-functions](./65X-async-test-functions.md) — broader async test
  issue; the `registerModule` path is fixed, this issue tracks the `sandbox` path
- [i183](./183-tf-framework-scenario-tests.md) — scenario matrix that surfaces this gap
