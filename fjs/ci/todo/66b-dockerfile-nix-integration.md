## 66B-dockerfile-nix-integration. Generate standalone official-Nixpkgs CI flakes

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI currently install tools through generated GitHub Actions steps,
while Windows uses exact version strings from `fjs/ci/config/module.f.ts`. The
previous Nix plan reproduced package recipes, URLs, hashes, and lock metadata in
the FunctionalScript generator.

The first milestone should instead prove that one pinned official stable Nixpkgs
snapshot can supply the configured environments and that committed generated
flakes can run the existing CI commands without changing coverage.

A universal shell cannot preserve Node 22, 24, and 26 because all three expose the
same `node` and `npm` names. Their jobs also run different commands.

Rust needs a complete toolchain rather than only `rustc` and Cargo. Current CI also
uses rustfmt, Clippy, `i686-unknown-linux-gnu`, four WASM targets, 32-bit linker
support, Wasmtime, and Wasmer.

### Proposal

Implement the migration in these ordered phases:

```text
Phase 1: resolve and validate one complete Nixpkgs candidate snapshot
Phase 2: atomically synchronize its versions into CI configuration
Phase 3: generate and commit the complete configured flake tree
Phase 4: build and validate every committed flake
Phase 5: incrementally move CI jobs to their matching validated flakes
Later: consider custom packages, caches, and OCI images
```

Only versions already provided by the accepted official Nixpkgs snapshot are in
scope. Do not add overlays, a FunctionalScript package source, or hand-written
upstream package recipes until a concrete missing-package requirement exists.

Each generated flake is self-contained and embeds the pinned Nixpkgs commit. It
must not import a shared generated Nix module.

The shared Nixpkgs revision governs an explicit configured environment set.
Candidate selection and generation are atomic across that set. CI adoption is
incremental only after the complete generated set has been accepted, committed,
and validated.

An environment may remain outside the configured Nix set and continue using its
existing setup action. Once it is added, a later candidate that cannot supply it
must be rejected entirely; the updater must not omit its flake or advance other
configured environments to a different shared revision.

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

Keep the existing exact version exports as the cross-platform contract for Windows
native installers and generated Nix assertions. Extract Rust from the GitHub Action
map into a normal shared exact version export.

Playwright remains outside `nix.packages` until
[playwright-package-version-sync](playwright-package-version-sync.md) is complete.
After it is added, the candidate must synchronize the Nixpkgs driver/browser
bundle, `config.playwright`, the existing exact `@playwright/test` dependency,
`package-lock.json`, `deno.lock`, and `bun.lock`.

The Rust target list is maintained executable configuration. Each target must map
to an official-Nixpkgs target standard-library or complete-toolchain provider and
all native support required by current CI. `i686-unknown-linux-gnu` additionally
needs a 32-bit linker and libc development/runtime support on x86-64 Linux.

### 2. Add the explicit Nixpkgs update command

Add:

```sh
npm run ci-nix-update
```

This command may require Nix, GitHub access, and Linux, macOS, or Windows through
WSL. It runs only for an intentional Nixpkgs update.

Before modifying maintained files, it must:

1. resolve the latest commit of the configured stable ref;
2. evaluate every configured package on every required system;
3. verify `rustc`, Cargo, rustfmt, and Clippy for the selected Rust release;
4. verify every configured Rust target provider and required linker/runtime
   package;
5. compile representative code for every target rather than merely checking that
   a target name exists;
6. verify all other configured environment requirements;
7. prepare any Playwright manifest and lockfile synchronization after Playwright is
   part of the configured set;
8. reject the whole candidate when any check fails.

Only after every configured environment passes may the command:

1. update `nix.nixpkgs.rev`;
2. copy all accepted top-level versions into the existing version exports;
3. update synchronized dependency metadata and lockfiles;
4. invoke the ordinary Nix-independent generator;
5. expose the complete diff for review.

The write and generation phase should use a temporary or otherwise transactional
workflow so failure cannot leave a partially updated revision, version table,
package manifest, lockfile, or generated directory.

A rejected candidate preserves the complete previously accepted state.

The network-free requirement applies specifically to `npm run ci-update`.
That command renders committed configuration without Nix, moving-ref resolution,
or network access and remains runnable on native Windows.

The broader `npm run update` workflow may continue accessing registries because it
intentionally updates dependencies and lockfiles. Its nested `npm run ci-update`
step remains network-free.

### 3. Generate the complete standalone flake tree

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

After Playwright synchronization is implemented and Playwright is added to the
configured set, it also generates:

```text
nix/generated/playwright/flake.nix
```

Every generated flake must:

- embed the exact accepted Nixpkgs commit;
- support only systems used by its CI environment;
- select only configured official-Nixpkgs packages/providers;
- expose one unambiguous default shell;
- assert package metadata versions;
- provide executable version checks;
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

The generated workflow must preserve each current job's exact ordered commands:

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

Do not replace these sequences with a shared `npm test`; that would remove native
Node testing, generated-drift checks, type checking, coverage, and packaging.
Checkout and Nix installation remain workflow steps surrounding these commands.

A Rust platform flake must provide:

```text
rustc
cargo
rustfmt
cargo clippy
host standard library
```

On x86-64 Linux it must additionally provide the
`i686-unknown-linux-gnu` standard library, 32-bit linker, and libc support.

A Rust WASM flake must provide standard libraries for:

```text
wasm32-wasip1
wasm32-wasip2
wasm32-unknown-unknown
wasm32-wasip1-threads
```

It must also provide the selected Wasmtime and Wasmer packages.

Because Rust environments are part of the configured atomic set, a candidate
missing any Rust component, target provider, linker, runtime, or supported-system
requirement is rejected entirely. The generator must not advance the shared
revision while skipping `rust-platform` or `rust-wasm`.

An unsupported Rust environment can remain outside the configured set only through
an explicit reviewed configuration decision made before candidate selection. It
then continues using the current setup action and is not represented as a generated
flake.

The generator owns the complete `nix/generated/` tree. Candidate validation and
all synchronized metadata preparation happen first. After acceptance, generation
recursively deletes and recreates the tree from current configuration. This removes
stale renamed/deleted environments without allowing a rejected candidate to erase
the previous tree.

Do not generate `flake.lock` in this phase. Each input URL embeds the exact commit,
and validation/CI must prevent lockfile writes. A committed lock can be evaluated
later.

### 4. Commit and check generated files

Every generated `flake.nix` is committed. Regeneration remains:

```sh
npm run ci-update
git add -A
git diff --cached --exit-code
```

The delete-and-recreate step turns removed environments into real deletions. The
staged comparison then detects all additions, deletions, and modifications.
Generation must be byte-identical on Linux, macOS, and native Windows.

### 5. Validate before changing CI

For every generated environment/system pair:

1. install Nix through a pinned trusted action;
2. evaluate without writing a lock;
3. build the default shell;
4. run metadata and executable version checks;
5. run the complete existing command sequence for that environment;
6. fail without changing committed configuration or generated files.

Node validation must execute the distinct Node 22, 24, and 26 sequences listed
above.

Rust validation must execute current command families, including:

- `cargo fmt -- --check` where currently run;
- debug and release `cargo test`;
- debug and release `cargo clippy -- -D warnings`;
- debug and release i686 tests and Clippy on x86-64 Linux;
- all configured WASM builds/tests with current Wasmtime and Wasmer runner
  combinations.

A matching `rustc --version` or successful host build alone is insufficient.

### 6. Use matching flakes in CI

After the complete snapshot and flake tree are accepted and every applicable flake
is committed, jobs may migrate incrementally:

```text
checkout
install Nix
select the generated flake for this job
run that job's unchanged command sequence
```

Keep Nix-backed and setup-action versions in parallel until equivalent results and
coverage are proven. Remove a setup action only for the environment whose matching
flake has passed its complete validation.

Windows remains on native installers using the synchronized exact versions.

Rust/WASM adoption requires equivalent format, Clippy, host, i686, and WASM
coverage. Playwright adoption remains blocked until its separate synchronization
TODO is complete and Playwright belongs to an accepted atomic snapshot.

### 7. Later extensions

The first implementation excludes:

- hand-written upstream package recipes;
- a FunctionalScript Nix package source or overlay;
- shared generated Nix modules;
- generated `flake.lock` metadata;
- a private binary cache;
- OCI generation/publication;
- replacing any CI environment before equivalent validation.

A custom package source should be proposed only after an official stable snapshot
cannot provide a concrete required tool or platform. OCI remains last and must
reuse validated flakes.

### Tasks

#### Phase 1: candidate discovery and validation

- [ ] Add the stable ref, exact shared revision, configured environment set, and
      package attributes to `fjs/ci/config/module.f.ts`.
- [ ] Extract the Rust release into a shared version export.
- [ ] Map `rustc`, Cargo, rustfmt, and Clippy.
- [ ] Record i686 and all four WASM targets.
- [ ] Define official-Nixpkgs target providers and linker/runtime dependencies.
- [ ] Add `npm run ci-nix-update`.
- [ ] Evaluate the complete candidate without modifying maintained files.
- [ ] Reject the complete candidate on any configured package, component, target,
      linker, runtime, platform, version, or synchronization failure.
- [ ] Preserve the previous complete state after rejection.

#### Phase 2: atomic synchronization

- [ ] Update the shared revision and all accepted top-level versions in one
      transaction.
- [ ] Keep Windows generators reading the synchronized version exports.
- [ ] After Playwright joins the configured set, update its exact dependency and
      `package-lock.json`, `deno.lock`, and `bun.lock` atomically or reject the
      candidate.
- [ ] Show all version and dependency changes clearly in the diff.

#### Phase 3: generation

- [ ] Keep only `npm run ci-update` Nix-independent and network-free.
- [ ] Generate the complete configured tree; do not partially omit a failed
      configured environment.
- [ ] Delete and recreate `nix/generated/` only after candidate acceptance.
- [ ] Generate separate Node 22, Node 24, and Node 26 flakes.
- [ ] Preserve each Node job's exact command sequence.
- [ ] Generate complete Rust platform/WASM flakes with all required providers.
- [ ] Pin each input to the exact accepted commit.
- [ ] Keep every generated flake self-contained.
- [ ] Generate version and executable checks.
- [ ] Do not generate `flake.lock` or hand-written package recipes.
- [ ] Commit all generated files and preserve the staged drift check.

#### Phase 4: validation

- [ ] Validate every generated environment/system pair without writing a lock.
- [ ] Run the distinct Node command sequences.
- [ ] Run complete Rust format, Clippy, host, i686, and WASM commands.
- [ ] Verify Playwright coordination after it is added to the configured set.

#### Phase 5: adoption

- [ ] Map every Linux/macOS job to its matching flake.
- [ ] Preserve all existing commands and ordering.
- [ ] Compare Nix-backed and setup-action jobs.
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
