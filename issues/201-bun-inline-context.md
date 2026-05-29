# 201. Bun sub-test fix: `inlineContext`

## Problem

Bun provides `node:test` but does not support `t.test()` (sub-tests registered
inside a test callback). When `register` ([i200](./200-register-module.md)) runs
under Bun, any `Test` effect that tries to register a sub-test via the `t`
context passed to its thunk throws:

```
NotImplementedError: test() inside another test() is not yet implemented in Bun.
Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/5090.
Use `bun:test` in the interim.
code: "ERR_NOT_IMPLEMENTED"
```

## Why eager flat registration doesn't work

The obvious workaround — scan all tests statically and register them flat at the
top level — fails because **leaves can only be identified by executing the test
function**. A function `fn` may return a plain value (leaf) or an object with
further test entries (sub-tree). That shape is only known after `fn()` runs.
Static traversal via `collectTests` can walk the module's static object/array
structure, but any depth that comes from a function's return value is opaque
until execution.

## Proposed solution: `inlineContext`

Add `inlineContext: TestContext` to `fs/types/effects/node/module.f.ts`.
`inlineContext` runs sub-tests **inline** (directly awaiting them in sequence)
rather than delegating to an external framework for scheduling:

```ts
export const inlineContext: TestContext = {
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

Because every registered thunk receives `inlineContext` when called, any
sub-tests it tries to register are also run inline — recursively, with no
external framework involvement below the top level.

Bun detection and the corresponding root `TestContext` live in
`fs/io/module.ts` (the only `module.ts` file that is allowed to contain
runtime-specific detection):

```ts
const isBun = typeof Bun !== 'undefined'
const bunTestContext: TestContext = {
    test: (name, opts, fn) => nodeTest.test(name, opts, _t => fn(inlineContext))
}
// in io object:
testContext: isBun ? bunTestContext : nodeTest,
```

`bunTestContext` registers each top-level test with Bun's native `nodeTest.test`
(so Bun sees and schedules the test), but passes `inlineContext` — not `t` — to
the thunk. Sub-tests inside the thunk then execute inline.

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

- `fs/types/effects/node/module.f.ts`: add `inlineContext`, update `TestFn`
- `fs/io/module.ts`: add Bun detection, provide `bunTestContext`
- No changes to `NodeProgramOptions`, `Io`, `fromIo`, or `fs/dev/tf/module.f.ts`

## Related

- [i200](./200-register-module.md) — `registerModule` design; this issue fixes
  the Bun gap left open there
- [i183](./183-tf-framework-scenario-tests.md) — scenario tests that would
  validate Bun behaviour
