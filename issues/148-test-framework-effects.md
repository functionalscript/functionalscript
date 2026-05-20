# 148. Test Framework: Redesign for Effects

The test framework in [`fs/dev/tf/module.f.ts`](../fs/dev/tf/module.f.ts) currently runs on the [`Io`](../fs/io/module.f.ts) interface rather than the Effects system. This blocks running tests in any environment that doesn't implement `Io` (e.g. a browser), and duplicates effect-threading machinery that the rest of the codebase gets for free from the effect runner.

A deeper problem: the test framework cannot test itself. `Io` has no pure in-process mock — testing code that depends on `Io` requires a real runtime environment. Effects, by contrast, can be virtualized entirely within FunctionalScript using the virtual runner, so the test framework becomes testable by its own mechanism.

## Current design

`main` receives an `Io` and calls `fromIo(io)(loadModuleMap2(...))` to discover test modules, then passes control to `test(input)` where `input` is an `Input<T>`:

```ts
type Input<T> = {
    readonly moduleMap: ModuleMap
    readonly log: Log<T>
    readonly error: Log<T>
    readonly measure: Measure<T>
    readonly state: T
    readonly tryCatch: <R>(f: () => R) => Result<R, unknown>
    readonly env: (n: string) => string | undefined
}
```

`Input<T>` is a hand-rolled effect monad: it threads `log`, `error`, `measure` (timing via `io.performance`), `tryCatch`, and an opaque `state` through the test walk. This is exactly what the Effects system provides natively — but wired by hand, duplicated per call, and locked to `Io`.

Module loading (`loadModuleMap2`) is already an `Effect<Access | Import | All | Readdir, ModuleMap>`. The coupling to `Io` lives entirely in the test runner itself.

## What needs to change

Replace `Input<T>` and the `Io` dependency with a proper Effect program.

### Operations the test runner needs

| Current | Effect equivalent |
|---------|-------------------|
| `log(s)` | `Log` (`log`) |
| `error(s)` | `Error` (`error`) |
| `io.performance.now()` + `tryCatch` | `Sandbox` — runs a plain sync function, catches errors, measures time; new operation |
| `tryCatch(f)` | new `TryCatch` operation, or handled inline |
| `env(k)` | already in `NodeProgram` signature as `Env` parameter |
| `loadModuleMap2(env)` | already `Effect<Access \| Import \| All \| Readdir, ModuleMap>` |

### TryCatch as an effect

`tryCatch` is currently synchronous (`(f: () => R) => Result<R, unknown>`). The effect runner is async. Options:

1. **Add a `TryCatch` operation** to `NodeOp` — the runner wraps `f()` in a try/catch and returns the `Result`. This keeps the test framework fully within the effect model.
2. **Keep tryCatch out of effects** — pass it as a plain parameter alongside the effect runner. Simpler but inconsistent.

Option 1 is cleaner: `TryCatch` is already a concept in `Io`, and making it an operation allows the virtual runner to control it for deterministic error testing.

### Timing with a performance counter

The current `measure` helper calls `io.performance.now()` before and after a test function. `io.performance.now()` is a high-resolution monotonic counter (sub-millisecond, relative to an arbitrary origin) — different from the `Now` effect which returns epoch nanoseconds from `Date.now()`. For timing test execution we need the performance counter, not the wall clock.

Two design options:

**Option A — raw `Perf` counter** (call before and after, compute delta manually, keep `TryCatch` separate):

```ts
export type Perf = readonly['perf', () => number]
export const perf: Func<Perf> = do_('perf')
```

```ts
const timedTest = (f: () => unknown): Effect<Perf | TryCatch, readonly[Result<unknown, unknown>, number]> =>
    begin
    .step(() => perf())
    .step(before => tryCatch(f)
        .step(result => perf()
            .step(after => pure([result, after - before] as const))
        )
    )
```

Verbose, requires two separate operations, and the virtual runner must coordinate them independently. Critically, since effects execute as async tasks, the scheduler can insert arbitrary work between the two `perf()` calls, making the measured delta inaccurate.

**Option B — `Trial` effect** (takes a plain sync function, combines try/catch and timing in one operation):

```ts
export type Trial = ['sandbox', <T>(f: () => T) => readonly[Result<T, unknown>, number]]
export const sandbox: Func<Trial> = do_('sandbox')
```

The runner executes `f()`, catches any thrown value, measures elapsed time via `performance.now()`, and returns `[result, delta]`. Usage:

```ts
sandbox(myTest)  // Effect<Trial, readonly[Result<unknown, unknown>, number]>
```

Option B is preferred: one operation replaces both `TryCatch` and `Measure`, the runner owns both the clock and the error boundary, and the virtual runner can inject controlled results and deltas for deterministic tests. Only plain sync functions are accepted — no effects, no promises — which matches exactly what test functions are. Because the function runs synchronously inside the operation, the before/after clock reads happen in the same turn of the event loop with no scheduler interleaving, giving accurate timings. The name `sandbox` is intentional: it implies both the try/catch ("sandbox" from "try") and a measured test run. Future parameters (memory limit, time limit) are not expressible inside a JS engine today but can be added to the operation payload later without breaking the API. Implementations that use workers (e.g. a browser runner or a Node worker-threads runner) get isolation and limit enforcement for free from the worker boundary.

### Target shape

The test program becomes a `NodeProgram` (or effect with a subset of `NodeOp`):

```ts
type TestOp = Log | Error | Trial | Access | Import | All | Readdir

const testProgram: (argv: readonly string[], env: Env) => Effect<TestOp, number>
```

The `module.ts` adapter (Node/Bun/Playwright dispatcher) calls `fromIo(io)(testProgram(argv, env))` — a single line, identical to every other Node program in the codebase.

## Browser test runner

Once the test runner is an effect, a `BrowserOp` runner can execute the same `Effect<TestOp, number>` in a browser. The browser runner would:

- Implement `Log`/`Error` by writing to the DOM.
- Implement `Now` via `BigInt(Date.now()) * 1_000_000n`.
- Implement `TryCatch` with a try/catch wrapper.
- Implement `Readdir`/`Access`/`Import` by fetching a pre-built module manifest (a JSON file listing all test modules, generated at build time).

The manifest approach sidesteps the absence of filesystem APIs in the browser: instead of walking the directory tree at runtime, the build step emits a `test-manifest.json` that the browser runner fetches.

## Migration path

1. Add `TryCatch` operation to `NodeOp` and implement in `fromIo` and the virtual runner.
2. Rewrite the inner test walk (`test(input)`) as a pure function returning `Effect<TestOp, TestState>`.
3. Replace `main(io)` with `testProgram(argv, env)` returning `Effect<TestOp, number>`.
4. Update `module.ts` to call `fromIo(io)(testProgram(...))`.
5. Delete `Input<T>`, `measure`, `anyLog` helpers (now redundant).
6. Add `BrowserOp` runner and a browser entry point (`dev/test.html`) — see [i29](./README.md) and [i36](./README.md).

## Unblocked by this change

- [i21](./021-test-framework-silent-mode.md) — silent/verbose mode becomes an effect layer, not a threading concern.
- [i20](./README.md) — running a subset of tests: filter the module map before passing to the effect.
- [i29](./README.md) — browser testing: run the same effect with a browser runner.
- [i36](./README.md) — `dev/test.html`: a static HTML page that loads the effect runner and the test manifest.

## Related

- [i139](./README.md) — the task entry tracking this migration.
- [i803](https://github.com/functionalscript/functionalscript/pull/803) — adds `Now` (epoch ns via `Date.now()`), one of the operations the redesigned framework needs.
- [i122](./README.md) — `node.f.ts` / `app.f.ts` file type for applications; the redesigned test runner would be such an application.
