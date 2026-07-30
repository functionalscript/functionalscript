## 66B-dockerfile-nix-integration. Generate standalone official-Nixpkgs CI flakes

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI currently install tools through generated GitHub Actions steps,
while Windows uses exact version strings from `fjs/ci/config/module.f.ts`. The
previous Nix plan reproduced package recipes, URLs, hashes, and lock metadata in
the FunctionalScript generator.

The first milestone should instead prove that one accepted official stable
Nixpkgs snapshot can supply the configured environments and that committed
standalone flakes can run the existing CI commands without changing coverage.

The implementation must preserve several nontrivial contracts:

- Node 22, 24, and 26 require separate shells and distinct command sequences;
- Rust requires rustfmt, Clippy, i686 support, four WASM target libraries,
  Wasmtime, and Wasmer;
- CI-managed package versions must not be overwritten by a generic dependency
  updater;
- Playwright package and browser versions must match all tracked lockfiles;
- stale generated flake directories must be deleted deterministically.

### Proposal

Implement the migration in these ordered phases:

```text
Phase 1: resolve and validate one complete Nixpkgs candidate snapshot
Phase 2: atomically synchronize versions and managed dependencies
Phase 3: generate and commit the complete configured flake tree
Phase 4: build and validate every committed flake
Phase 5: incrementally move CI jobs to matching validated flakes
Later: consider custom packages, caches, and OCI images
```

Only versions already supplied by the accepted official Nixpkgs snapshot are in
scope. Do not add overlays, a FunctionalScript package source, or hand-written
upstream package recipes until a concrete missing-package requirement exists.

The shared Nixpkgs revision governs an explicit configured environment set.
Candidate selection and generation are atomic across that set. CI adoption is
incremental only after the complete generated set has been accepted, committed,
and validated.

An environment may remain outside the configured Nix set and continue using its
existing setup action. Once added, a later candidate that cannot supply it is
rejected entirely; the updater must not omit its flake or advance other configured
environments to another shared revision.

### 1. Configure the official package source

Add to `fjs/ci/config/module.f.ts`:

- the maintained stable ref, initially `nixos-26.05`;
- the exact accepted GitHub commit;
- the explicit environments governed by that revision;
- package attributes for every configured top-level tool;
- all required Rust components and targets.

For example:

```ts
export const nix = {
    nixpkgs: {
        ref: 'nixos-26.05',
        rev: '<exact-github-commit>',
    },
    packages: {
        bun: 'bun',
        deno: 'deno',
        node: {
            default: 'nodejs_26',
            node22: 'nodejs_22',
            node24: 'nodejs_24',
        },
        rust: {
            rustc: 'rustc',
            cargo: 'cargo',
            rustfmt: 'rustfmt',
            clippy: 'clippy',
        },
        wasmtime: 'wasmtime',
        wasmer: 'wasmer',
    },
    rustTargets: {
        platform: ['i686-unknown-linux-gnu'],
        wasm: [
            'wasm32-wasip1',
            'wasm32-wasip2',
            'wasm32-unknown-unknown',
            'wasm32-wasip1-threads',
        ],
    },
} as const
```

Keep the exact version exports as the cross-platform contract for Windows native
installers and generated Nix assertions. Scalar version exports must retain
literal types using `as const`.

The Rust target list is maintained executable configuration. Every target must map
to an official-Nixpkgs target-standard-library or complete-toolchain provider and
all native support required by current CI. `i686-unknown-linux-gnu` additionally
requires a 32-bit linker and libc support on x86-64 Linux.

Playwright remains outside `nix.packages` until
[playwright-package-version-sync](playwright-package-version-sync.md) is complete.
After it joins the configured set, one candidate must synchronize the Nixpkgs
bundle, `config.playwright`, the existing exact `@playwright/test` dependency,
`package-lock.json`, `deno.lock`, and `bun.lock`.

### 2. Add the explicit Nixpkgs update command

Add:

```sh
npm run ci-nix-update
```

This command may require Nix, GitHub access, and Linux, macOS, or Windows through
WSL. It runs only for an intentional Nixpkgs update.

Before modifying maintained files, it must:

1. resolve the latest commit of the configured stable ref;
2. evaluate every configured package/provider on each required system;
3. verify rustc, Cargo, rustfmt, and Clippy for the selected Rust release;
4. verify every configured Rust target provider and linker/runtime dependency;
5. compile representative code for every target;
6. prepare all CI-managed dependency changes before any install or lockfile step;
7. verify every configured environment and synchronization requirement;
8. reject the whole candidate when any check fails.

Only after every configured environment passes may it transactionally:

1. update `nix.nixpkgs.rev`;
2. copy accepted top-level versions into the exact version exports;
3. write exact versions for existing CI-managed package dependencies;
4. regenerate affected `package-lock.json`, `deno.lock`, and `bun.lock` files;
5. invoke the ordinary Nix-independent generator;
6. expose the complete diff for review.

A rejected candidate preserves the previously accepted revision, version table,
package manifests, lockfiles, and generated tree.

### 3. Replace generic dependency version selection

Remove `npm-check-updates` from the root dependency-update workflow. A generic
registry-wide updater must not choose versions for dependencies managed by CI
configuration.

Maintained CI update scripts must write exact managed versions into existing
package manifests before npm, Deno, or Bun installation and lockfile-generation
commands run. Those commands may access registries, but they consume the versions
already selected by the maintained scripts.

For Playwright, an existing root dependency is written as exact `=X.Y.Z`; when the
dependency is absent, it is not added. All three tracked lockfiles are regenerated
after the manifest is synchronized.

The command boundaries are:

- `npm run ci-nix-update`: networked Nixpkgs selection and atomic synchronization;
- `npm run update`: may access registries for installs and lockfile generation, but
  does not run `npm-check-updates` and does not independently select managed pins;
- `npm run ci-update`: network-free, Nix-independent rendering and drift checking
  from committed configuration only.

`npm run ci-update` must not be expected to repair package manifests or lockfiles
after registry installation has already selected a conflicting version.

### 4. Generate the complete standalone flake tree

The configured set may initially generate:

```text
nix/generated/
  node22/flake.nix
  node24/flake.nix
  node26/flake.nix
  deno/flake.nix
  bun/flake.nix
  rust-platform/flake.nix
  rust-wasm/flake.nix
```

After Playwright synchronization is implemented and Playwright joins the set:

```text
nix/generated/playwright/flake.nix
```

Every generated flake must:

- embed the exact accepted Nixpkgs commit;
- support only systems used by its CI environment;
- select only configured official-Nixpkgs packages/providers;
- expose one unambiguous default shell;
- assert package metadata and executable versions;
- include all required Rust components, targets, linker/runtime packages, and
  environment variables;
- contain a generated-file warning;
- import no other generated Nix file.

The Node flakes each contain exactly one Node package:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

The generated workflow must preserve each current job's ordered commands:

```sh
# Node 22
npm install -g functionalscript@<configured-version>
npm ci
fjs t

# Node 24
npm ci
node --test

# Node 26
npm ci
npm run ci-update
git add -A && git diff --cached --exit-code
npx tsc
npm run cov
npm pack
```

Do not replace these sequences with a shared `npm test`.

A Rust platform flake provides rustc, Cargo, rustfmt, Clippy, and the host standard
library. On x86-64 Linux it also provides i686 standard-library, linker, and libc
support. A Rust WASM flake provides all four target libraries, Wasmtime, and
Wasmer.

Because Rust environments are part of the atomic configured set, a candidate
missing any Rust component, target provider, linker, runtime, or supported-system
requirement is rejected. The generator must not advance the revision while
skipping a configured Rust flake.

The generator owns the complete `nix/generated/` tree. Candidate validation and
synchronized metadata preparation occur first. After acceptance, generation
recursively deletes and recreates the tree, removing stale renamed/deleted outputs
without allowing a rejected candidate to erase the previous state.

Do not generate `flake.lock` in this phase. Each input URL embeds the exact commit,
and validation/CI must prevent lockfile writes.

### 5. Commit and validate generated files

Every generated `flake.nix` is committed. Regeneration remains:

```sh
npm run ci-update
git add -A
git diff --cached --exit-code
```

For every generated environment/system pair:

1. install Nix through a pinned trusted action;
2. evaluate and build without writing a lock;
3. run metadata and executable version checks;
4. run the complete existing command sequence for that environment;
5. fail without changing committed configuration or generated files.

Rust validation includes rustfmt, debug/release tests, debug/release Clippy, i686
tests and Clippy on x86-64 Linux, and all configured WASM builds/tests with the
current Wasmtime/Wasmer runner combinations.

### 6. Use matching flakes in CI

After the complete snapshot and tree are accepted and validated, jobs may migrate
incrementally:

```text
checkout
install Nix
select the generated flake for this job
run that job's unchanged command sequence
```

Keep Nix-backed and setup-action versions in parallel until equivalent results and
coverage are proven. Windows remains on native installers using synchronized exact
versions.

### 7. Later extensions

The first implementation excludes hand-written package recipes, overlays, shared
generated Nix modules, generated `flake.lock`, private caches, and OCI publication.
OCI remains last and must reuse validated flakes.

### Tasks

#### Phase 1: candidate discovery and validation

- [ ] Add the stable ref, exact shared revision, configured environment set, and
      package attributes to `fjs/ci/config/module.f.ts`.
- [ ] Preserve scalar version literals with `as const`.
- [ ] Extract the Rust release into a shared version export.
- [ ] Map rustc, Cargo, rustfmt, Clippy, i686, and all four WASM targets.
- [ ] Add `npm run ci-nix-update`.
- [ ] Evaluate the complete candidate without modifying maintained files.
- [ ] Reject the candidate on any configured requirement failure.

#### Phase 2: atomic synchronization

- [ ] Update the revision and all exact top-level versions transactionally.
- [ ] Remove `npm-check-updates` from the root update workflow.
- [ ] Make maintained CI scripts own versions for CI-managed dependencies.
- [ ] Write managed exact versions before install and lockfile generation.
- [ ] Regenerate `package-lock.json`, `deno.lock`, and `bun.lock` when affected.
- [ ] Preserve the previous complete state after rejection or failure.

#### Phase 3: generation

- [ ] Keep `npm run ci-update` Nix-independent, network-free, and rendering-only.
- [ ] Generate the complete configured tree; do not omit a failed configured
      environment.
- [ ] Delete and recreate `nix/generated/` only after candidate acceptance.
- [ ] Generate separate Node 22, 24, and 26 flakes with unchanged commands.
- [ ] Generate complete Rust platform/WASM flakes.
- [ ] Pin each input to the exact accepted commit.
- [ ] Keep every generated flake self-contained.
- [ ] Do not generate `flake.lock` or hand-written package recipes.

#### Phase 4: validation

- [ ] Validate every generated environment/system pair without writing a lock.
- [ ] Run the distinct Node command sequences.
- [ ] Run complete Rust format, Clippy, host, i686, and WASM commands.
- [ ] Verify Playwright coordination after it joins the configured set.

#### Phase 5: adoption

- [ ] Map every Linux/macOS job to its matching flake.
- [ ] Preserve all existing commands and ordering.
- [ ] Remove an old setup action only after equivalent validation.
- [ ] Keep Windows on its native synchronized path.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and atomic snapshot policy.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — synchronize
  Playwright dependency metadata and all tracked lockfiles.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
