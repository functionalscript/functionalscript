# 661-sandbox-isolated-test-execution. fjs t runs generated tests in an isolated sandbox

**Priority:** P3
**Status:** open

## Problem

fjs `t` (the FunctionalScript test runner) differs fundamentally from other
supported runners (Node `node:test`, Deno, Bun, Playwright) in how it executes
generated tests:

- **fjs `t`**: each generated test runs in its own **isolated sandbox** —
  a separate execution context with no shared mutable state. Generated tests are
  scheduled by the runner **after the parent test succeeds**.
- **Node / Deno** (native sub-test support): a sub-test starts executing as soon
  as `t.test(...)` is called inside the parent. The parent drives when and
  whether each child runs. With `await t.test(...)` the parent waits for the
  child before continuing; without `await` the child may run concurrently, but
  the parent is still not considered complete until all its sub-tests finish.
  The parent's scope is directly accessible to child tests.
- **Bun / Playwright** (no sub-test support): generated tests are run inline
  inside the parent test using a compatibility wrapper. The parent's scope is
  accessible and execution is driven by the parent.

## Convention vs. runner

Isolation, independence, and deferred scheduling are deliberate properties of
the FunctionalScript test conventions. `fjs t` is built to honour them.

When the same test suite runs through Node, Deno, Bun, or Playwright, those
runners have no knowledge of the conventions. Generated tests execute inside
the parent, and the isolation and scheduling guarantees are silently lost. Tests
still pass or fail correctly, but the sandbox properties no longer apply.

## Key differences

| Aspect | fjs `t` | Node / Deno | Bun / Playwright |
|---|---|---|---|
| Sub-test support | N/A (sandbox model) | Yes | No |
| Generated test execution context | Isolated sandbox | Sub-test inside parent, started when `t.test()` is called | Inline inside parent (wrapper) |
| Who controls when generated tests run | Runner — after parent succeeds | Parent — at the `t.test()` call site | Parent — at the call site |
| Shared mutable state between tests | Not possible by design | Possible | Possible |
| Side-effects leaking between tests | Prevented | Must be managed manually | Must be managed manually |

## Proposal

Document this distinction clearly in the relevant README or developer guide so
that:

1. Contributors understand why fjs `t` output may differ from other runners for
   the same test suite.
2. Users porting tests know that state shared via closure in other runners must
   be made pure/functional for fjs `t`.
3. The design rationale (functional purity, no shared mutable state) is
   explained alongside the behavioural difference.

## Tasks

- [ ] Identify the right location for this documentation (README, AGENTS.md, or a dedicated doc page)
- [ ] Write a short explanation of the sandbox model and how it contrasts with sub-test and inline execution
- [ ] Add a note in the test-runner comparison table (see [i661](./661-test-runner-behavior.md))

## Related

- [i661](./661-test-runner-behavior.md) — documents other behavioural differences across supported test runners
- [i65Y-sandbox-await-overhead](./65Y-sandbox-await-overhead.md) — performance work inside the sandbox
