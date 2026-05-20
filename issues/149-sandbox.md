# 149. `Sandbox` Effect

A `Sandbox` effect that runs a plain synchronous function in an isolated, measured environment. It combines try/catch, timing, and future resource measurement into a single operation.

## Definition

```ts
export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    /**
     * Measured milliseconds but it's not limited to that.
     * Instead, they represent times as floating-point numbers
     * with up to microsecond precision.
     */
    readonly duration: number  // future fields: allocatedMemory, maxStack, coverage, etc.
}

export type Sandbox = ['sandbox', <T>(f: () => T) => SandboxResult<T>]
export const sandbox: Func<Sandbox> = do_('sandbox')
```

`SandboxResult<T>` is a named record rather than a tuple so future measurements can be added as new fields without breaking existing consumers.

## Why a single operation

Combining try/catch and timing into one operation rather than two separate effects (`TryCatch` + `Perf`) is necessary for correctness: effects execute as async tasks, so the scheduler can insert arbitrary work between two separate `perf()` calls, making the measured delta inaccurate. Running the function synchronously inside the operation ensures the clock reads happen in the same turn of the event loop with nothing in between.

## Future parameters

Future sandbox constraints (memory limit, time limit) are not expressible inside a JS engine today but can be added to the operation payload later without breaking the API:

```ts
// future
export type SandboxOptions = {
    readonly timeLimit?: bigint    // nanoseconds
    readonly memoryLimit?: bigint  // bytes
}
```

Similarly, `SandboxResult<T>` can grow to include coverage data — which functions, branches, and parameters were executed during the run:

```ts
// future
export type Coverage = {
    readonly functions: readonly string[]
    readonly branches: readonly string[]
    // etc.
}

export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    readonly duration: number
    readonly coverage?: Coverage
    // readonly allocatedMemory?: bigint
    // readonly maxStack?: bigint
}
```

Coverage information would allow the test framework to aggregate per-test coverage into a full report without relying on external tools like `--experimental-test-coverage`. It also makes coverage a first-class effect result rather than a side channel written to disk.

## Implementations

- **Node.js (simple):** plain try/catch + `performance.now()` in the same synchronous block.
- **Node.js (worker):** run `f` in a `worker_thread`; enforces time and memory limits via worker termination.
- **Browser:** run `f` in a `Worker`; same limit enforcement.
- **Virtual runner:** calls `f()` synchronously and returns `duration: 0`, giving deterministic results in tests. Full injection of controlled results and durations (needed to test the test framework itself) is future work tracked in [i148](./148-test-framework-effects.md).

## Related

- [i148](./148-test-framework-effects.md) — the test framework redesign that motivated this effect; `Sandbox` replaces `Input<T>`'s `tryCatch` + `measure` combination.
