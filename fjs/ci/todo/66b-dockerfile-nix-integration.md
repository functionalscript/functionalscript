## 66B-dockerfile-nix-integration. Generate standalone official-Nixpkgs CI flakes

**Priority:** P3
**Status:** open

### Problem

The current Linux and macOS CI jobs install tools through generated GitHub
Actions steps, while Windows uses exact version strings from
`fjs/ci/config/module.f.ts`. The previous Nix implementation plan reproduced
package recipes, upstream URLs, hashes, and lock metadata inside the
FunctionalScript generator.

That complexity is unnecessary for the first milestone. We first need to prove
that one pinned official stable Nixpkgs snapshot can supply the required tools and
that committed generated flakes can run the existing Linux and macOS CI commands.

A single shell cannot preserve the Node 22, 24, and 26 matrix because all three
packages expose the same `node` and `npm` executable names. Each Node job therefore
needs its own standalone generated flake.

Rust needs a complete toolchain rather than only `rustc` and Cargo. Existing CI
also uses rustfmt, Clippy, `i686-unknown-linux-gnu`, and four WASM targets. A Rust
or WASM flake must not replace the existing setup action until every component,
target standard library, linker/runtime dependency, and existing command is
validated.

### Proposal

Implement the simpler path in these ordered phases:

```text
Phase 1: resolve the latest official stable Nixpkgs commit
Phase 2: synchronize its top-level package versions into CI config
Phase 3: generate and commit standalone self-contained flakes
Phase 4: build and validate every committed flake
Phase 5: run Linux/macOS CI through the matching flakes
Later: consider custom packages, caches, and OCI images
```

Only versions already packaged by the selected official Nixpkgs snapshot are in
scope. Do not create overlays, a FunctionalScript package source, or hand-written
upstream package recipes until a concrete missing-package requirement exists.

Each generated flake must be independently debuggable. It embeds the pinned
Nixpkgs commit and all environment-specific logic directly in its own `flake.nix`.
It must not import shared generated Nix modules.

Independent environments may advance separately. A complete Node flake can be
validated and adopted while Rust target support or Playwright synchronization is
still blocked. The existing setup actions remain for any environment that has not
passed its complete validation gate.

### 1. Configure the official package source

Add a Nix section to `fjs/ci/config/module.f.ts` containing:

- the maintained stable ref, initially `nixos-26.05`;
- the exact resolved GitHub commit;
- the Nixpkgs attribute used for each top-level CI tool;
- every required Rust component and target.

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
        playwright: 'playwright-driver',
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

Keep the existing exact version exports. They remain the cross-platform contract
used by Windows native installers and by generated Nix assertions. Extract the
Rust release from the action table into a normal exact version export shared by
both paths.

The target list is maintained configuration. The Nix update implementation must
map each target to an official-Nixpkgs target standard-library/toolchain expression
and any additional native packages required by the existing command. In
particular, `i686-unknown-linux-gnu` needs 32-bit linker and libc development
support on x86-64 Linux.

### 2. Add the explicit Nixpkgs update command

Add:

```sh
npm run ci-nix-update
```

This command runs only when intentionally updating the Nix environment. It may
require Nix, GitHub access, and a supported Nix-capable host such as Linux, macOS,
or Windows through WSL.

The command must:

1. resolve the latest commit of the configured official stable Nixpkgs ref;
2. evaluate every configured package attribute on each required Nix system;
3. verify `rustc`, Cargo, rustfmt, and Clippy for the selected Rust release;
4. verify an official-Nixpkgs provider for every configured Rust target standard
   library and required linker/runtime package;
5. reject any missing, broken, unsupported, or version-divergent environment;
6. update `nix.nixpkgs.rev`;
7. copy the accepted top-level versions into the existing exact version exports;
8. when Playwright changes and root `package.json` already contains
   `@playwright/test`, synchronize its exact dependency plus `package-lock.json`,
   `deno.lock`, and `bun.lock`, or reject the snapshot;
9. run the ordinary Nix-independent CI generator;
10. expose all config, dependency metadata, and generated-file changes for review.

For example, if the selected snapshot reports `nodejs_26.version = "26.5.0"`
on every system used by the Node 26 job, the command writes:

```ts
export const node = {
    default: '26.5.0',
    // ...
} as const
```

Windows then installs `26.5.0` natively, while Linux and macOS use
`pkgs.nodejs_26` from the exact pinned snapshot.

The offline requirement applies to `npm run ci-update`, not the broader
`npm run update` workflow. `npm run ci-update` must not resolve a moving ref,
invoke Nix, or access the network; it renders only committed configuration and
remains runnable on native Windows.

`npm run update` may continue to access registries because it deliberately runs
dependency-update and lockfile-update commands. When it reaches the nested
`npm run ci-update` step, that subcommand remains Nix-independent and network-free.

### 3. Generate standalone flake directories

Extend the existing CI generator to emit independent directories such as:

```text
nix/generated/
  node22/flake.nix
  node24/flake.nix
  node26/flake.nix
  deno/flake.nix
  bun/flake.nix
  rust-platform/flake.nix
  rust-wasm/flake.nix
  playwright/flake.nix
```

The permanent boundaries should follow real CI environments rather than create
one universal shell. At minimum, every incompatible version family gets a
separate flake.

Every generated `flake.nix` must:

- embed the exact Nixpkgs commit in its input URL;
- support only the systems on which that environment runs;
- use only the configured official Nixpkgs attributes required by that job;
- expose one default CI/development shell;
- assert package metadata versions against the exact config versions;
- generate executable version checks;
- include all required Rust components, targets, linker/runtime packages, and
  environment variables when applicable;
- contain a generated-file warning;
- remain readable and independently debuggable;
- contain no imports or references to another generated Nix file.

The Node flakes each contain exactly one Node package:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

CI runs the existing command through the selected directory:

```sh
nix develop ./nix/generated/node22 --command npm test
nix develop ./nix/generated/node24 --command npm test
nix develop ./nix/generated/node26 --command npm test
```

A Rust platform flake must expose all of these commands from the configured Rust
release:

```text
rustc
cargo
rustfmt
cargo clippy
```

It must include the host standard library. On x86-64 Linux it must additionally
include the `i686-unknown-linux-gnu` standard library, 32-bit linker, and libc
development/runtime support.

A Rust WASM flake must include the standard libraries for:

```text
wasm32-wasip1
wasm32-wasip2
wasm32-unknown-unknown
wasm32-wasip1-threads
```

It must also include the selected Wasmtime and Wasmer packages. Merely putting the
target names in configuration is insufficient; validation must compile and run
the same debug/release and runner combinations generated by the current CI code.

If the official snapshot cannot provide one of these Rust components or target
providers, the generator must not emit the corresponding Rust/WASM flake. Those
jobs remain on their existing setup action while other complete flakes continue.

The generator owns the complete `nix/generated/` tree. Every ordinary generation
run must delete that tree recursively, recreate it, and then emit only directories
represented by the current CI configuration. Do not reconcile only known output
files: a renamed or removed environment must delete its old directory.

Do not generate `flake.lock` in this phase. Each input URL contains the exact
immutable Git commit. Validation and CI invocations must prevent Nix from writing
a lock file. Committed locks can be evaluated later as a separate improvement.

### 4. Commit and check generated files

Every generated `flake.nix` is a committed artifact. The existing regeneration
check remains:

```sh
npm run ci-update
git add -A
git diff --cached --exit-code
```

The generator's delete-and-recreate step ensures removed or renamed environments
appear as deletions. The staged comparison then catches all generated additions,
deletions, and modifications. The generator must produce byte-identical output on
Linux, macOS, and native Windows.

The explicit `ci-nix-update` command changes the pinned commit and package
versions. Ordinary regeneration only renders the already committed configuration.

### 5. Validate before changing CI

Add Linux and macOS validation jobs that, for every applicable generated flake:

1. install Nix through a pinned trusted action;
2. evaluate the flake without writing a lock;
3. build the default shell for the runner system;
4. run metadata and executable version checks;
5. verify the environment's representative commands and compilation targets;
6. fail without changing the committed config or generated files.

The first implementation is complete for an environment when its committed flake
validates on every system used by the corresponding CI job.

Rust validation must run the existing command families rather than only version
checks:

- `cargo fmt -- --check`;
- debug and release `cargo test`;
- debug and release `cargo clippy -- -D warnings`;
- the i686 test and Clippy commands on x86-64 Linux;
- all configured WASM target commands with the current Wasmtime/Wasmer runner
  combinations.

The Playwright flake is another explicit exception to independent progress. It
must not be generated, committed, validated, or adopted until
[playwright-package-version-sync](playwright-package-version-sync.md) is complete
and its package manifest plus every tracked lockfile agree with the CI and Nixpkgs
version. Other independent flakes may proceed while that TODO remains open.

### 6. Use the matching flake in CI

After validation succeeds, convert Linux and macOS jobs incrementally:

```text
checkout
install Nix
select the generated flake for this CI job
run the existing CI command
```

The Node 22, 24, and 26 jobs must select their respective standalone directories.
Preserve existing commands, including the Playwright browser-specific commands.
Run Nix-backed and setup-action jobs in parallel until their coverage and results
match. Windows remains on the existing native path with synchronized exact
versions.

Rust and WASM jobs stay on the current Rust setup action until the complete
component-and-target validation passes. Removing that action requires equivalent
format, Clippy, host, i686, and WASM coverage through the generated flakes.

Playwright CI adoption remains blocked until its separate synchronization TODO is
complete. A Nixpkgs update must never combine a different driver/browser bundle
with the local `@playwright/test` dependency or stale `package-lock.json`,
`deno.lock`, or `bun.lock` entries.

### 7. Later extensions

The following are explicitly out of scope for the first implementation:

- hand-written upstream package recipes;
- a FunctionalScript Nix package source or overlay;
- shared generated Nix modules;
- generated `flake.lock` metadata;
- a private binary cache;
- OCI image generation or publication;
- replacing a CI environment before its generated flake validates.

A custom package source should be introduced only when an official stable
Nixpkgs snapshot cannot provide a concrete required tool or platform. OCI images
remain the last stage and must reuse the already proven standalone flakes.

### Tasks

#### Phase 1: source and package discovery

- [ ] Add the official stable Nixpkgs ref, exact commit, and package attributes to
      `fjs/ci/config/module.f.ts`.
- [ ] Extract Rust into a normal exact version export shared by Windows and Nix.
- [ ] Map `rustc`, Cargo, rustfmt, and Clippy.
- [ ] Record `i686-unknown-linux-gnu` and all four WASM targets in maintained config.
- [ ] Define the official-Nixpkgs target standard-library/toolchain expression and
      required linker/runtime packages for every Rust target.
- [ ] Add `npm run ci-nix-update`.
- [ ] Resolve the latest commit of the configured stable ref.
- [ ] Evaluate package attributes, Rust components, and target providers on every
      required system.
- [ ] Fail an environment on missing, broken, unsupported, or version-divergent
      packages, components, targets, linkers, or runtime support.

#### Phase 2: cross-platform version synchronization

- [ ] Update the exact Nixpkgs commit and all accepted top-level package versions
      in one operation.
- [ ] Keep existing Windows setup generators reading the synchronized version
      exports.
- [ ] When Playwright changes, synchronize the exact existing `@playwright/test`
      dependency plus `package-lock.json`, `deno.lock`, and `bun.lock`, or reject
      the snapshot.
- [ ] Show version and dependency changes clearly in the generated diff.

#### Phase 3: standalone generated flakes

- [ ] Keep `npm run ci-update` Nix-independent, network-free, and runnable on native
      Windows; do not impose that offline restriction on the broader
      dependency-updating `npm run update` workflow.
- [ ] Delete and recreate the complete `nix/generated/` tree on every generation.
- [ ] Generate independent flake directories from `npm run ci-update`.
- [ ] Generate separate Node 22, Node 24, and Node 26 flakes.
- [ ] Generate Rust flakes only when all required components and target providers
      are available.
- [ ] Pin every input URL to the exact configured GitHub commit.
- [ ] Keep each generated `flake.nix` self-contained and free of generated imports.
- [ ] Generate package metadata assertions and executable version checks.
- [ ] Do not generate `flake.lock` or hand-written upstream package recipes.
- [ ] Block the Playwright flake until its package and all tracked lockfiles are
      synchronized.
- [ ] Commit all generated files and preserve the staged regeneration drift check.

#### Phase 4: validation

- [ ] Install Nix through a pinned action on Linux and macOS runners.
- [ ] Validate every applicable flake without writing a lock file.
- [ ] Build every supported environment/system pair.
- [ ] Verify exact tool versions and Playwright coordination.
- [ ] Run rustfmt, Clippy, host, i686, and all WASM target commands for the Rust
      environments.

#### Phase 5: CI adoption

- [ ] Map every Linux and macOS CI job to its matching generated flake.
- [ ] Preserve separate Node 22, Node 24, and Node 26 execution paths.
- [ ] Keep Rust/WASM adoption blocked until complete component and target validation.
- [ ] Keep Playwright adoption blocked until its synchronization TODO is complete.
- [ ] Compare Nix-backed jobs with the existing setup-action jobs.
- [ ] Remove old Linux/macOS setup steps only after equivalent results are proven.
- [ ] Keep Windows on its native path using the synchronized versions.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and scope.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — synchronize
  the repository dependency and all tracked lockfiles with the selected CI
  Playwright release.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
