# 662-sandbox-isolated-test-execution. fjs t runs generated tests in an isolated sandbox

**Priority:** P3
**Status:** open

## Problem

fjs `t` (the FunctionalScript test runner) differs fundamentally from most
popular test runners (Node `node:test`, Deno, Bun, Vitest, Jest) in how it
executes generated and sub-tests:

- **fjs `t`**: each generated test is run in its own **separate sandbox** — an
  isolated execution context. Tests cannot share mutable state with each other
  or with the parent test.
- **Most other runners**: sub-tests and generated tests are executed **inside**
  the parent test, in the same process/context. The parent's scope is directly
  accessible to child tests.

This architectural difference has practical consequences that contributors and
users need to be aware of when comparing behaviour or porting tests between
runners.

## Key differences

| Aspect | fjs `t` | Typical runners (Node, Deno, Bun, Vitest…) |
|---|---|---|
| Generated test execution context | Isolated sandbox per test | Inside the parent test |
| Shared mutable state between tests | Not possible by design | Possible (and common) |
| Side-effects from one test leaking to another | Prevented | Must be managed manually |
| Test isolation overhead | Higher (sandbox setup per test) | Lower |
| Parallelism safety | Inherent | Requires explicit care |

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
