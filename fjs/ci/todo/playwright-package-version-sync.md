## Synchronize Playwright package and CI versions

**Priority:** P2
**Status:** open

### Problem

The Playwright version in `fjs/ci/config/module.f.ts` and the repository's
`@playwright/test` development dependency can change independently.

The CI job runs `npm ci` and then invokes the repository-local Playwright package,
while a Nix environment may provide the driver and browser bundle selected from
Nixpkgs. Different Playwright releases expect different browser revisions, so a
version mismatch can make tests fail or download an unintended browser bundle.

The current generic dependency update path also creates a conflict. Running
`npm-check-updates -u` may replace `@playwright/test` with the newest registry
release before the CI updater applies its exact configured version. Subsequent npm,
Deno, and Bun lockfile generation can then record the wrong Playwright release, and
the network-free `npm run ci-update` step cannot repair those lockfiles.

### Proposal

Treat the Playwright version in `fjs/ci/config/module.f.ts` as the source of truth
for every CI-managed Playwright dependency.

Remove `npm-check-updates` from the root dependency-update workflow. Version
selection for dependencies managed by CI configuration must be performed by the
maintained CI update scripts, not by a generic registry-wide updater.

The update order is:

1. select or update the exact CI Playwright version;
2. read the root `package.json`;
3. when `devDependencies` contains `@playwright/test`, write the exact
   `=X.Y.Z` version before running any install or lockfile command;
4. when `@playwright/test` is absent, leave the manifest unchanged;
5. regenerate every affected tracked dependency lockfile, including
   `package-lock.json`, `deno.lock`, and `bun.lock`;
6. fail when the manifest, any tracked lockfile, CI configuration, or selected
   Nixpkgs driver/browser bundle does not agree.

The update workflow may access registries while regenerating dependency locks, but
it must not independently choose a different version for a CI-managed dependency.
`npm run ci-update` remains a network-free rendering and drift-check command; it is
not responsible for repairing manifest or lockfile versions after installation.

The synchronization must not add Playwright to a package manifest that does not
already depend on it.

For example:

```json
{
  "devDependencies": {
    "@playwright/test": "=1.62.0"
  }
}
```

The same exact version must be represented by:

- `fjs/ci/config/module.f.ts`;
- the existing root `@playwright/test` dependency;
- `package-lock.json`;
- `deno.lock`;
- `bun.lock`;
- the selected Nixpkgs Playwright driver/browser bundle, when Nix is used.

A Nixpkgs update that would select a different Playwright version must either
update all of these atomically or reject the candidate snapshot. The generated
Playwright flake must not be committed, validated, or adopted by CI while this
synchronization is incomplete.

### Tasks

- [ ] Remove `npm-check-updates` from the root dependency-update workflow.
- [ ] Make maintained CI update scripts own version selection for CI-managed
      dependencies.
- [ ] Add a helper that reads the configured Playwright version.
- [ ] When root `package.json` contains `devDependencies['@playwright/test']`, write
      the exact `=X.Y.Z` version before npm, Deno, or Bun lockfile generation.
- [ ] Leave `package.json` unchanged when `@playwright/test` is absent.
- [ ] Regenerate `package-lock.json`, `deno.lock`, and `bun.lock` when affected.
- [ ] Add a drift check that fails when the package manifest, any tracked lockfile,
      and CI configuration disagree.
- [ ] Make `ci-nix-update` reject a Nixpkgs Playwright version that cannot be
      synchronized with the repository dependency, all tracked lockfiles, and the
      browser bundle.
- [ ] Block generation, validation, and CI adoption of the Playwright flake until
      synchronization succeeds.
- [ ] Test a normal update when the registry contains a newer Playwright release
      than the configured CI version.
- [ ] Add tests for matching, mismatching, and absent `@playwright/test`
      dependencies.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — official-Nixpkgs CI environment generation.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  Nix migration sequence.
