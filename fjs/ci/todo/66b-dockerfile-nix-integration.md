## 66B-dockerfile-nix-integration. Generate one official-Nixpkgs CI flake

**Priority:** P3
**Status:** open

### Problem

The current Linux and macOS CI jobs install tools through generated GitHub
Actions steps, while Windows uses exact version strings from
`fjs/ci/config/module.f.ts`. The previous Nix implementation plan reproduced
package recipes, upstream URLs, hashes, lock metadata, and multiple target flakes
inside the FunctionalScript generator.

That complexity is unnecessary for the first milestone. We first need to prove
that one pinned official stable Nixpkgs snapshot can supply the required tools and
that one committed generated `flake.nix` can run the existing Linux and macOS CI
commands.

### Proposal

Implement the simpler path in these ordered phases:

```text
Phase 1: resolve the latest official stable Nixpkgs commit
Phase 2: synchronize its top-level package versions into CI config
Phase 3: generate and commit one root flake.nix
Phase 4: build and validate the committed flake
Phase 5: run Linux/macOS CI through the flake
Later: consider custom packages, caches, and OCI images
```

Only versions already packaged by the selected official Nixpkgs snapshot are in
scope. Do not create custom derivations, overlays, or a FunctionalScript package
source until a concrete missing-package requirement exists.

### 1. Configure the official package source

Add a Nix section to `fjs/ci/config/module.f.ts` containing:

- the maintained stable ref, initially `nixos-26.05`;
- the exact resolved GitHub commit;
- the Nixpkgs attribute used for each top-level CI tool.

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
        },
        wasmtime: 'wasmtime',
        wasmer: 'wasmer',
    },
} as const
```

Keep the existing version exports. They remain the cross-platform contract used
by Windows native installers and by generated Nix assertions.

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
2. evaluate every configured package attribute on:
   - `x86_64-linux`;
   - `aarch64-linux`;
   - `x86_64-darwin`;
   - `aarch64-darwin`;
3. reject any missing, broken, unsupported, or version-divergent package;
4. update `nix.nixpkgs.rev`;
5. copy the accepted top-level versions into the existing exact version exports;
6. run the ordinary Nix-independent CI generator;
7. expose all config and generated-file changes for review.

For example, if the selected snapshot reports `nodejs_26.version = "26.5.0"`
on every supported system, the command writes:

```ts
export const node = {
    default: '26.5.0',
    // ...
} as const
```

Windows then installs `26.5.0` natively, while Linux and macOS use
`pkgs.nodejs_26` from the exact pinned snapshot.

Ordinary `npm run update` and `npm run ci-update` must not resolve a moving ref,
invoke Nix, or access the network. They remain runnable on native Windows.

### 3. Generate one root `flake.nix`

Extend the existing CI generator to emit one root `flake.nix` from the committed
configuration.

The generated file must:

- embed the exact Nixpkgs commit in the input URL;
- support the four required Linux and macOS systems;
- use only configured official Nixpkgs attributes;
- expose one default CI/development shell per supported system;
- assert package metadata versions against the exact config versions;
- generate executable version checks;
- include required Rust targets and environment variables;
- contain a generated-file warning;
- remain readable and independently debuggable.

Conceptually:

```nix
{
  inputs.nixpkgs.url =
    "github:NixOS/nixpkgs/<configured-exact-commit>";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
    in
    # Generated devShells and checks.
    { };
}
```

Do not generate `flake.lock` in this phase. The input URL already contains the
exact immutable Git commit. Validation and CI invocations must prevent Nix from
writing a lock file. A committed lock can be evaluated later as a separate
improvement.

Do not generate multiple target-specific flakes in this first implementation.
Split the flake only after real evaluation, build, cache, or isolation measurements
show a need.

### 4. Commit and check the generated file

`flake.nix` is a committed generated artifact. The existing regeneration check
must remain:

```sh
npm run ci-update
git add -A
git diff --cached --exit-code
```

The staged comparison catches a newly generated file, deletion, or modification.
The generator must produce byte-identical output on Linux, macOS, and native
Windows.

The explicit `ci-nix-update` command changes the pinned commit and package
versions. Ordinary regeneration only renders the already committed configuration.

### 5. Validate before changing CI

Add Linux and macOS validation jobs that:

1. install Nix through a pinned trusted action;
2. evaluate the generated flake without writing a lock;
3. build the default shell for the runner system;
4. run metadata and executable version checks;
5. verify Node, Deno, Bun, Rust, Wasmtime, Wasmer, and Playwright behavior;
6. verify required Rust, WASM, and 32-bit compilation targets;
7. fail without changing the committed config or generated file.

The first implementation is complete when the one committed flake validates on
all four supported Nix systems.

### 6. Use the flake in CI

After validation succeeds, convert Linux and macOS jobs incrementally:

```text
checkout
install Nix
enter the generated default shell
run the existing CI command
```

Preserve existing commands, including the Playwright browser-specific commands.
Run Nix-backed and setup-action jobs in parallel until their coverage and results
match. Windows remains on the existing native path with the synchronized exact
versions.

### 7. Later extensions

The following are explicitly out of scope for the first PR implementing this
plan:

- custom package derivations;
- a FunctionalScript Nix package source or overlay;
- multiple generated flakes;
- generated `flake.lock` metadata;
- a private binary cache;
- OCI image generation or publication;
- replacing CI jobs before the generated flake validates.

A custom package source should be introduced only when an official stable
Nixpkgs snapshot cannot provide a concrete required tool or platform. OCI images
remain the last stage and must reuse the already proven flake.

### Tasks

#### Phase 1: source and package discovery

- [ ] Add the official stable Nixpkgs ref, exact commit, and package attributes to
      `fjs/ci/config/module.f.ts`.
- [ ] Extract Rust into a normal exact version export shared by Windows and Nix.
- [ ] Add `npm run ci-nix-update`.
- [ ] Resolve the latest commit of the configured stable ref.
- [ ] Evaluate all package attributes on all four supported systems.
- [ ] Fail on missing, broken, unsupported, or version-divergent packages.

#### Phase 2: cross-platform version synchronization

- [ ] Update the exact Nixpkgs commit and all accepted top-level package versions
      in one operation.
- [ ] Keep existing Windows setup generators reading the synchronized version
      exports.
- [ ] Show the version changes clearly in the generated diff.

#### Phase 3: generated flake

- [ ] Generate one root `flake.nix` from `npm run ci-update`.
- [ ] Pin the input URL to the exact configured GitHub commit.
- [ ] Generate shells and checks for all supported Linux and macOS systems.
- [ ] Generate package metadata assertions and executable version checks.
- [ ] Do not generate `flake.lock` or custom package derivations.
- [ ] Commit `flake.nix` and preserve the staged regeneration drift check.

#### Phase 4: validation

- [ ] Install Nix through a pinned action on Linux and macOS runners.
- [ ] Validate the flake without writing a lock file.
- [ ] Build every supported system shell.
- [ ] Verify exact tool versions, Playwright, and compilation targets.

#### Phase 5: CI adoption

- [ ] Run existing Linux and macOS CI commands inside the generated shell.
- [ ] Compare Nix-backed jobs with the existing setup-action jobs.
- [ ] Remove old Linux/macOS setup steps only after equivalent results are proven.
- [ ] Keep Windows on its native path using the synchronized versions.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and scope.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
