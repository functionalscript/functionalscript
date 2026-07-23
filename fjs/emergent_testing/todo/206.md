## 206. Investigate workers as a sandbox

**Priority:** P3
**Status:** open

### Problem

The current `sandbox` operation runs a synchronous function inside a try/catch with
`performance.now()` timing:

```ts
export type Sandbox = readonly['sandbox', <T>(f: () => T) => SandboxResult<T>]
```

This provides error isolation but no resource limits — a test that spins forever,
allocates unbounded memory, or calls `process.exit()` can crash the entire runner.

### Proposal

Investigate Node.js Worker Threads (`node:worker_threads`) as a stronger sandbox:

- **Hard timeout** — `worker.terminate()` after a configurable deadline; the worker
  cannot escape it.
- **Memory isolation** — each worker has its own V8 heap; a runaway allocation does
  not OOM the host.
- **`process.exit()` safety** — a `process.exit()` inside a worker kills only the
  worker, not the host.

The `SandboxResult<T>` return type is already designed to carry a `Result<T, unknown>`
so timeout and termination can be surfaced as `error` values without API changes.

### Open questions

1. **Startup cost** — spawning a worker per test call may be too slow for a large
   test suite. A worker pool (reuse workers across calls) reduces amortized cost but
   complicates state isolation between tests.
2. **Serialisation** — `SandboxResult<T>` requires `T` to be transferable across the
   worker message channel (structured clone). Pure FunctionalScript values are plain
   objects/arrays/primitives, so this should hold in practice.
3. **Bun/Deno compatibility** — both support `node:worker_threads`; verify that the
   same implementation works across all three runtimes.

### Additional motivation: infinite waits and loops

The current sandbox has no way to detect or recover from tests that never terminate:

- **Infinite loops** — `while (true) {}` in a `proof.js` test locks the sandbox
  thread permanently; no other tests run, the runner hangs, and the process must be
  killed externally.
- **Non-resolvable Promises** — `await new Promise(() => {})` in a `proof.js` test
  produces a Promise whose executor never calls `resolve` or `reject`; the async
  sandbox waits forever and the suite never completes.

A worker with a hard timeout terminates the worker thread after the deadline and
reports a failure (timeout exceeded), keeping the rest of the test suite running.

### Related

- i149 — original `sandbox` design
- i183 — scenario tests that would exercise
  timeout/OOM behaviour
