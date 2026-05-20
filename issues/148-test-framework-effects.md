# 148. Test Framework: Redesign for Effects

The test framework in [`fs/dev/tf/module.f.ts`](../fs/dev/tf/module.f.ts) currently runs on the [`Io`](../fs/io/module.f.ts) interface rather than the Effects system. This blocks running tests in any environment that doesn't implement `Io` (e.g. a browser), and duplicates effect-threading machinery that the rest of the codebase gets for free from the effect runner.

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
| `io.performance.now()` | `Now` (`now`) — epoch ns as `bigint` |
| `tryCatch(f)` | new `TryCatch` operation, or handled inline |
| `env(k)` | already in `NodeProgram` signature as `Env` parameter |
| `loadModuleMap2(env)` | already `Effect<Access \| Import \| All \| Readdir, ModuleMap>` |

### TryCatch as an effect

`tryCatch` is currently synchronous (`(f: () => R) => Result<R, unknown>`). The effect runner is async. Options:

1. **Add a `TryCatch` operation** to `NodeOp` — the runner wraps `f()` in a try/catch and returns the `Result`. This keeps the test framework fully within the effect model.
2. **Keep tryCatch out of effects** — pass it as a plain parameter alongside the effect runner. Simpler but inconsistent.

Option 1 is cleaner: `TryCatch` is already a concept in `Io`, and making it an operation allows the virtual runner to control it for deterministic error testing.

### Timing with `Now`

The current `measure` helper calls `io.performance.now()` before and after a test function. With the `Now` effect returning epoch nanoseconds, timing becomes:

```ts
const before: Effect<Now, bigint> = now()
// run test
const after: Effect<Now, bigint> = now()
// delta = after - before (nanoseconds)
```

### Target shape

The test program becomes a `NodeProgram` (or effect with a subset of `NodeOp`):

```ts
type TestOp = Log | Error | Now | TryCatch | Access | Import | All | Readdir

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
