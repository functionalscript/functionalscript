## 65Z-ci-nix. Generate standalone CI flakes from official Nixpkgs

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI install the same top-level tools as Windows through different
setup mechanisms. The earlier Nix proposal also recreated package recipes, source
URLs, hashes, patches, and lock metadata inside the FunctionalScript generator.
That is too much machinery for the first milestone.

Official Nixpkgs already provides package definitions, dependency graphs,
platform fixes, and binary-cache artifacts. FunctionalScript should initially use
only versions available from one accepted official stable Nixpkgs snapshot.

Windows still requires exact version strings for native installers. Therefore the
selected Nixpkgs snapshot and the cross-platform version constants in
`fjs/ci/config/module.f.ts` must be synchronized.

The migration must also preserve existing CI behavior:

- Node 22, 24, and 26 expose the same executable names but run different commands;
- Rust requires rustfmt, Clippy, native and i686 support, and four WASM targets;
- Playwright requires the package, browser bundle, and all tracked lockfiles to use
  the same release;
- generated output must remove stale flakes when an environment is renamed or
  deleted.

### Proposal

Use one configured official stable Nixpkgs ref, initially `nixos-26.05`, and one
explicit update command:

```sh
npm run ci-nix-update
```

The command treats the complete configured Nix environment set as one atomic
snapshot:

1. resolve a candidate latest GitHub commit of the configured stable Nixpkgs ref;
2. evaluate every configured package and provider on every required system without
   changing maintained files;
3. verify every configured Rust component, target standard library, linker, and
   runtime package;
4. verify all other configured requirements, including synchronized dependency
   metadata for CI-managed packages;
5. reject the complete candidate when any configured requirement fails;
6. after every check succeeds, atomically update the shared revision, exact version
   exports, managed dependency metadata, and tracked lockfiles;
7. generate the complete standalone flake tree from the accepted configuration;
8. leave the complete diff ready to commit and review.

A rejected candidate preserves the previous revision, exact versions, manifests,
lockfiles, and generated flake tree.

Snapshot acceptance and generation are atomic. CI adoption is incremental only
after the complete generated set is committed and validated. Individual jobs may
then switch to their matching flakes at different times.

An environment may remain explicitly outside the configured Nix set while its
requirements are investigated. Once added, every later candidate must satisfy it;
silently omitting its flake is not a fallback.

### Configuration

Keep exact version exports as the cross-platform CI contract. Scalar version
exports must preserve literal types with `as const`:

```ts
export const bun = '1.3.14' as const
export const deno = '2.9.4' as const
export const playwright = '1.62.0' as const

export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

export const rust = '1.97.1' as const
export const wasmtime = '47.0.2' as const
export const wasmer = '7.2.1' as const

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

The exact package/provider attributes must be validated against the candidate
snapshot on every system used by the corresponding environment.

The Rust target list is executable configuration. For each target,
`ci-nix-update` must validate an official-Nixpkgs standard-library or complete
-toolchain provider and all required native support packages. On x86-64 Linux,
`i686-unknown-linux-gnu` also requires a 32-bit linker and libc development/runtime
support.

Because `nix.nixpkgs.rev` is shared, there is no per-environment revision fallback.
A missing configured package, component, target provider, linker, runtime, platform,
or synchronized dependency rejects the complete candidate before maintained files
are changed.

### Managed dependency updates

Remove `npm-check-updates` from the root dependency-update workflow. A generic
registry updater must not independently select versions for dependencies controlled
by CI configuration.

Maintained CI update scripts own version selection for CI-managed dependencies.
Before npm, Deno, or Bun install/lockfile commands run, the scripts must write the
configured exact versions into existing package manifests. The installation steps
may then access registries and regenerate tracked lockfiles.

For Playwright, when root `package.json` already contains `@playwright/test`, the
same exact release must be represented by:

- `config.playwright`;
- the dependency in explicit `=X.Y.Z` form;
- `package-lock.json`;
- `deno.lock`;
- `bun.lock`;
- the Nixpkgs driver/browser bundle after Playwright joins the configured Nix set.

When the dependency is absent, the updater does not add it. Playwright remains
outside `nix.packages` until
[playwright-package-version-sync](playwright-package-version-sync.md) is complete.

### Update and generation commands

`npm run ci-nix-update` is the deliberate networked, Nix-capable operation that
selects a candidate snapshot and prepares atomic version/dependency changes.

The broader `npm run update` workflow may access registries for installs and
lockfile generation, but it must use versions selected by maintained update scripts
rather than `npm-check-updates`.

Ordinary `npm run ci-update` only renders committed configuration. It must:

- remain runnable on native Windows;
- not invoke Nix;
- not resolve a moving Nixpkgs ref;
- not access the network;
- not repair manifests or lockfiles after installation;
- produce byte-identical generated files on Linux, macOS, and Windows.

### Generated standalone flakes

Generate one self-contained flake directory per CI environment or incompatible
version family. The initial configured set may include:

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

After Playwright synchronization is complete, the configured set may also include:

```text
nix/generated/playwright/flake.nix
```

Every generated `flake.nix` must:

- embed the exact accepted Nixpkgs Git commit;
- support only systems used by its CI environment;
- use only configured official-Nixpkgs packages/providers;
- expose one unambiguous default shell;
- assert package metadata versions and run executable version checks;
- include all required components, targets, linker/runtime packages, and
  environment variables;
- contain a generated-file warning;
- import no other generated Nix file.

The Node flakes each contain exactly one Node package:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

CI must preserve each job's current ordered command sequence:

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

These sequences must not be replaced by a common `npm test`.

A Rust platform flake must provide `rustc`, Cargo, rustfmt, Clippy, and the host
standard library. On x86-64 Linux it also provides the i686 standard library,
32-bit linker, and libc support. A Rust WASM flake provides all four configured
WASM target standard libraries, Wasmtime, and Wasmer.

Validation must run the existing rustfmt, debug/release test, debug/release Clippy,
i686, and WASM runner command families. A matching `rustc --version` alone is not
sufficient.

The generator owns the complete `nix/generated/` tree. Candidate validation and
all synchronized metadata preparation happen first. After acceptance, generation
recursively deletes and recreates the tree. This removes stale outputs without
allowing a rejected candidate to erase the previous accepted tree.

Do not generate `flake.lock` in the first milestone. Each input embeds the exact
commit, and validation/CI must prevent lockfile writes. A committed lock can be
considered later.

### CI adoption

After the complete generated set is committed and validated:

1. install Nix through a pinned action on Linux and macOS;
2. evaluate and build each applicable flake without writing a lock;
3. run the exact existing commands inside the matching shell;
4. compare Nix-backed and setup-action jobs in parallel;
5. remove an old setup path only after equivalent coverage is proven.

Windows remains on native installers using the synchronized exact versions. OCI
images remain later work and must reuse already validated flakes.

### Tasks

- [ ] Add the stable Nixpkgs ref and exact shared revision to
      `fjs/ci/config/module.f.ts`.
- [ ] Define the explicit environment set governed by the shared revision.
- [ ] Preserve literal scalar version types with `as const`.
- [ ] Add package mappings for every configured top-level tool.
- [ ] Extract Rust into a shared exact version constant.
- [ ] Map rustc, Cargo, rustfmt, Clippy, i686 support, and all four WASM targets.
- [ ] Add `npm run ci-nix-update`.
- [ ] Evaluate the complete candidate without modifying maintained files.
- [ ] Reject the complete candidate when any configured requirement fails.
- [ ] Atomically update the revision, versions, managed dependencies, lockfiles, and
      generated tree only after all configured environments pass.
- [ ] Remove `npm-check-updates` from the root update workflow.
- [ ] Make maintained CI scripts own versions for CI-managed dependencies.
- [ ] Write exact managed dependency versions before npm, Deno, and Bun lockfile
      generation.
- [ ] Keep `npm run ci-update` network-free and rendering-only.
- [ ] Keep Playwright outside the configured set until its dependency and all three
      tracked lockfiles can be synchronized.
- [ ] Delete and recreate the complete generated tree after candidate acceptance.
- [ ] Generate separate Node 22, 24, and 26 flakes and preserve their commands.
- [ ] Generate complete Rust platform and WASM flakes.
- [ ] Keep every generated flake self-contained.
- [ ] Commit generated flakes and preserve
      `git add -A && git diff --cached --exit-code`.
- [ ] Validate every generated environment/system pair without writing a lock.
- [ ] Adopt matching flakes incrementally only after equivalent coverage is proven.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — synchronize
  Playwright package metadata and all tracked lockfiles.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
