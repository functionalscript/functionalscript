# 661-test-runner-behavior. Document behavior of supported test runners

**Priority:** P3
**Status:** open

## Problem

Each supported test runner handles generated tests and expected failures differently.
This is not documented anywhere, leaving contributors uncertain about why the framework
behaves differently across Node, Deno, Bun, and Playwright.

## Proposal

Document the following differences in the relevant README or doc page:

**Sub-test handling**

- **Node** and **Deno**: run generated tests as native sub-tests.
- **Deno** caveat: sub-tests are not counted toward the total test count.
- **Bun** and **Playwright**: do not support sub-tests natively; generated tests are
  run inside a parent test using a special wrapper.

**Expected-to-fail tests**

- **Node** and **Deno**: natively understand tests that are expected to fail.
- **Bun** and **Playwright**: have no awareness of expected-to-fail semantics, so
  such tests are wrapped to emulate the behavior.

## Tasks

- [ ] Identify the right location for this documentation
- [ ] Write the documentation describing the differences above

## Related

- [i155](./155-test-runner-integration.md) — original test runner integration issue
- [i211](./211-reporter-modes.md) — reporter modes, including the Node/Bun/Playwright bridge reporter
