## 65Z-ci-nix. Generate standalone CI flakes from official Nixpkgs

**Priority:** P3
**Status:** open

### Problem

Linux and macOS CI install the same top-level tools as Windows, but through
separate generated setup steps. The previous Nix proposal also recreated package
recipes, upstream URLs, hashes, installation logic, and lock metadata in the
FunctionalScript generator.

That is too much machinery for the first Nix milestone. Official Nixpkgs already
contains package definitions, dependency graphs, platform fixes, and binary-cache
artifacts. FunctionalScript should initially use only versions already available
from one official stable Nixpkgs snapshot.

Windows still requires exact version strings for its native installers. Therefore,
the selected Nixpkgs snapshot and the cross-platform version constants in
`fjs/ci/config/module.f.ts` must be updated together.

A single shell cannot represent the existing Node 22, 24, and 26 CI matrix. Those
packages expose the same executable names, so placing them in one shell would let
`PATH` silently choose only one Node version.

Rust also cannot be represented by only `rustc` and `cargo`. Existing CI uses
`rustfmt`, Clippy, the `i686-unknown-linux-gnu` standard library and linker support,
and these WASM target standard libraries:

- `wasm32-wasip1`;
- `wasm32-wasip2`;
- `wasm32-unknown-unknown`;
- `wasm32-wasip1-threads`.

A Rust or WASM flake is not equivalent to the existing setup until every required
component and target is supplied and the existing commands pass.

### Proposal

Use one configured official stable Nixpkgs ref, for example `nixos-26.05`, and one
explicit update command:

```sh
npm run ci-nix-update
```

The command treats the complete configured Nix environment set as one atomic
snapshot. It runs on a documented Nix-capable host and performs these steps in
order:

1. resolve a candidate latest GitHub commit of the configured official stable
   Nixpkgs ref;
2. read every configured Nix package version on every supported Nix host without
   changing maintained files;
3. verify every configured Rust component, target provider, linker, and runtime
   package on each system that uses it;
4. verify that all other configured environments, including Playwright dependency
   and lockfile synchronization when Playwright is enabled, can be generated from
   the same candidate revision;
5. reject the entire candidate without changing config, dependency metadata, or
   generated files when any configured environment fails;
6. atomically update the exact Nixpkgs commit, all top-level package versions, and
   any synchronized dependency metadata in `fjs/ci/config/module.f.ts` and the root
   package files;
7. run the ordinary CI generator, which emits the complete standalone generated
   flake tree;
8. leave the config, dependency metadata, and generated flake changes ready to
   commit and review.

Each generated directory contains a complete `flake.nix` with no imports or
references to other generated Nix files. Generated duplication is intentional: a
failed CI environment can be copied, inspected, evaluated, and built independently.

The first implementation does not add OCI outputs, overlays, a private package
source, shared Nix modules, or hand-maintained upstream package recipes.

After a generated flake builds and reports the expected versions on Linux and
macOS, existing CI jobs can start invoking it directly. Windows continues using
its native setup path with the exact versions copied from the selected Nixpkgs
snapshot.

Snapshot selection and generation are atomic, while CI adoption remains
incremental. A future environment may remain outside the configured Nix set until
its package and target requirements are understood. Once an environment is added
to that set, every future candidate revision must satisfy it. Individual jobs may
switch to their validated flakes at different times without changing this atomic
source-selection rule.

### Configuration

Keep the existing exact version constants because they are the cross-platform CI
contract. Add the Nixpkgs source, package-attribute mapping, and complete Rust
requirements:

```ts
export const bun = '1.3.14'
export const deno = '2.9.4'
export const playwright = '1.62.0'

export const node = {
    default: '26.5.0',
    node22: '22.23.1',
    node24: '24.18.0',
} as const

export const rust = '1.97.1'
export const wasmtime = '47.0.2'
export const wasmer = '7.2.1'

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

The exact attribute names are validated against the selected snapshot. A package
attribute is accepted only when it exists on every required Nix system for the CI
environment that uses it and reports the expected version.

The target list is also executable configuration, not documentation. For each
target, `ci-nix-update` must evaluate the corresponding official-Nixpkgs target
standard-library/toolchain expression and any required native support packages.
For `i686-unknown-linux-gnu`, this includes the 32-bit linker and libc development
support currently installed by CI. A generated Rust environment must combine the
host `rustc`, `cargo`, `rustfmt`, and Clippy commands with all target standard
libraries required by that environment.

Because `nix.nixpkgs.rev` is shared, there is no per-environment revision fallback.
If the candidate snapshot cannot provide any package, platform, Rust component,
target standard library, linker, runtime, or other requirement in the configured
Nix environment set, `ci-nix-update` rejects the candidate entirely and preserves
the previously committed revision, versions, dependency metadata, and generated
flake tree.

An unsupported future environment may remain explicitly outside the configured
Nix set and continue using its existing setup action. Adding it later is a reviewed
configuration change; silently dropping a previously configured environment is not
an update fallback.

The update command owns changes to `nix.nixpkgs.rev` and the existing top-level
version constants. Ordinary `npm run ci-update` never resolves a moving Nixpkgs
ref, invokes Nix, or accesses the network and remains runnable on native Windows.

`npm run update` is not required to be offline: it deliberately updates project
dependencies and may access package registries. When it invokes `npm run ci-update`,
that CI-generation subcommand must still consume only committed configuration and
perform no Nix or network resolution.

### Generated standalone flakes

Generate one independent flake directory per CI environment or version family.
The initial layout may include:

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

A generated flake must not import another generated `.nix` file. Each file embeds:

- the exact Nixpkgs Git commit;
- the supported systems for that environment;
- only the package attributes required by that environment;
- exact metadata assertions;
- executable version checks;
- required environment variables, components, and compilation targets;
- a generated-file warning.

For example, `nix/generated/node22/flake.nix` contains `pkgs.nodejs_22`, while
`node24` and `node26` contain only their corresponding package. CI selects the
required environment by directory:

```sh
nix develop ./nix/generated/node22 --command npm test
nix develop ./nix/generated/node24 --command npm test
nix develop ./nix/generated/node26 --command npm test
```

This preserves the existing Node matrix because every shell exposes exactly one
`node` and `npm` implementation.

A Rust platform flake must expose `rustc`, `cargo`, `rustfmt`, and
`cargo clippy`, plus the host standard library. On x86-64 Linux it must also
supply the `i686-unknown-linux-gnu` standard library and 32-bit linker/runtime
support. A Rust WASM flake must additionally supply all four configured WASM
standard libraries together with the selected Wasmtime and Wasmer packages.

Before either Rust flake is committed, its validation must run the same command
families as the existing jobs: formatting, debug/release tests, debug/release
Clippy, i686 tests where applicable, and the Wasmtime/Wasmer WASM tests. Listing a
target name without proving a successful compilation is insufficient.

The generator owns the complete `nix/generated/` tree. Before writing current
outputs, it must delete that tree recursively and recreate it from the current CI
configuration. This deterministic cleanup removes flakes for renamed or deleted CI
environments instead of leaving stale committed directories that may still be
validated or consumed.

Atomic snapshot rejection occurs before this destructive regeneration step. A
failed candidate therefore cannot erase or partially replace the generated tree
for the previously accepted revision.

Do not generate `flake.lock` in this first milestone. The exact Git commit in each
input URL pins the package source. Initial validation and CI commands must prevent
Nix from writing an uncommitted lock file, for example with the appropriate
`--no-write-lock-file` option. Adding committed lock files can be evaluated later
as a separate improvement.

### Version synchronization

The update command queries every configured attribute for every supported system.
For example, Node 26 is accepted only when all systems used by that environment
expose:

```text
nodejs_26.version = 26.5.0
```

After the complete candidate snapshot passes, the command writes `26.5.0` to
`node.default`. Linux and macOS obtain `pkgs.nodejs_26`; Windows installs
`node.default` through the existing native setup action. Both paths run an
executable version check.

Rust is accepted only when `rustc`, Cargo, rustfmt, and Clippy correspond to the
candidate Rust release and every required target compilation succeeds. A matching
`rustc --version` alone does not satisfy the Rust environment contract.

If the latest stable Nixpkgs candidate does not contain any required package,
platform, matching version, Rust component, or target provider, the complete
snapshot update fails before maintained files are written. We do not create a
custom upstream package recipe in this phase. A FunctionalScript package source or
overlay may be proposed later after a concrete missing-package case exists.

Playwright has an additional project dependency synchronization requirement. That
existing bug is tracked separately in
[playwright-package-version-sync](playwright-package-version-sync.md). When the
root `package.json` already contains `@playwright/test`, the exact dependency and
all tracked dependency lockfiles, including `package-lock.json`, `deno.lock`, and
`bun.lock`, must match the selected CI and Nixpkgs Playwright version.

Playwright should remain outside the configured Nix environment set until that
synchronization TODO is complete. Once Playwright is configured, inability to
synchronize its package or any tracked lockfile rejects the complete candidate
snapshot; it does not permit a partial revision update.

### CI adoption

CI adoption is a separate follow-up after the generated files are committed and
validated:

1. install Nix on Linux and macOS runners using a pinned action;
2. run `nix flake check` for each generated directory without rewriting inputs;
3. run each existing CI command inside its corresponding generated shell;
4. compare the Nix-backed jobs with the existing setup-action jobs;
5. remove old Linux/macOS setup steps only after equivalent coverage is proven.

Rust and WASM adoption has an additional gate: every existing format, Clippy,
native, i686, and WASM command must pass through the generated flakes before the
current Rust setup action is removed.

OCI images remain later work. They may eventually be built from the same proven
standalone flakes, but they are not part of generating or validating the first
files.

### Tasks

- [ ] Add a configured official stable Nixpkgs ref and exact revision to
      `fjs/ci/config/module.f.ts`.
- [ ] Define the explicit set of environments governed by the shared Nixpkgs
      revision.
- [ ] Add Nix package-attribute mappings for the top-level CI tools.
- [ ] Extract Rust into a normal exact version constant shared by Windows and Nix.
- [ ] Map `rustc`, Cargo, rustfmt, and Clippy as required Rust components.
- [ ] Record the i686 and four WASM target requirements in maintained CI config.
- [ ] Define and validate an official-Nixpkgs target standard-library/toolchain
      provider plus required linker/runtime packages for every Rust target.
- [ ] Add `npm run ci-nix-update` for resolving the latest stable commit and
      querying package versions on supported Nix systems.
- [ ] Evaluate the complete candidate revision without modifying maintained files.
- [ ] Reject the complete candidate when any configured package, platform, Rust
      component, target standard library, linker, runtime, or synchronization
      requirement fails.
- [ ] Atomically update the shared revision, all accepted version constants,
      dependency metadata, and generated tree only after every configured
      environment passes.
- [ ] Preserve the previous revision, versions, dependency files, and generated
      tree after every rejected candidate.
- [ ] Require Playwright dependency and `package-lock.json`, `deno.lock`, and
      `bun.lock` synchronization before adding Playwright to the configured Nix set.
- [ ] Extend `npm run ci-update` to generate standalone flake directories without
      invoking Nix or accessing the network.
- [ ] Keep the network-free requirement scoped to `npm run ci-update`; allow the
      broader dependency-updating `npm run update` workflow to access registries.
- [ ] Delete and recreate the complete generated flake tree before emitting current
      outputs so renamed or removed environments leave no stale directories.
- [ ] Generate separate Node 22, Node 24, and Node 26 flakes so each shell contains
      exactly one Node package.
- [ ] Keep every generated `flake.nix` self-contained with no generated-file
      imports.
- [ ] Generate metadata and executable version checks from the config.
- [ ] Validate Rust flakes with rustfmt, Clippy, native, i686, and all configured
      WASM target commands before adoption.
- [ ] Keep Rust/WASM jobs on the existing setup action until that complete
      validation succeeds.
- [ ] Block Playwright flake generation, validation, and adoption until
      [playwright-package-version-sync](playwright-package-version-sync.md) is
      complete.
- [ ] Commit all generated `flake.nix` files and preserve
      `git add -A && git diff --cached --exit-code` in the regeneration check.
- [ ] Validate every committed flake on its supported Linux and macOS runners
      without writing a lock file.
- [ ] Add a follow-up CI phase that runs existing Linux/macOS commands through the
      matching validated flakes.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — keep the
  repository Playwright dependency and all tracked lockfiles synchronized with CI.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source whose release points to an immutable GitHub Nixpkgs commit.