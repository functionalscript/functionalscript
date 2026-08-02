## ci-playwright-without-test-package. Remove the repository Playwright Test dependency

**Priority:** P3
**Status:** open

### Problem

The repository currently pins `@playwright/test` only so FunctionalScript proofs can
register themselves with Playwright Test. `fjs/effects/node/module.ts` detects
`PLAYWRIGHT_TEST`, dynamically imports `@playwright/test`, and constructs a
Playwright-specific `TestContext`.

This creates unnecessary coupling:

- `npm ci` must install a Playwright Test package even though Nix already owns the
  Playwright browser environment;
- the repository package version must be kept synchronized with Nixpkgs'
  `playwright-driver` browser bundle;
- a globally or Nix-installed Playwright executable does not make the bare
  `import('@playwright/test')` resolvable from repository modules;
- the general Node effect runner contains Playwright-specific detection and adapter
  code;
- Playwright Test becomes a second test framework even though FunctionalScript already
  has the self-hosted emergent test runner used by `fjs t`.

The current FunctionalScript registrations do not request Playwright's `browser`,
`context`, or `page` fixtures. Playwright Test therefore provides test registration,
scheduling, and reporting, but the proofs themselves still execute in Node workers.
Do not preserve that dependency merely to keep the same external reporter.

### Goal

Remove `@playwright/test` from the repository and use FunctionalScript's own emergent
test runner for FunctionalScript proofs.

After this task:

- `package.json` and all package-manager lockfiles contain no `@playwright/test`
  dependency;
- `fjs/effects/node/module.ts` does not import Playwright Test or branch on
  `PLAYWRIGHT_TEST`;
- the Node effect runner no longer exposes a Playwright-specific test context or engine;
- FunctionalScript proofs in the Playwright CI job run through the same self-hosted
  runner as `fjs t`;
- the Nix Playwright environment owns the Playwright executable/API and its matching
  Chromium, Firefox, and WebKit bundle;
- browser validation launches each Nix-provided browser without resolving a Playwright
  package from the repository.

Keep FunctionalScript proof execution and browser validation explicit and separate.
This task does not claim that `fjs t` proof functions execute inside browser pages.

### Repository test runner

Reuse the self-hosted path already implemented by the emergent test runner instead of
registering proofs with Playwright Test.

Remove the Playwright-specific adapter from the general Node runtime, including the
corresponding forms of:

```ts
const isPlaywright = 'PLAYWRIGHT_TEST' in process.env
const pwTest = await import('@playwright/test')
const playwrightTestContext = wrapInlineTest(pwTest.test)
```

Update the related types, engine selection, comments, and proofs so the remaining
external-framework integration describes only frameworks that are still supported.
Do not replace the removed import with another repository module that imports
`playwright/test`; that has the same package-resolution dependency under a different
filename.

### Nix-owned browser validation

The generated Playwright Nix environment must provide everything needed to validate the
browser bundle:

- a Playwright executable or small wrapper supplied by the Nix environment;
- the matching Playwright JavaScript package used by that executable or wrapper;
- the matching `playwright-driver` browsers;
- any environment values required to locate and launch those browsers.

Prefer deriving the Playwright package and browser bundle from the same pinned Nixpkgs
package set so compatibility is structural rather than checked against a duplicated
version literal.

The browser-validation command must be owned by the Nix environment, where its
Playwright import resolves relative to the Nix package. It may use an existing
Playwright CLI operation when that reliably launches a browser, or a minimal wrapper
that launches and closes the selected browser. Do not require repository code to import
a globally installed package.

Validate Chromium, Firefox, and WebKit independently. A successful command must prove
that the selected Nix-provided browser can actually start and stop; listing installed
files or printing a package version is not sufficient.

Remove Playwright environment values that existed only for the npm-installed package,
such as browser-download suppression, when they are no longer required. Keep and
validate values still needed by the Nix-owned launcher, such as the browser bundle path
or host-platform override.

### CI behavior

The Playwright job should use the repository-independent test runner and Nix-owned
browser validation in this order:

1. install ordinary repository dependencies with `npm ci`;
2. run FunctionalScript proofs with the same self-hosted runner used by `fjs t`;
3. launch and close Chromium, Firefox, and WebKit through the Nix Playwright
   environment.

The job must not invoke `npx playwright`, load `@playwright/test` from `node_modules`, or
compare a repository Playwright version with a Nix version.

The exact reusable Bash serialization is handled by
[ci-nix-job-script](ci-nix-job-script.md), which depends on this task. This task
establishes the stable commands and ownership boundaries first.

### Validation

Add proofs and CI checks that verify:

- `@playwright/test` is absent from `package.json` and package-manager lockfiles;
- repository source contains no runtime import of `@playwright/test` or
  `playwright/test`;
- the `PLAYWRIGHT_TEST` detection branch and Playwright-specific `TestContext` are
  removed;
- TypeScript checks and the ordinary `fjs t` suite pass without a Playwright npm
  dependency;
- `npm ci` does not download Playwright browsers;
- the Playwright Nix environment provides the browser-validation executable and every
  required path or environment value;
- Chromium, Firefox, and WebKit each launch and close successfully from the
  Nix-provided browser bundle;
- a missing or incompatible Playwright browser environment fails browser validation;
- the Playwright CI job contains no `npx playwright` or repository-local Playwright
  invocation.

Regenerate committed CI files and verify `npm run ci-update` produces no uncommitted
changes.

### Out of scope

- executing FunctionalScript proof modules inside browser pages;
- designing a general browser-hosted `fjs t` protocol;
- retaining Playwright Test solely for its reporter, retries, fixtures, or scheduler;
- generating `ci.sh` or `check.sh`; that belongs to the dependent script task;
- Docker, OCI images, publication, or cache design;
- migrating unrelated CI jobs.

### Tasks

- [ ] Remove `@playwright/test` from `package.json` and every lockfile.
- [ ] Remove the dynamic Playwright Test import and `PLAYWRIGHT_TEST` detection from the
      Node effect runner.
- [ ] Remove the Playwright-specific test context, engine branch, related types,
      comments, and proofs.
- [ ] Run FunctionalScript proofs in the Playwright job through the self-hosted runner
      used by `fjs t`.
- [ ] Make the Nix Playwright environment provide a matching Playwright launcher and
      browser bundle from the same pinned package set.
- [ ] Add Nix-owned launch-and-close validation for Chromium, Firefox, and WebKit.
- [ ] Remove environment values that were needed only by the npm Playwright package and
      validate every value still required by the Nix-owned launcher.
- [ ] Remove repository-local and `npx` Playwright commands from generated CI.
- [ ] Add dependency-removal, runner, browser-launch, and generated-file proofs.
- [ ] Regenerate committed files and confirm TypeScript, `fjs t`, direct Nix browser
      validation, and generated-file checks pass.

### Related

- [ci-nix-job-script](ci-nix-job-script.md) — depends on this task and serializes
  the stable workload established here.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — owns the direct-Nix Playwright
  environment being simplified.
- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
