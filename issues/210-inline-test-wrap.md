# 210. `io`: factor the `inlineTest` wrap for `bunTestContext` / `playwrightTestContext`

**Priority:** P3
**Status:** open

`fs/io/module.ts` defines two test-context bridges that are line-for-line
identical except for which framework's `test` function they delegate to:

```ts
// fs/io/module.ts:31-37
const bunTestContext: TestContext = {
    test: (name, opts, fn) => testContext.test(name, () => inlineTest(name, opts, fn))
}

const playwrightTestContext: TestContext = {
    test: (name, opts, fn) => pwTest!(name, () => inlineTest(name, opts, fn))
}
```

The shape is exactly `(name, opts, fn) => REG(name, () => inlineTest(name, opts, fn))`.
Only `REG` differs (`testContext.test` from `node:test`, or `pwTest` from
`@playwright/test`). Both wrappers exist because their respective frameworks
do not implement the `expectFailure` / nested-test semantics that
`fs/dev/tf/module.f.ts` relies on, so all test bodies are routed through
the shared `inlineTest` thunk ([i201](./201-bun-inline-context.md),
[i202](./202-playwright-context.md), [i203](./203-node22-expectfailure.md)).

## Proposed abstraction

Lift the wrap into a single named helper, parameterised by the framework's
register function:

```ts
// fs/io/module.ts
type FrameworkRegister = (name: string, fn: () => unknown) => void

const wrapInlineTest = (register: FrameworkRegister): TestContext => ({
    test: (name, opts, fn) => register(name, () => inlineTest(name, opts, fn))
})

const bunTestContext        = wrapInlineTest(testContext.test)
const playwrightTestContext = wrapInlineTest(pwTest!)
```

Three lines per bridge collapse to one each, and the shared structure has a
name that ties it to the `inlineTest` strategy.

## Why this qualifies

- DRY with two real consumers (Bun and Playwright bridges) — already past
  the second-consumer bar in `AGENTS.md`. Node 22 was a third (retired in
  [i203](./203-node22-expectfailure.md)); if i203's wrap-on-Node-22 option
  is ever revisited, it would be a third instance of the same shape.
- Names the strategy. Today the wrap is anonymous; new contributors must
  cross-reference [i201](./201-bun-inline-context.md) /
  [i202](./202-playwright-context.md) /
  [i203](./203-node22-expectfailure.md) to learn *why* both wrappers exist
  and what they share. `wrapInlineTest` makes the intent visible at the
  definition site.
- Lowers the cost of adding a third framework bridge (Deno's `Deno.test`,
  or a future runner) to one line.

## Caveats

- `pwTest` is `undefined` outside Playwright runs and used here as `pwTest!`.
  The factory must keep the same non-null assertion at the call site —
  `wrapInlineTest(pwTest!)` — rather than accept a nullable `register` and
  hide the assumption.
- `testContext` is the namespace import of `node:test`; `testContext.test`
  is the actual `TestFn` value. The factory takes the function, not the
  namespace, so the call sites pre-extract `.test` and stay explicit about
  which symbol they bind.
- The helper lives in `fs/io/module.ts` (it is `.ts`, not `.f.ts`, since it
  references `inlineTest` which uses `try/catch`). It does **not** belong
  in `fs/types/effects/node/` or `fs/dev/tf/`: those are pure
  FunctionalScript modules and cannot import the framework adapters.
- Behaviour-preserving. The wrap shape is byte-equivalent across both
  bridges today; the factory does not change semantics.

## Related

- [i201](./201-bun-inline-context.md) — introduced `bunTestContext` and the
  `inlineTest` strategy.
- [i202](./202-playwright-context.md) — restored `playwrightTestContext`
  using the same pattern.
- [i203](./203-node22-expectfailure.md) — noted that Node 22 could have
  been kept with the same wrap.
- [i200](./200-register-module.md) — `registerModule` is what the bridges
  ultimately feed into.
