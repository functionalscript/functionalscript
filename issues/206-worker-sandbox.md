# 206. Investigate workers as a sandbox

**Priority:** P3
**Status:** open

## Problem

The current `sandbox` operation runs a synchronous function inside a try/catch with
`performance.now()` timing:

```ts
export type Sandbox = readonly['sandbox', <T>(f: () => T) => SandboxResult<T>]
```

This provides error isolation but no resource limits — a test that spins forever,
allocates unbounded memory, or calls `process.exit()` can crash the entire runner.

## Proposal

Investigate Node.js Worker Threads (`node:worker_threads`) as a stronger sandbox:

- **Hard timeout** — `worker.terminate()` after a configurable deadline; the worker
  cannot escape it.
- **Memory isolation** — each worker has its own V8 heap; a runaway allocation does
  not OOM the host.
- **`process.exit()` safety** — a `process.exit()` inside a worker kills only the
  worker, not the host.

The `SandboxResult<T>` return type is already designed to carry a `Result<T, unknown>`
so timeout and termination can be surfaced as `error` values without API changes.

## Open questions

1. **Startup cost** — spawning a worker per test call may be too slow for a large
   test suite. A worker pool (reuse workers across calls) reduces amortized cost but
   complicates state isolation between tests.
2. **Serialisation** — `SandboxResult<T>` requires `T` to be transferable across the
   worker message channel (structured clone). Pure FunctionalScript values are plain
   objects/arrays/primitives, so this should hold in practice.
3. **Bun/Deno compatibility** — both support `node:worker_threads`; verify that the
   same implementation works across all three runtimes.
4. **Effect compatibility** — the sandbox currently accepts a plain `() => T`; if
   worker startup becomes an async operation, the `Sandbox` operation type may need
   to become async (or a new `AsyncSandbox` operation added).

## Related

- [i149](./149-sandbox.md) — original `sandbox` design
- [i183](./183-tf-framework-scenario-tests.md) — scenario tests that would exercise
  timeout/OOM behaviour
