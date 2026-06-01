# 212. Document behavior of supported test runners

**Priority:** P3
**Status:** open

Each supported test runner handles generated tests and expected failures differently.
This should be documented clearly for contributors and users.

## Sub-test handling

- **Node** and **Deno**: run generated tests as native sub-tests.
- **Deno** caveat: sub-tests are not counted toward the total test count.
- **Bun** and **Playwright**: do not support sub-tests natively; generated tests are
  run inside a parent test using a special wrapper.

## Expected-to-fail tests

- **Node** and **Deno**: natively understand tests that are expected to fail.
- **Bun** and **Playwright**: have no awareness of expected-to-fail semantics, so
  such tests are wrapped to emulate the behavior.

## Task

Add documentation (e.g. in a doc page or README section) describing these differences
so contributors and users understand how test generation and failure expectations are
handled for each runner.

## Related

- [i155](./155-test-runner-integration.md) — original test runner integration issue
- [i211](./211-reporter-modes.md) — reporter modes, including the Node/Bun/Playwright bridge reporter
