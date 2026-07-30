## Synchronize Playwright package and CI versions

**Priority:** P2
**Status:** open

### Problem

The Playwright version in `fjs/ci/config/module.f.ts`, the repository-local
`@playwright/test` dependency, its lockfiles, and a future Nix browser bundle can
drift independently.

A mismatched Playwright package and browser bundle may require different browser
revisions and break CI.

### Requirement

Treat the configured CI Playwright version as one coordinated version.

When the root `package.json` already contains `@playwright/test`:

- use the same exact `=X.Y.Z` version as CI;
- regenerate `package-lock.json`, `deno.lock`, and `bun.lock`;
- require the future Nix Playwright package/browser bundle to match.

When `package.json` does not contain `@playwright/test`, do not add it.

The exact update algorithm should be implemented as part of the maintained
internal dependency updater. It should not be independently re-designed in the
Nix generator.

The general replacement for `npm-check-updates` must continue updating ordinary
dependencies as described in
[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md).
Playwright is a special coordinated dependency within that broader updater.

### Nix boundary

Do not generate or adopt a Playwright flake until a small working experiment
confirms the exact official-Nixpkgs package/browser composition and the existing
CI commands pass with the synchronized local package.

Any further issues discovered during that experiment should become focused TODOs
instead of adding speculative mechanics here.

### Tasks

- [ ] Make the maintained internal updater recognize Playwright as a CI-managed
      dependency.
- [ ] Keep an existing root `@playwright/test` dependency equal to the configured
      exact `=X.Y.Z` version.
- [ ] Do not add the dependency when it is absent.
- [ ] Regenerate `package-lock.json`, `deno.lock`, and `bun.lock` after a version
      change.
- [ ] Detect drift between CI config, the package manifest, and tracked lockfiles.
- [ ] Experiment with a simple Playwright flake and identify its concrete Nixpkgs
      package/browser composition.
- [ ] Add the Playwright job to declarative Nix configuration only after the
      experiment passes.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix environments.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — incremental
  implementation sequence.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — maintained updater for ordinary and CI-managed dependencies.
