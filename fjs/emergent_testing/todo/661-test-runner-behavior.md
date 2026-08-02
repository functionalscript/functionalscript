## 661-test-runner-behavior. Document behavior of supported test runners

**Priority:** P3
**Status:** open

### Problem

Each supported test runner handles generated tests and expected failures differently.
This is not documented anywhere, leaving contributors uncertain about why the framework
behaves differently across `fjs t`, Node, Deno, and Bun.

The current Node-side Playwright wrapper is being removed because it does not execute
proofs inside browsers. Do not document that wrapper as supported behavior or preserve it
for consistency with the surviving external runners.

Browser execution is a separate architecture: the shared HTML/JavaScript application runs
proofs inside the browser realm, while `fjs browser-test` or an optional Playwright Test
adapter controls that application and consumes its shared report.

### Proposal

Document the following differences in the relevant README or doc page.

**Sub-test handling**

- **`fjs t`**: recursively runs generated proof sub-trees through the FunctionalScript
  runner and reporter.
- **Node** and **Deno**: run generated tests as native sub-tests.
- **Deno** caveat: sub-tests are not counted toward the total test count.
- **Bun**: does not support the same native sub-test model; generated tests are run inside
  a parent test using the surviving Bun wrapper.
- **Browser application**: recursively runs proof sub-trees inside the page and records
  them in the shared `BrowserTestReport`; it does not register each proof through a
  Node-side Playwright wrapper.

**Expected-to-fail tests**

- **`fjs t`**: applies FunctionalScript's expected-failure semantics directly.
- **Node** and **Deno**: natively understand tests that are expected to fail.
- **Bun**: has no equivalent native awareness, so the Bun adapter wraps the test to
  emulate the behavior.
- **Browser application**: applies the same FunctionalScript semantics inside the browser
  runner and reports the normalized result to either the HTML UI, `fjs browser-test`, or
  the optional Playwright Test adapter.

The optional Playwright Test adapter may provide browser lifecycle and Playwright
reporting, but it must not recreate the removed per-proof Node registration path.

### Tasks

- [ ] Identify the right location for this documentation.
- [ ] Document `fjs t`, Node, Deno, and Bun behavior without mentioning the removed
      Playwright wrapper as a supported runner.
- [ ] Link to [browser-testing](browser-testing.md) for the separate in-browser execution
      and reporting model.
- [ ] Ensure future Playwright documentation describes the shared browser application,
      not Node-side execution of proof callbacks.

### Related

- i155 — original external test-runner integration issue.
- [i211](todo.md) — reporter modes for the CLI and surviving external-runner bridges.
- [browser-testing](browser-testing.md) — browser-native execution shared by the HTML UI,
  `fjs browser-test`, and an optional external Playwright Test adapter.
- [remove-playwright-job](../../ci/todo/remove-playwright-job.md) — removal of the obsolete
  Node-side Playwright bridge.
