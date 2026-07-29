## 65Z-ci-nix. Generate Nix environments for Linux and macOS CI

**Priority:** P4
**Status:** open

### Summary

Generate Nix files from the existing CI source of truth in `fjs/ci/` and prove
that they reproduce the required environments on native Linux and macOS GitHub
runners.

The first goal is not OCI. The first goal is to:

1. generate correct target-specific Nix flakes;
2. build and validate them;
3. run the existing Linux and macOS CI commands directly through Nix;
4. measure build and cache behavior.

Linux OCI images and GHCR publication are later stages that must reuse already
proven Nix environments. Windows remains on the existing generated native setup
path.

### Source of truth

The maintained source remains the CI scripts and configuration, including
`fjs/ci/config/module.f.ts`.

```text
CI scripts and config
        |
        v
npm run ci-update
        |
        +-- generated GitHub Actions workflow
        +-- generated Linux/macOS Nix flakes
        +-- native Windows installation steps
```

Generated `.nix` files and `flake.lock` files are committed build artifacts.
They are not maintained manually or optimized for developer use.

### Independent generated flakes

Start without a root-level generic `flake.nix`. Generate one or more independent
flake directories and let GitHub CI reference them directly.

Possible layouts include one flake per OS/architecture:

```text
nix/generated/
  linux-x86_64/flake.nix
  linux-x86_64/flake.lock
  linux-aarch64/flake.nix
  linux-aarch64/flake.lock
  darwin-x86_64/flake.nix
  darwin-x86_64/flake.lock
  darwin-aarch64/flake.nix
  darwin-aarch64/flake.lock
```

or one flake per CI environment:

```text
nix/generated/
  node-24-linux-x86_64/flake.nix
  wasm-linux-x86_64/flake.nix
  playwright-linux-x86_64/flake.nix
  node-24-darwin-aarch64/flake.nix
```

Do not decide the permanent boundary before measuring build, evaluation, cache,
and CI concurrency behavior. A hybrid layout is valid.

A developer-oriented aggregate flake may later compose the proven generated
environments, but it is explicitly out of scope.

### Fully resolved target files

Each generated flake should describe one known target or CI environment with no
unnecessary cross-platform dispatch logic. It should include:

- the exact host OS and architecture;
- the exact set of required tools;
- exact tool versions;
- platform-specific upstream URLs and archive formats;
- hashes for every downloaded artifact;
- installation and wrapping steps;
- runtime libraries and environment variables;
- validation commands derived from the CI configuration.

Generated duplication is acceptable. Reusable abstractions belong in the
TypeScript/FunctionalScript generator; generated Nix should favor explicit,
independently debuggable build plans.

### Host systems and compilation targets

Keep host systems separate from additional compilation targets.

Host examples:

- `x86_64-linux`;
- `aarch64-linux`;
- `x86_64-darwin`;
- `aarch64-darwin`.

Targets installed into a host environment may include:

- `wasm32-wasip1`;
- `wasm32-wasip1-threads`;
- `wasm32-wasip2`;
- `wasm32-unknown-unknown`;
- `i686-unknown-linux-gnu`.

An x86-64 Linux environment that tests `i686-unknown-linux-gnu` may require a
32-bit linker and libraries, but it is still an `x86_64-linux` host flake.

### Exact upstream versions

Nix is the reproducible installer and build graph, not the version authority.
The generator should use the same upstream releases selected for Windows,
macOS, and Linux CI, even when those releases are not yet packaged by
`nixpkgs`.

For each host, generated derivations should fetch the exact upstream artifacts
using expected hashes. `nixpkgs` may provide helpers, patching tools, runtime
libraries, and later OCI builders, but it must not silently choose different
Node, Deno, Bun, Rust, Wasmtime, Wasmer, or Playwright versions.

### Maintained `nixpkgs` revision

The `nixpkgs` revision must have one deterministic maintained source. Add an
exact full Git commit SHA to maintained `fjs/ci/` configuration, for example
`config.nix.nixpkgsRevision`.

Do not infer this value from an existing generated lock file and do not resolve
a moving branch during generation.

Every generated flake must derive its input from the configured revision:

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/<configured-full-commit>";
```

`npm run ci-update` must generate or refresh each `flake.lock` from this exact
revision and verify that every `locked.rev` equals the maintained value.
Creating a new flake or recreating a deleted lock must therefore select the same
revision as every other generated flake.

A temporary target-specific revision must be declared explicitly in maintained
configuration. Lock-file drift is never an implicit exception.

### Playwright

Treat Playwright as a coordinated bundle rather than a single executable. Keep
these parts synchronized:

- the package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser artifacts and hashes;
- required native runtime libraries;
- browser-path environment variables.

The generated workflow should preserve the commands already emitted by
`fjs/ci/playwright/module.f.ts`:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=firefox
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=webkit
```

Do not invent a new package script merely for the Nix wrapper.

### Nix bootstrap for generation and CI

Generating or using the flakes requires Nix. Once `npm run ci-update` creates
or refreshes `flake.lock`, the existing `node26` generation/drift-check job must
install Nix before running the generator. Linux and macOS validation and direct
CI jobs also need the bootstrap before their first Nix command.

The generated workflow should perform this sequence where applicable:

1. check out the repository;
2. install Nix using a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache strategy;
4. run generation or invoke the target-specific flake.

The Phase 1 generation/drift check must preserve the repository's existing
staged-diff pattern:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - uses: <nix-installer-action>@<pinned-version>
  - uses: <nix-cache-action>@<pinned-version>
  - run: npm run ci-update
  - run: git add -A && git diff --cached --exit-code
```

`git add -A` is required before the comparison. A plain
`git diff --exit-code` does not detect newly generated untracked files. The
staged comparison must detect additions, deletions, and modifications.

The bootstrap must precede Phase 1 lock regeneration and the first Nix command
in Phases 2 and 3. Windows jobs do not use this bootstrap.

### Staged rollout

#### Phase 1: generate the Nix files

Generate deterministic target-specific flakes, lock files, exact artifact
fetches, validation definitions, and workflow paths. Generation must delete
stale outputs and fail when a required platform artifact is unavailable.

The `node26` regeneration job must install Nix before `npm run ci-update`, then
run:

```sh
git add -A
git diff --cached --exit-code
```

Phase 1 succeeds only when regeneration produces no staged additions,
deletions, or modifications.

#### Phase 2: build and validate the Nix files

Before changing existing CI jobs, prove that every generated flake:

1. evaluates successfully;
2. builds its declared environment;
3. reports every expected exact tool version;
4. runs representative commands for every packaged tool;
5. uses the expected Playwright package and browser bundle;
6. supports the required Rust, WASM, and 32-bit targets.

A failure must identify the exact generated flake so it can be reproduced and
debugged independently.

#### Phase 3: run CI directly through Nix

After Phase 2 succeeds, convert Linux and macOS jobs to execute their existing
commands through the generated flakes using `nix develop --command` or an
equivalent direct Nix invocation.

This phase intentionally does not create or consume OCI images. Compare the
Nix-backed jobs with the existing setup-action jobs until equivalent coverage
and results are established.

#### Phase 4: measure and choose environment boundaries

Measure:

- cold and warm build times;
- evaluation time;
- cache reuse;
- duplicated downloads;
- CI concurrency behavior;
- failure and debugging isolation.

Use those measurements to choose per-OS/architecture, per-job, per-major-version,
or hybrid boundaries.

#### Later phases: OCI images

Only after direct Linux CI works reliably through the generated flakes should
Linux flakes gain OCI outputs. OCI generation, GHCR publication, and optional CI
consumption are covered by
[65Z-ci-scenario-docker](65z-ci-scenario-docker.md) and Phases 5 and 6 in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

### Tasks

#### Phase 1: generation

- [ ] Extend `npm run ci-update` to generate target-specific Nix files with exact
      versions, upstream URLs, archive formats, and hashes.
- [ ] Add the exact full `nixpkgs` commit to maintained `fjs/ci/` configuration.
- [ ] Generate every flake input and lock from that configured revision and verify
      each lock's `locked.rev` matches it.
- [ ] Generate independent flakes for native Linux and macOS CI; do not add a
      root-level generic flake.
- [ ] Update the existing `node26` regeneration job to install pinned Nix and
      configure the selected cache before `npm run ci-update`.
- [ ] Preserve `git add -A && git diff --cached --exit-code` so generated additions,
      deletions, and modifications all fail the drift check.
- [ ] Delete stale generated files when a tool, major version, system,
      architecture, target, or job is removed.
- [ ] Generate exact installed-version and representative execution checks.
- [ ] Model host systems separately from Rust/WASM/32-bit compilation targets.
- [ ] Generate Playwright as a coordinated package, driver, browser, and native
      dependency bundle.

#### Phase 2: build and validation

- [ ] Reuse the pinned Nix installer and cache bootstrap before the first Nix
      command in every Linux and macOS validation job.
- [ ] Verify the bootstrap on every supported Linux and macOS runner architecture.
- [ ] Prove that every generated flake evaluates, builds, and passes its checks.
- [ ] Validate Playwright with the existing browser-specific CI commands.
- [ ] Validate required Rust, WASM, and 32-bit targets.

#### Phase 3: direct Nix CI

- [ ] Run existing Linux and macOS CI commands directly through the generated
      flakes without OCI images.
- [ ] Preserve the existing Playwright commands generated by
      `fjs/ci/playwright/module.f.ts`.
- [ ] Compare results with existing setup-action jobs before removing them.
- [ ] Keep native Windows jobs on the existing generated installation steps.

#### Phase 4: measurements

- [ ] Benchmark per-OS/architecture, per-job, per-major-version, and hybrid flake
      boundaries.
- [ ] Measure cold and warm build times, evaluation, cache reuse, duplicated
      downloads, CI concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI results are available.

### Out of scope

- OCI image generation and GHCR publication until direct Nix CI is proven;
- a developer-oriented aggregate `flake.nix`.

### Related

- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — blocked OCI stage after
  direct Nix CI succeeds.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  implementation plan.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
