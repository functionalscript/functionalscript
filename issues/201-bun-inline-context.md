# 201. Bun sub-test fix: `bunTestContext`

## Problem

Bun does not support sub-tests (calling `test()` inside a test callback) in
either of its two test APIs:

**`node:test` via Bun** — `t.test()` inside a callback throws:
```
NotImplementedError: test() inside another test() is not yet implemented in Bun.
Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/5090.
Use `bun:test` in the interim.
code: "ERR_NOT_IMPLEMENTED"
```

**`bun:test`** — `test()` inside a test callback throws a different error and
counts as a *fail* on the parent test (not an unhandled error):
```
error: Cannot call test() inside a test. Call it inside describe() instead.
(fail) parent [6.08ms]
```

When `register` ([i200](./200-register-module.md)) runs under Bun, any `Test`
effect that passes the child `t` context to its thunk hits one of these errors.

## Why alternatives don't work

### Eager flat registration

The obvious workaround — scan all tests statically and register them flat at the
top level — fails because **leaves can only be identified by executing the test
function**. A function `fn` may return a plain value (leaf) or an object with
further test entries (sub-tree). That shape is only known after `fn()` runs.
Static traversal via `collectTests` can walk the module's static object/array
structure, but any depth that comes from a function's return value is opaque
until execution.

### Nested `describe()`

`bun:test` supports `describe()` nested inside `describe()` callbacks, so the
static object/array structure could in principle be represented as nested
describe blocks. However, this cannot replace `inlineContext` for two reasons:

1. **Dynamic sub-trees**: `describe()` callbacks run synchronously during the
   registration phase, before any test executes. Return-value sub-trees are only
   discoverable after `fn()` runs inside a test callback — too late for
   `describe()`.

2. **Throw semantics**: If a `describe()` callback throws, Bun reports it as an
   *unhandled error between tests* — a third outcome category separate from pass
   and fail — and any tests after the throw in that block are silently dropped.
   Example output:

   ```
   # Unhandled error between tests
   -------------------------------
   error: oops
   -------------------------------
    4 pass
    0 fail
    1 error
   ```

   FunctionalScript's "throw" tests expect a throw to be a *pass*. Catching that
   at the `describe` level produces the wrong outcome type and loses the test
   result entirely.

## Proposed solution: `bunTestContext`

Three private helpers live in `fs/io/module.ts`:

`inlineTest` is the shared core — it handles `expectFailure` manually and calls
`fn(inlineContext)` so all nesting executes inline:

```ts
// fs/io/module.ts (private)
const inlineTest: TestFn = async (name, { expectFailure }, fn) => {
    if (expectFailure) {
        try { await fn(inlineContext) } catch { return }
        throw new Error(`expected to throw: ${name}`)
    } else {
        await fn(inlineContext)
    }
}
```

`inlineContext` is now a one-liner since `inlineTest` already matches `TestFn`:

```ts
const inlineContext: TestContext = { test: inlineTest }
```

`bunTestContext` registers with Bun's native `nodeTest.test` (options omitted —
the two-argument overload `test(name, fn)` is valid) then delegates to
`inlineTest`:

```ts
// fs/io/module.ts (exported via Io)
const bunTestContext: TestContext = {
    test: (name, opts, fn) => nodeTest.test(name, () => inlineTest(name, opts, fn))
}
```

Because `bunTestContext` always passes `inlineContext` to thunks, the child
context `t` in `registerOne` is `inlineContext` on Bun. Any further `Test`
effects emitted with that context call `inlineContext.test`, which runs inline.
No `subCtx` mapping function or extra parameter in `registerModule` is needed —
the context itself carries the policy.

### Wiring

`bunTestContext` is added to `Io` and `NodeProgramOptions`:

```ts
// Io gains:
readonly bunTestContext: TestContext

// NodeProgramOptions gains:
readonly bunTestContext: TestContext
```

`register` in `fs/dev/tf/module.f.ts` selects the root context based on
`engine`:

```ts
export const register: NodeProgram = o =>
    loadModuleMap(o.env)
    .step(m => registerModuleMap(o.engine === 'bun' ? o.bunTestContext : o.testContext, m))
    .step(() => pure(0))
```

`registerModule` and `registerModuleMap` remain unchanged — they take a plain
`TestContext` and use `t` directly. The `test` effect handler in `fromIo` also
stays engine-agnostic. If Bun eventually supports sub-tests natively, only
`register` (and `bunTestContext`) need to change.

## Required change: `TestFn` return type

`bunTestContext.test` and `inlineContext.test` are `async`, so `TestFn` must
declare `Promise<void>` as its return type rather than `void`:

```ts
export type TestFn = (
    name: string,
    options: { readonly expectFailure: boolean },
    fn: (t: TestContext) => Promise<void>
) => Promise<void>
```

## Scope

- `fs/types/effects/node/module.f.ts`: update `TestFn` return type; add `Engine`, `engine`, and `bunTestContext` to `NodeProgramOptions`
- `fs/io/module.f.ts`: add `bunTestContext` to `Io`; `fromIo`'s `test` handler stays engine-agnostic
- `fs/io/module.ts`: define `inlineContext` and `bunTestContext`; detect Bun for `engine`
- `fs/dev/tf/module.f.ts`: `register` selects root context based on `engine`; `registerModule` unchanged

## Related

- [i200](./200-register-module.md) — `registerModule` design; this issue fixes
  the Bun gap left open there
- [i183](./183-tf-framework-scenario-tests.md) — scenario tests that would
  validate Bun behaviour
