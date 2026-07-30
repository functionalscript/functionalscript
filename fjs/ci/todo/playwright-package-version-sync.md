## Synchronize Playwright package and CI versions

**Priority:** P2
**Status:** open

### Problem

The Playwright version in `fjs/ci/config/module.f.ts` and the repository's
`@playwright/test` development dependency can change independently.

The CI job runs `npm ci` and then invokes the repository-local Playwright package,
while a Nix environment may provide the driver and browser bundle selected from
Nixpkgs. Different Playwright releases expect different browser revisions, so a
version mismatch can make the tests fail or download an unintended browser bundle.

This bug exists independently of the Nix migration. Any updater that changes the
CI Playwright version must keep an existing repository dependency synchronized.

### Proposal

Treat the Playwright version in `fjs/ci/config/module.f.ts` as the CI source of
truth.

Whenever the CI configuration updater changes that value:

1. read the root `package.json`;
2. if `devDependencies` contains `@playwright/test`, set it to the exact same
   version using the explicit `=X.Y.Z` range form;
3. regenerate every tracked dependency lockfile affected by the change, including
   `package-lock.json`, `deno.lock`, and `bun.lock`;
4. fail regeneration when the package dependency, any tracked lockfile, and the CI
   configuration do not agree;
5. if `package.json` does not contain `@playwright/test`, do nothing.

The synchronization must not add Playwright to projects or package manifests that
do not already depend on it.

For example:

```json
{
  "devDependencies": {
    "@playwright/test": "=1.62.0"
  }
}
```

The same exact version must be used by:

- the repository-local `@playwright/test` package;
- the CI configuration;
- every tracked dependency lockfile;
- the selected Nixpkgs `playwright-driver` and browser bundle, when Nix is used.

A Nixpkgs update that would select a different Playwright version must either
update all of these together or reject that Nixpkgs snapshot. The generated
Playwright flake must not be committed, validated, or adopted by CI while this
synchronization is incomplete.

### Tasks

- [ ] Add a generator helper that reads the configured Playwright version.
- [ ] When root `package.json` contains `devDependencies['@playwright/test']`, write
      the exact `=X.Y.Z` version.
- [ ] Leave `package.json` unchanged when `@playwright/test` is absent.
- [ ] Regenerate `package-lock.json`, `deno.lock`, and `bun.lock` when affected.
- [ ] Add a drift check that fails when the package manifest, any tracked lockfile,
      and CI configuration disagree.
- [ ] Make `ci-nix-update` reject a Nixpkgs Playwright version that cannot be
      synchronized with the repository dependency, all tracked lockfiles, and the
      browser bundle.
- [ ] Block generation, validation, and CI adoption of the Playwright flake until
      synchronization succeeds.
- [ ] Add tests for matching, mismatching, and absent `@playwright/test`
      dependencies.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — official-Nixpkgs CI environment generation.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  Nix migration sequence.