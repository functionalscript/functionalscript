## remove-playwright-job. Remove the current Playwright CI integration

**Priority:** P1
**Status:** open

### Problem

The current Playwright CI job does not execute FunctionalScript proofs inside Chromium,
Firefox, or WebKit. Playwright loads the proof modules in a Node worker, and
`fjs/effects/node/module.ts` registers each proof with `@playwright/test` but executes the
proof through the Node effect runner.

Running the same Node callbacks under three browser configurations does not provide
browser-runtime coverage. The callbacks do not request a page, load a browser module
graph, or evaluate proof code in a browser realm.

Keeping this integration has ongoing costs:

- `@playwright/test` is installed as a repository dependency;
- Playwright entries remain in npm, Bun, and Deno lockfiles;
- the general Node effect runner contains Playwright-specific registration logic;
- CI pins and validates a Playwright version and browser bundle;
- generated workflow and Nix artifacts imply browser coverage that is not present.

### Goal

Remove the current ineffective Playwright job, local package dependency, Node test
adapter, and generated artifacts.

This task does not prohibit a future correct Playwright runner. The replacement browser
architecture may later support:

```sh
playwright test --project=firefox
```

through a dedicated adapter that dynamically loads `playwright/test` from the external
Playwright installation and opens the shared browser test application.

The distinction is:

- remove Playwright-specific behavior from the general Node effect runner;
- remove Playwright packages from repository dependencies;
- permit an optional, isolated future adapter that resolves external Playwright at
  runtime and actually runs proofs inside the browser.

This cleanup may be completed before the replacement browser-testing task.

### Repository dependency cleanup

Remove `@playwright/test` from `package.json` and regenerate:

- `package-lock.json`;
- `bun.lock`;
- `deno.lock`.

Do not replace it with `playwright`, `playwright-core`, or another repository-local
browser automation dependency.

Remove the configured repository Playwright version from `fjs/ci/config/module.f.ts` when
it has no remaining consumer. Remove update logic and proofs used only to synchronize the
local package with a Nix browser bundle.

A future Playwright runner should obtain its runner, API, and matching browsers from one
external or Nix-provided installation rather than synchronizing that installation with a
repository `devDependency`.

### Node effect-runner cleanup

Remove the current Playwright-specific external-test registration from the Node effect
runner, including:

- `PLAYWRIGHT_TEST` detection;
- the dynamic import of `@playwright/test` from `fjs/effects/node/module.ts`;
- `pwTest` and `playwrightTestContext`;
- the Playwright engine branch;
- Playwright-specific `TestContext`, `NodeProgramOptions`, and helper fields;
- proofs and comments that exist only for that registration path.

Keep Node, Bun, and Deno behavior unchanged.

Do not move the same dynamic import into another general runtime module. A future
Playwright Test adapter must be isolated under the browser-testing implementation and
must share the browser application/controller code described there.

If removing the exported `'playwright'` engine variant or another public type changes the
published API, add a CHANGELOG entry with the required `**BREAKING CHANGES:**` prefix.

### CI cleanup

Remove the current Playwright job and artifacts generated exclusively for it:

- delete `fjs/ci/playwright/module.f.ts`;
- remove its imports and job registration from `fjs/ci/module.f.ts`;
- remove Playwright-specific generator proofs from `fjs/ci/proof.f.ts`;
- regenerate `.github/workflows/ci.yml` without the current job;
- remove the generated Playwright Nix flake and registration when no other task consumes
  them;
- remove Playwright-only environment variables, browser paths, local version checks, and
  declarations;
- update documentation that describes the job as browser coverage.

Do not replace it with browser launch-and-close smoke tests.

A later browser CI job may use either `fjs browser-test` or `playwright test ...`, but it
must load the generated HTML/JavaScript application and execute proof bodies inside the
selected browser.

### Separation from replacement browser testing

The replacement is tracked by
[../../emergent_testing/todo/browser-testing.md](../../emergent_testing/todo/browser-testing.md).
It defines three runners over the same browser-side test system:

1. an HTML page opened directly and integrated into the FunctionalScript website;
2. `fjs browser-test`, implemented without Playwright;
3. `playwright test ...`, using a dedicated adapter that dynamically resolves external
   `playwright/test`.

This cleanup removes only the current misleading integration. It must not constrain the
replacement task to one runner.

### Validation

After regeneration:

- the general Node effect runner has no Playwright detection, import, context, or engine
  branch;
- `package.json` and lockfiles have no repository Playwright dependency;
- the generated workflow has no current Playwright job;
- no generated Playwright Nix artifact remains without a consumer;
- Node, Bun, and Deno test registration still works;
- documentation no longer claims that the removed job provides browser-runtime coverage;
- `npx tsc`, the repository tests, and `npm run ci-update` pass.

Validation should not ban all future mentions or dynamic loading of `playwright/test`.
The replacement task may add one isolated optional adapter, provided:

- Playwright remains absent from repository dependencies;
- the adapter resolves it from the external installation;
- no Playwright code enters the browser-side runner;
- proofs execute inside the browser page;
- the adapter shares the browser application and common controller code with
  `fjs browser-test`.

### Out of scope

- implementing the replacement browser application;
- implementing any of the three future runners;
- choosing the future CI runner;
- building browser-ready JavaScript;
- Docker, OCI, cache, or publication design.

### Tasks

- [ ] Remove `@playwright/test` from `package.json`.
- [ ] Regenerate npm, Bun, and Deno lockfiles without local Playwright packages.
- [ ] Remove Playwright version configuration and update logic with no remaining
      consumers.
- [ ] Remove `PLAYWRIGHT_TEST`, the dynamic import, Playwright context, and Playwright
      engine handling from the Node effect runner.
- [ ] Remove or update affected Node-effect and emergent-testing proofs.
- [ ] Delete the current Playwright CI module and job registration.
- [ ] Remove generated workflow, Nix, environment, and proof artifacts used only by the
      current job.
- [ ] Update stale documentation and TODO links.
- [ ] Add a breaking CHANGELOG entry when exported test-engine APIs change.
- [ ] Regenerate committed files and verify TypeScript, tests, and update checks.

### Related

- [../../emergent_testing/todo/browser-testing.md](../../emergent_testing/todo/browser-testing.md)
  — replacement design with direct HTML, no-Playwright FunctionalScript, and external
  Playwright Test runners.
