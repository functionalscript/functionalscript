# 201. Bun sub-test fix: `inlineContext`

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

## Proposed solution: `inlineContext`

Add `inlineContext: TestContext` to `fs/types/effects/node/module.f.ts`.
`inlineContext` runs sub-tests **inline** (directly awaiting them in sequence)
rather than delegating to an external framework for scheduling:

```ts
// fs/io/module.ts
const inlineContext: TestContext = {
    test: async (_name, { expectFailure }, fn) => {
        if (expectFailure) {
            try { await fn(inlineContext) } catch { return }
            throw new Error('expected to throw')
        } else {
            await fn(inlineContext)
        }
    }
}
```

`inlineContext` is just a `TestContext` — `module.f.ts` does not need to know
how it is implemented. The async/await lives entirely inside `module.ts`, where
it is already allowed. No conversion to Effects is needed.

Because every registered thunk receives `inlineContext` when called, any
sub-tests it tries to register are also run inline — recursively, with no
external framework involvement below the top level.

### Wiring

`inlineContext` is added to `Io` and passed through `NodeProgramOptions`:

```ts
// Io gains:
readonly inlineContext: TestContext

// NodeProgramOptions gains:
readonly inlineContext: TestContext
```

The `test` effect handler in `fromIo` stays engine-agnostic — it is a low-level
primitive and should not contain routing logic:

```ts
test: async (ctx, name, expectFailure, test) =>
    ctx.test(name, { expectFailure }, async t => result(test(t))),
```

The engine decision lives in `registerModule` in `fs/dev/tf/module.f.ts`. When
building sub-test registrations, it uses `options.inlineContext` instead of the
framework-provided `t` when `options.engine === 'bun'`:

```ts
// inside registerOne thunk:
const subCtx = options.engine === 'bun' ? options.inlineContext : t
return all(...sub.map(e => registerOne(subCtx, e))).step(() => pure(undefined))
```

This means: if Bun eventually supports sub-tests natively, only `registerModule`
changes — the `test` effect and `fromIo` are untouched.

## Required change: `TestFn` return type

`inlineContext.test` is `async`, so `TestFn` must declare `Promise<void>` as
its return type rather than `void`:

```ts
export type TestFn = (
    name: string,
    options: { readonly expectFailure: boolean },
    fn: (t: TestContext) => Promise<void>
) => Promise<void>
```

This is a narrowing of the current signature (callers that already return
`Promise<void>` are unaffected).

## Scope

- `fs/types/effects/node/module.f.ts`: update `TestFn` return type; add `Engine`, `engine`, and `inlineContext` to `NodeProgramOptions`
- `fs/io/module.f.ts`: add `inlineContext` to `Io`; `fromIo`'s `test` handler stays engine-agnostic
- `fs/io/module.ts`: define `inlineContext`, detect Bun for `engine`
- `fs/dev/tf/module.f.ts`: `registerModule` reads `options.engine` and `options.inlineContext` to select the sub-test context

## Related

- [i200](./200-register-module.md) — `registerModule` design; this issue fixes
  the Bun gap left open there
- [i183](./183-tf-framework-scenario-tests.md) — scenario tests that would
  validate Bun behaviour
