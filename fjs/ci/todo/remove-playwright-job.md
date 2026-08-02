## remove-playwright-job. Remove the current Playwright CI integration

**Priority:** P1
**Status:** open

### Problem

The current Playwright CI job does not execute FunctionalScript proofs inside Chromium,
Firefox, or WebKit. Playwright loads the proof modules in a Node worker, and
`fjs/effects/node/module.ts` registers each proof with `@playwright/test` but executes the
proof through the Node effect runner.

Running the same Node callbacks under three Playwright browser configurations does not
provide browser-runtime coverage. The callbacks do not request a `page`, load a browser
module graph, or evaluate proof code in a browser realm. The browsers therefore do not
test the FunctionalScript implementation.

Keeping this integration has ongoing costs:

- `@playwright/test` is installed as a repository dependency;
- Playwright entries are retained in npm, Bun, and Deno lockfiles;
- the Node effect runner contains Playwright-specific detection and registration logic;
- CI configuration pins and validates a Playwright version and browser bundle;
- generated workflow and Nix artifacts imply cross-browser coverage that is not present;
- changes to Node test registration must account for a framework adapter that does not
  serve its intended purpose.

### Goal

Remove the current Playwright job, package dependency, Node adapter, and generated
artifacts completely. Browser testing will be reintroduced separately through a test
application that actually loads and runs FunctionalScript modules inside browser realms.

This task is cleanup, not a migration to another browser runner. It may be completed
before the replacement browser-testing task.

### Repository dependency cleanup

Remove `@playwright/test` from `package.json` and regenerate every lockfile so no direct or
transitive entry remains solely because of the removed dependency:

- `package-lock.json`;
- `bun.lock`;
- `deno.lock`.

Do not replace it with `playwright`, `playwright-core`, or another repository-local
browser automation dependency in this task.

Remove the configured Playwright version from `fjs/ci/config/module.f.ts` when it has no
remaining consumer. Remove related update logic and proofs that exist only to keep the
repository package version synchronized with a Nix browser bundle.

### Node effect-runner cleanup

Remove Playwright-specific external-test registration from the Node effect runner,
including:

- `PLAYWRIGHT_TEST` detection;
- the dynamic import of `@playwright/test`;
- `pwTest` and `playwrightTestContext`;
- the Playwright engine branch;
- Playwright-specific `TestContext`, `NodeProgramOptions`, and helper fields;
- proofs and comments that exist only for the Playwright registration path.

Keep Node, Bun, and Deno test behavior unchanged.

If removing the `'playwright'` `Engine` variant or another exported type changes the
published API, add a CHANGELOG entry with the required `**BREAKING CHANGES:**` prefix.
Do not retain a dead compatibility variant solely to avoid documenting the removal.

### CI cleanup

Remove the current Playwright job and everything generated exclusively for it:

- delete `fjs/ci/playwright/module.f.ts`;
- remove its imports and job registration from `fjs/ci/module.f.ts`;
- remove Playwright-specific generator proofs from `fjs/ci/proof.f.ts`;
- regenerate `.github/workflows/ci.yml` without the Playwright job;
- remove the generated Playwright Nix flake and its registration when no other job uses
  it;
- remove Playwright-only environment variables, browser paths, version checks, and Nix
  declarations;
- remove or update documentation and TODO references that describe the current job as
  real browser coverage.

Do not replace the job with browser launch-and-close smoke tests. A smoke test would still
not execute FunctionalScript modules inside the browser and would recreate the same
misleading signal under a different command.

### Separation from future browser testing

The replacement design is tracked by
[../../emergent_testing/todo/browser-testing.md](../../emergent_testing/todo/browser-testing.md).
That task may eventually choose Playwright as an external browser controller, but this
task must not preserve the current `@playwright/test` adapter in anticipation of that
choice.

The future browser test application owns:

- type-erased browser-loadable JavaScript;
- generated HTML and proof-module references;
- the in-browser test runner and UI;
- manual browser execution;
- headless execution and result reporting.

### Validation

After regeneration:

- repository source has no runtime import of `@playwright/test` or `playwright/test`;
- repository source has no `PLAYWRIGHT_TEST` detection;
- `package.json` and all lockfiles contain no removed Playwright dependency;
- the generated workflow has no Playwright job;
- no generated Playwright Nix artifact remains without a consumer;
- Node, Bun, and Deno test registration still works;
- `npx tsc` passes;
- the repository test suite passes;
- `npm run ci-update` produces no uncommitted changes;
- documentation no longer claims that the removed job provided browser-runtime test
  coverage.

### Out of scope

- implementing the replacement browser test page;
- selecting Playwright versus direct headless-browser control;
- building browser-ready JavaScript;
- introducing new browser CI jobs;
- Docker, OCI, cache, or publication design.

### Tasks

- [ ] Remove `@playwright/test` from `package.json`.
- [ ] Regenerate npm, Bun, and Deno lockfiles without Playwright test packages.
- [ ] Remove Playwright version configuration and update logic with no remaining
      consumers.
- [ ] Remove `PLAYWRIGHT_TEST`, the dynamic import, Playwright context, and Playwright
      engine handling from the Node effect runner.
- [ ] Remove or update all affected Node-effect and emergent-testing proofs.
- [ ] Delete the current Playwright CI module and remove its job registration.
- [ ] Remove generated workflow, Nix, environment, and proof artifacts used only by the
      current job.
- [ ] Update stale documentation and TODO links.
- [ ] Add a breaking CHANGELOG entry when exported test-engine APIs change.
- [ ] Regenerate committed files and verify TypeScript, tests, and update checks.

### Related

- [../../emergent_testing/todo/browser-testing.md](../../emergent_testing/todo/browser-testing.md)
  — replacement design that executes proofs inside real browser realms.
