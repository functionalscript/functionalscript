## ci-playwright-without-test-package. Run FunctionalScript tests in browsers without a local Playwright dependency

**Priority:** P3
**Status:** open

### Problem

The repository currently pins `@playwright/test` so FunctionalScript proofs can register
with Playwright Test. `fjs/effects/node/module.ts` detects `PLAYWRIGHT_TEST`, dynamically
imports `@playwright/test`, and constructs a Playwright-specific `TestContext`.

This creates avoidable coupling between the repository and the Playwright installation:

- `npm ci` installs Playwright only for the test adapter;
- its version must be synchronized manually with the Nix-provided browser bundle;
- a global or Nix-installed Playwright executable does not make
  `import('@playwright/test')` resolvable from repository modules;
- the general Node effect runner contains Playwright-specific registration logic.

More importantly, selecting a Playwright browser does not by itself prove that
FunctionalScript proof functions execute inside that browser. The requirement is to run
the tests themselves in Chromium, Firefox, and WebKit, not merely to run the test
infrastructure in Node while a browser is available.

### Goal

Remove the repository `@playwright/test` dependency while preserving real cross-browser
execution of FunctionalScript tests.

The implementation may use either:

1. the ordinary Playwright Test runner, for example:

   ```sh
   playwright test --browser=firefox
   ```

2. FunctionalScript's own test runner through a Playwright-hosted adapter, for example:

   ```sh
   playwright fjs t --browser=firefox
   ```

These command shapes are alternatives, not simultaneous requirements. Choose the
simplest implementation that satisfies the browser-execution invariant.

In either design:

- Playwright may use Node for discovery, orchestration, reporting, and browser lifecycle;
- the actual FunctionalScript proof functions selected for the browser suite must execute
  inside the selected browser's JavaScript realm;
- a failing proof must make the command fail;
- the repository must not contain `@playwright/test`, `playwright`, or another Playwright
  package in its own dependencies.

### Browser-execution invariant

The implementation is correct only when representative proof code can demonstrate that
it executes inside Chromium, Firefox, or WebKit.

Acceptable evidence includes browser-only globals or behavior observed from the proof
body itself. Merely launching a browser, creating a page, or evaluating a trivial smoke
expression before running the proof suite in Node is not sufficient.

The controller may perform these operations outside the browser:

- discover proof modules;
- prepare or compile browser-loadable JavaScript;
- start a loopback-only HTTP server;
- launch the selected browser;
- collect structured test events;
- print results and choose the process exit status.

The test functions and recursive return-value test trees must be evaluated inside the
browser.

### Runner alternatives

#### Playwright Test adapter

A globally installed Playwright Test environment may provide an adapter test that:

- discovers or receives the FunctionalScript browser suite;
- opens a page using the selected Playwright browser;
- loads the browser-compatible FunctionalScript runner and proof modules;
- executes the proofs inside the page;
- forwards results to the Playwright Test assertion/reporting lifecycle.

The adapter belongs to the global or Nix Playwright environment. Repository modules must
not import `@playwright/test`.

#### FunctionalScript runner adapter

A global or Nix-provided Playwright wrapper may expose a command such as:

```sh
playwright fjs t --browser=firefox
```

The wrapper may reuse FunctionalScript's own discovery, emergent-test semantics, and
reporting while using Playwright only to host execution inside the selected browser.

Do not require this custom command when the ordinary Playwright Test runner provides a
simpler correct implementation.

### Browser-hosted test execution

The likely shared architecture is:

1. Discover browser-compatible proof modules.
2. Produce browser-loadable JavaScript for the runner and proof modules.
3. Serve those modules over a loopback-only HTTP server or another browser-supported
   loading mechanism.
4. Launch the selected browser and open the runner page.
5. Import the browser test entry point and proof modules in the page.
6. Execute the proof functions and recursive test trees in the page realm.
7. Return structured results to the Node-side controller.
8. Close the browser and temporary resources on success or failure.

The browser entry point must not import `fjs/effects/node/module.ts` or depend on Node
built-ins. Reuse pure emergent-testing logic where practical and add only the
browser-specific loading, timing, reporting, and environment adapter.

The first implementation may use one browser context and page for the suite. Per-test
contexts, retries, traces, screenshots, fixtures, and parallel workers are later
improvements unless needed for correctness.

### Test discovery and compatibility

Preserve the same proof-module and zero-argument-function conventions used by `fjs t`.
Filesystem discovery may occur in Node, but proof evaluation must occur in the browser.

Define explicit handling for browser-incompatible proof modules. Do not silently run
those modules in Node while reporting them as browser tests. Either:

- exclude explicitly marked Node-only proof modules; or
- fail with a clear unsupported-environment error.

### Repository cleanup

After browser-hosted execution is available:

- remove `@playwright/test` from `package.json` and every lockfile;
- remove `PLAYWRIGHT_TEST` detection and the dynamic Playwright Test import from
  `fjs/effects/node/module.ts`;
- remove the Playwright-specific `TestContext`, engine branch, types, comments, and
  proofs from the Node effect runner;
- keep ordinary Node, Bun, and Deno integrations unchanged;
- remove repository-local and `npx` Playwright invocations from CI.

Do not replace the removed import with another repository file that imports
`playwright/test`; that preserves the same module-resolution dependency.

### Global or Nix Playwright environment

The global or Nix environment must provide:

- the selected runner or adapter;
- the Playwright API it uses;
- matching Chromium, Firefox, and WebKit binaries;
- every required path and environment value.

Compatibility should be structural: the runner, API, and browser bundle come from the
same pinned declaration. Do not compare a repository Playwright version with a Nix
version because the repository no longer contains Playwright.

Ordinary upstream Playwright commands should remain usable when a wrapper is introduced.
A wrapper is unnecessary when the global Playwright Test command can host the adapter
directly.

### CI behavior

Run the FunctionalScript browser suite independently in Chromium, Firefox, and WebKit
using the stable command selected by this task.

For example, the final workload may be either:

```sh
playwright test --browser=chromium
playwright test --browser=firefox
playwright test --browser=webkit
```

or:

```sh
playwright fjs t --browser=chromium
playwright fjs t --browser=firefox
playwright fjs t --browser=webkit
```

A deterministic preparation command may precede these commands when browser-loadable
JavaScript must be generated.

Do not run both forms unless they validate distinct behavior. Do not substitute
launch-and-close smoke tests or Node-only `fjs t` execution.

The exact reusable Bash serialization is handled by
[ci-nix-job-script](ci-nix-job-script.md), which depends on this task.

### Validation

Add proofs and CI checks that verify:

- `@playwright/test` and `playwright` are absent from repository dependencies and
  lockfiles;
- repository source contains no runtime import of `@playwright/test` or
  `playwright/test`;
- `PLAYWRIGHT_TEST` detection and the Playwright-specific Node test context are removed;
- the chosen global command works without repository Playwright packages;
- representative proof bodies execute inside Firefox, Chromium, and WebKit;
- browser-side proof code cannot accidentally pass by executing only in Node;
- proof failures produce a nonzero process exit code and readable output;
- browser loading and module-resolution failures are reported clearly;
- Node-only proof modules are excluded or rejected according to the documented rule;
- the Nix environment provides the runner, API, browsers, and paths from the same pinned
  declaration;
- `npm run ci-update` leaves no generated changes.

### Out of scope

- requiring both Playwright Test and a custom FunctionalScript runner;
- duplicating the complete Playwright Test fixture API inside FunctionalScript;
- per-test browser contexts, retries, tracing, screenshots, or parallel workers unless
  required for correctness;
- running TypeScript source directly in browsers without preparation;
- Docker, OCI publication, or cache design;
- migrating unrelated CI jobs.

### Tasks

- [ ] Choose the simplest browser-hosted runner: a global Playwright Test adapter or a
      FunctionalScript runner adapter.
- [ ] Define the stable global command for selecting Chromium, Firefox, and WebKit.
- [ ] Package the runner or adapter, Playwright API, and matching browsers in one global
      or Nix-provided environment.
- [ ] Add deterministic preparation of browser-loadable JavaScript.
- [ ] Add browser-side proof execution and structured result transport.
- [ ] Preserve FunctionalScript proof discovery and recursive test semantics.
- [ ] Define and enforce handling of Node-only proof modules.
- [ ] Run the browser-compatible suite inside Chromium, Firefox, and WebKit.
- [ ] Remove `@playwright/test` from repository dependencies and lockfiles.
- [ ] Remove Playwright-specific detection, imports, context, and engine handling from
      the Node effect runner.
- [ ] Remove repository-local and `npx` Playwright commands from generated CI.
- [ ] Add browser-realm, failure, reporting, compatibility, and generated-file proofs.
- [ ] Regenerate committed files and confirm all three browser suites pass without a
      repository Playwright dependency.

### Related

- [ci-nix-job-script](ci-nix-job-script.md) — depends on this task and serializes the
  selected browser-hosted workload.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — owns the direct-Nix Playwright
  environment being extended.
- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
