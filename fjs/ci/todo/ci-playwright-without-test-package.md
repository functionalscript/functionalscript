## ci-playwright-without-test-package. Run FunctionalScript tests in browsers through global Playwright

**Priority:** P3
**Status:** open

### Problem

The repository currently pins `@playwright/test` so FunctionalScript proofs can register
with Playwright Test. `fjs/effects/node/module.ts` detects `PLAYWRIGHT_TEST`, dynamically
imports `@playwright/test`, and constructs a Playwright-specific `TestContext`.

That does not satisfy the real browser-testing requirement. Playwright Test executes test
registration and callbacks in Node workers; code runs inside Chromium, Firefox, or WebKit
only when it is explicitly evaluated or loaded in a browser page. The current adapter
therefore runs FunctionalScript proofs under Node while merely selecting a Playwright
browser project.

The repository-local dependency also creates avoidable coupling:

- `npm ci` installs a Playwright package only for this adapter;
- its version must be synchronized manually with the Nix-provided browser bundle;
- a globally or Nix-installed Playwright executable does not make a bare
  `import('@playwright/test')` resolvable from repository modules;
- the general Node effect runner contains Playwright-specific registration logic;
- browser execution depends on a repository dev dependency instead of the globally
  installed execution environment.

### Goal

Remove the repository `@playwright/test` dependency and provide a globally installable
Playwright environment that can run either ordinary Playwright Test or FunctionalScript's
own test runner.

The intended command model is:

```sh
playwright test --browser=firefox
playwright fjs t --browser=firefox
```

The first command delegates to the ordinary Playwright Test runner. The second command
runs FunctionalScript's emergent test runner with the proof functions themselves
executing inside the selected browser.

The same `playwright` installation must own:

- the CLI entry point;
- the Playwright JavaScript API;
- the FunctionalScript browser-runner bridge;
- the matching Chromium, Firefox, and WebKit bundle.

The FunctionalScript repository must not need `@playwright/test`, `playwright`, or another
Playwright package in its own `node_modules`.

### Global CLI integration

Upstream Playwright does not provide an `fjs` subcommand. Add a thin globally installed
wrapper or equivalent packaged entry point named `playwright` that:

- recognizes `playwright fjs ...`;
- delegates existing commands such as `playwright test`, `install`, and `codegen` to the
  underlying Playwright CLI without changing their behavior;
- resolves the Playwright API relative to its own global or Nix package, not relative to
  the repository under test;
- selects the browser from `--browser=chromium`, `--browser=firefox`, or
  `--browser=webkit`;
- returns the FunctionalScript test runner's exit status.

The exact npm package name or Nix wrapper construction may be decided during
implementation. A developer must be able to install one compatible global environment
and run the commands above from a repository that has no Playwright dependency.

Do not replace the removed repository import with another project file that imports
`playwright/test`; that preserves the same module-resolution problem under a different
name.

### Browser-hosted FunctionalScript runner

`playwright fjs t --browser=<browser>` must execute the actual proof functions inside a
page owned by the selected browser. Merely launching the browser and then running
`node ./fjs/module.ts t` is not sufficient.

The simplest architecture is:

1. The Node-side global wrapper discovers the proof modules using the repository's test
   discovery rules.
2. It ensures browser-loadable JavaScript exists for the runner and selected proof
   modules. Browsers must not be asked to parse TypeScript source directly.
3. It starts a loopback-only HTTP server for the generated modules and runner page.
4. It launches the selected Playwright browser and opens the runner page.
5. The page imports a browser-specific FunctionalScript test entry point and the proof
   modules.
6. The emergent test runner executes the proof functions inside the page's JavaScript
   realm.
7. Structured test events and the final pass/fail status are returned to the Node-side
   wrapper for terminal reporting and process exit.
8. The browser, page, and local server are closed on success or failure.

The browser entry point must not import `fjs/effects/node/module.ts` or depend on Node
built-ins. Reuse the pure emergent-testing logic where possible and add only the
browser-specific loading, timing, reporting, and environment adapter required by the
page.

The first implementation may run the suite in one browser context and page. Per-test
browser isolation, parallelism, retries, traces, screenshots, and Playwright-style
fixtures are later improvements unless required for correctness.

### Test discovery and browser compatibility

Preserve the same proof-module and zero-argument-function conventions used by `fjs t`.
The Node-side launcher may perform filesystem discovery, but proof evaluation must occur
inside the browser.

Define how browser-incompatible modules are handled. Do not silently execute them in
Node while reporting them as browser tests. Prefer one of:

- exclude explicitly marked Node-only proof modules from the browser suite; or
- fail with a clear unsupported-environment error when a selected module imports Node-only
  functionality.

The browser job must demonstrate that representative proof code can observe browser
globals and that Firefox, Chromium, and WebKit execute the proof rather than merely
being launched.

### Repository cleanup

After the browser runner is available:

- remove `@playwright/test` from `package.json` and every lockfile;
- remove `PLAYWRIGHT_TEST` detection and the dynamic Playwright Test import from
  `fjs/effects/node/module.ts`;
- remove the Playwright-specific `TestContext`, engine branch, types, comments, and
  proofs from the Node effect runner;
- keep ordinary Node, Bun, and Deno test integrations unchanged;
- remove repository-local and `npx` Playwright invocations from the Playwright CI job.

### Nix environment

The generated Playwright Nix environment must provide the global `playwright` command,
its FunctionalScript bridge, the matching Playwright API, and matching browsers from one
pinned package set.

Compatibility should be structural: the command and browser bundle come from the same
Nix declaration. Do not compare a repository package version with a Nix package version,
because the repository no longer contains a Playwright package.

Keep and validate only environment variables needed by the global launcher. Remove
browser-download suppression when no repository Playwright postinstall can run.

### CI behavior

The Playwright CI workload should run the FunctionalScript browser suite independently
in all three engines:

```sh
playwright fjs t --browser=chromium
playwright fjs t --browser=firefox
playwright fjs t --browser=webkit
```

A build or preparation command may precede these commands when required to produce
browser-loadable JavaScript. That command must be deterministic and owned by the
repository's normal build configuration.

Do not substitute launch-and-close smoke checks. Each command must load and execute the
FunctionalScript proof suite inside the selected browser and fail when a proof fails.

The exact reusable Bash serialization is handled by
[ci-nix-job-script](ci-nix-job-script.md), which depends on this task.

### Validation

Add proofs and CI checks that verify:

- `@playwright/test` and `playwright` are absent from repository dependencies and
  lockfiles;
- repository source contains no runtime import of `@playwright/test` or
  `playwright/test`;
- `PLAYWRIGHT_TEST` detection and the Playwright-specific Node test context are removed;
- a globally installed `playwright test` command still delegates to ordinary Playwright
  Test behavior;
- `playwright fjs t --browser=firefox` discovers the FunctionalScript suite and executes
  representative proof code inside Firefox;
- equivalent commands execute inside Chromium and WebKit;
- browser-side proof code can observe the expected browser realm and cannot accidentally
  pass by executing only in the Node launcher;
- a proof failure produces a nonzero process exit code and readable test output;
- browser-load or module-resolution failures are reported clearly;
- Node-only proof modules are excluded or rejected according to the documented rule;
- no repository-local Playwright package is required after `npm ci`;
- the Nix environment provides the wrapper, API, browsers, and required paths from the
  same pinned declaration;
- `npm run ci-update` leaves no generated changes.

### Out of scope

- duplicating the complete Playwright Test fixture API inside FunctionalScript;
- per-test browser contexts, retries, tracing, screenshots, or parallel workers unless
  needed for the first correct browser runner;
- running TypeScript source directly in browsers without a compilation step;
- Docker, OCI publication, or cache design;
- migrating unrelated CI jobs.

### Tasks

- [ ] Define the global `playwright fjs t --browser=<browser>` command and delegation of
      ordinary Playwright CLI commands.
- [ ] Package the wrapper, Playwright API, and matching browsers as one globally
      installable or Nix-provided environment.
- [ ] Add deterministic generation of browser-loadable JavaScript for the runner and
      proof modules.
- [ ] Add loopback serving and proof-module discovery in the Node-side wrapper.
- [ ] Add a browser-specific FunctionalScript test entry point that executes proofs in
      the page realm and returns structured results.
- [ ] Define and enforce handling of Node-only proof modules.
- [ ] Run the full browser-compatible suite through Chromium, Firefox, and WebKit.
- [ ] Remove `@playwright/test` from repository dependencies and lockfiles.
- [ ] Remove Playwright Test detection, imports, context, and engine handling from the
      Node effect runner.
- [ ] Remove repository-local and `npx` Playwright commands from generated CI.
- [ ] Add delegation, browser-realm, reporting, failure, compatibility, and generated-file
      proofs.
- [ ] Regenerate committed files and confirm all three browser suites pass without a
      repository Playwright dependency.

### Related

- [ci-nix-job-script](ci-nix-job-script.md) — depends on this task and serializes the
  stable browser-hosted workload established here.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — owns the direct-Nix Playwright
  environment being extended.
- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
