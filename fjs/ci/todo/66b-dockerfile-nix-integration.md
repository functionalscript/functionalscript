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
scope. Do not create custom derivations, overlays, or a FunctionalScript package
source until a concrete missing-package requirement exists.

Each generated flake must be independently debuggable. It embeds the pinned
Nixpkgs commit and all environment-specific logic directly in its own `flake.nix`.
It must not import shared generated Nix modules.

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
2. evaluate every configured package attribute on each required Nix system;
3. reject any missing, broken, unsupported, or version-divergent package;
4. update `nix.nixpkgs.rev`;
5. copy the accepted top-level versions into the existing exact version exports;
6. run the ordinary Nix-independent CI generator;
7. expose all config and generated-file changes for review.

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

Ordinary `npm run update` and `npm run ci-update` must not resolve a moving ref,
invoke Nix, or access the network. They remain runnable on native Windows.

### 3. Generate standalone flake directories

Extend the existing CI generator to emit independent directories such as:

```text
nix/generated/
  node22/flake.nix
  node24/flake.nix
  node26/flake.nix
  deno/flake.nix
  bun/flake.nix
  wasm/flake.nix
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
- include required Rust targets and environment variables when applicable;
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

The staged comparison catches newly generated files, deletions, and modifications.
The generator must produce byte-identical output on Linux, macOS, and native
Windows.

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

The first implementation is complete when every committed flake validates on all
systems on which its corresponding CI environment runs.

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

Playwright package and browser synchronization is tracked separately in
[playwright-package-version-sync](playwright-package-version-sync.md). A Nixpkgs
update must not silently combine a different driver/browser bundle with the local
`@playwright/test` dependency.

### 7. Later extensions

The following are explicitly out of scope for the first implementation:

- custom package derivations;
- a FunctionalScript Nix package source or overlay;
- shared generated Nix modules;
- generated `flake.lock` metadata;
- a private binary cache;
- OCI image generation or publication;
- replacing CI jobs before the generated flakes validate.

A custom package source should be introduced only when an official stable
Nixpkgs snapshot cannot provide a concrete required tool or platform. OCI images
remain the last stage and must reuse the already proven standalone flakes.

### Tasks

#### Phase 1: source and package discovery

- [ ] Add the official stable Nixpkgs ref, exact commit, and package attributes to
      `fjs/ci/config/module.f.ts`.
- [ ] Extract Rust into a normal exact version export shared by Windows and Nix.
- [ ] Add `npm run ci-nix-update`.
- [ ] Resolve the latest commit of the configured stable ref.
- [ ] Evaluate package attributes on every system required by their environments.
- [ ] Fail on missing, broken, unsupported, or version-divergent packages.

#### Phase 2: cross-platform version synchronization

- [ ] Update the exact Nixpkgs commit and all accepted top-level package versions
      in one operation.
- [ ] Keep existing Windows setup generators reading the synchronized version
      exports.
- [ ] Show version changes clearly in the generated diff.

#### Phase 3: standalone generated flakes

- [ ] Generate independent flake directories from `npm run ci-update`.
- [ ] Generate separate Node 22, Node 24, and Node 26 flakes.
- [ ] Pin every input URL to the exact configured GitHub commit.
- [ ] Keep each generated `flake.nix` self-contained and free of generated imports.
- [ ] Generate package metadata assertions and executable version checks.
- [ ] Do not generate `flake.lock` or custom package derivations.
- [ ] Commit all generated files and preserve the staged regeneration drift check.

#### Phase 4: validation

- [ ] Install Nix through a pinned action on Linux and macOS runners.
- [ ] Validate every applicable flake without writing a lock file.
- [ ] Build every supported environment/system pair.
- [ ] Verify exact tool versions, Playwright coordination, and compilation targets.

#### Phase 5: CI adoption

- [ ] Map every Linux and macOS CI job to its matching generated flake.
- [ ] Preserve separate Node 22, 24, and 26 execution paths.
- [ ] Compare Nix-backed jobs with the existing setup-action jobs.
- [ ] Remove old Linux/macOS setup steps only after equivalent results are proven.
- [ ] Keep Windows on its native path using the synchronized versions.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and scope.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage.
- [playwright-package-version-sync](playwright-package-version-sync.md) — synchronize
  the repository dependency with the selected CI Playwright release.
- [i096](96.md) — CI caching.
- [Official NixOS 26.05 channel](https://channels.nixos.org/nixos-26.05) — example
  stable source resolving to an immutable GitHub Nixpkgs commit.
