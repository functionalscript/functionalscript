# 163. `Reporter.test`: delegate test execution via the reporter

**Priority:** P3
**Status:** open

## Problem

The walker in `runModule` (`./fs/emergent_testing/module.f.ts`) calls `sandbox(set.fn)` directly, hardcoding `Sandbox` as a required effect. This prevents reusing the walker in contexts where test execution is handled differently — in particular, the integrated bridge runner (`./fs/emergent_testing/module.ts`) which dispatches to Node `--test`, Bun, or Playwright and cannot use `sandbox` (it needs an async framework call instead).

Three alternatives were considered:

1. **New `RunTest` effect** — a new operation type `['runTest', (entry: TestEntry) => SandboxResult<unknown>]` registered in the virtual/real runners.
2. **Pass an effect creator as a separate parameter** — `runModule(reporter, runTest)` where `runTest: (throws, f) => Effect<O, SandboxResult<unknown>>`.
3. **Add `test` to `Reporter`** — the reporter already owns the environment boundary; extending it with a `test` method is consistent and requires no extra parameters.

Option 3 is preferred: reporters already encapsulate how events are rendered; making them also encapsulate how a test is _run_ is a natural extension, keeps the parameter count stable, and absorbs `Sandbox` into `O`.

## Proposed design

Add a `test` method to `Reporter<O>`:

```ts
export type Reporter<O extends Operation> = {
    readonly moduleStart: (file: string) => Effect<O, void>
    readonly enter: (path: readonly string[]) => Effect<O, void>
    readonly pass: (path: readonly string[], duration: number) => Effect<O, void>
    readonly fail: (file: string, path: readonly string[], result: unknown, duration: number) => Effect<O, void>
    readonly summary: (pass: number, fail: number, time: number) => Effect<O, void>
    readonly test: (throws: boolean, f: () => unknown) => Effect<O, SandboxResult<unknown>>
}
```

The walker replaces `sandbox(set.fn)` with `reporter.test(set.throws, set.fn)`.

### Reporter implementations

| Reporter | `test` implementation | Effect type |
|---|---|---|
| `defaultReporter` (terminal/GitHub) | `(throws, f) => sandbox(f)` | `Reporter<Write \| Sandbox>` |
| Capture reporter (virtual tests) | `(throws, f) => pure({ result: ['ok', f()], duration: 0 })` or fixture-driven | `Reporter<never>` |
| Bridge reporter (`module.ts`) | `(throws, f) => ...` using `nodeTest.test()` with throw semantics | `Reporter<SomeAsyncOp>` |

### Effect on `runModule`

`Sandbox` is removed from `runModule`'s effect constraint — it is absorbed into `O` via the reporter. The `sandbox` import in `module.f.ts` moves to `defaultReporter` only.

### Async bridging in `module.ts`

The bridge reporter's `test` method is the single integration point for async framework calls. The walker itself stays synchronous and Effect-based; all async bridging is contained in `reporter.test`. This directly resolves problem 1 from [i155](./155-test-runner-integration.md).

## Related

- [i155](./155-test-runner-integration.md) — identifies code duplication between `module.f.ts` and `module.ts` as a problem; this issue provides the mechanism to fix it.
- [i149](./149-sandbox.md) — `Sandbox` effect; `reporter.test` wraps it for the default case.
- [i156](./156-tf-virtual-tests.md) — virtual tests; the capture reporter's `test` method replaces the current pass-through `sandbox` convention.
- [i21](./021-test-framework-silent-mode.md) — reporter modes; `test` fits alongside the existing reporter methods.
