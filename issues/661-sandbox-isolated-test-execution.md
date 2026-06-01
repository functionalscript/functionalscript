# 661-sandbox-isolated-test-execution. fjs t runs generated tests in an isolated sandbox

**Priority:** P3
**Status:** open

## Problem

fjs `t` (the FunctionalScript test runner) differs fundamentally from most
popular test runners (Node `node:test`, Deno, Bun, Vitest, Jest) in how it
executes generated and sub-tests:

- **fjs `t`**: each generated test is run in its own **separate sandbox** — an
  isolated execution context. Tests cannot share mutable state with each other
  or with the parent test. Because generated tests are fully independent, they
  are only scheduled **after the parent test succeeds**, and the runner has
  full control over when (and whether) to execute them.
- **Most other runners**: if the framework supports sub-tests, generated tests
  are **registered** inside the parent test (same process/context, parent's
  scope directly accessible). If the framework has no sub-test support, the
  generated test is simply **run inline** inside the parent. Either way,
  execution is driven by the parent, not the runner.

This architectural difference has practical consequences that contributors and
users need to be aware of when comparing behaviour or porting tests between
runners.

## Convention vs. runner

These properties — isolation, independence, deferred scheduling — are not
accidents of implementation. The FunctionalScript **test conventions** are
deliberately designed so that generated tests carry all of them. `fjs t` is
built to honour those conventions and therefore exposes all the benefits.

When the same test suite is run through an older or conventional runner
(Node `node:test`, Deno, Bun, etc.), that runner has no knowledge of the
conventions: it executes generated tests inline, inside the parent, and the
properties are silently lost. The tests still pass or fail, but isolation,
ordering guarantees, and runner-controlled scheduling are no longer in effect.

## Key differences

| Aspect | fjs `t` | Typical runners (Node, Deno, Bun, Vitest…) |
|---|---|---|
| Generated test execution context | Isolated sandbox per test | Inside the parent test |
| Shared mutable state between tests | Not possible by design | Possible (and common) |
| Side-effects from one test leaking to another | Prevented | Must be managed manually |
| Test isolation overhead | Higher (sandbox setup per test) | Lower |
| Parallelism safety | Inherent | Requires explicit care |
| Generated tests are independent top-level tests | Yes — scheduled after parent succeeds | No — registered as sub-tests (if supported) or run inline inside the parent |
| Runner controls when generated tests run | Yes — runner decides scheduling | No — execution is dictated by the parent test |

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
- [ ] Write a short explanation of the sandbox model and how it contrasts with in-test sub-test execution
- [ ] Add a note in the test-runner comparison table (see [i661](./661-test-runner-behavior.md))

## Related

- [i661](./661-test-runner-behavior.md) — documents other behavioural differences across supported test runners
- [i65Y-sandbox-await-overhead](./65Y-sandbox-await-overhead.md) — performance work inside the sandbox
