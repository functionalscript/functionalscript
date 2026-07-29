## 65Z-ci-nix. Generate Nix environments for Linux and macOS CI

**Priority:** P4
**Status:** open

### Problem

Linux and macOS CI currently install tools through generated GitHub Actions
steps. This duplicates installation logic and does not provide one exact-version
environment definition that can be built and debugged independently.

The Nix work must preserve the existing cross-platform generator workflow.
`npm run update` invokes `npm run ci-update` and must remain runnable on native
Windows. Ordinary generation therefore cannot require a local Nix installation.

The first implementation should prove that generated Nix environments can
represent and run the existing CI jobs. Requiring the generator to discover and
maintain every platform-specific artifact hash and a complete Nix lock graph
would add a separate update system before the basic design is proven.

OCI images are also a separate concern. Creating them before the generated Nix
environments are proven would make it difficult to distinguish Nix-generation
failures from OCI packaging and distribution failures.

### Proposal

Generate explicit target-specific Nix flakes from the existing `fjs/ci/` source
of truth, commit those generated files, validate them on native Linux and macOS,
and then run existing CI commands directly through Nix.

Use this order:

```text
Phase 1: generate exact-version target-specific Nix flakes
Phase 2: build and validate every generated flake
Phase 3: run Linux/macOS CI directly through Nix
Phase 4: measure and select useful flake boundaries
Later: add content hashes and Nix lock files
Later: add OCI outputs, publication, and optional consumption
```

The first four phases do not create, publish, pull, or run OCI images. Windows
keeps its existing native generated installation path.

A developer-oriented aggregate `flake.nix` may be added later, but it is
explicitly out of scope and must not constrain the initial CI layout.

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

Generated `.nix` files are committed build artifacts. They are not maintained
manually. Reusable abstractions belong in the TypeScript/FunctionalScript
generator.

### Reproducibility boundary

Phase 1 locks the CI environment by exact published tool and package versions.
It assumes that an upstream publisher does not replace the artifact associated
with an already published version.

This is weaker than content-addressed reproducibility, but it keeps routine
version updates simple and is sufficient to prove the generated-environment
design. Collecting platform-specific artifact hashes and generating
`flake.lock` files are tracked separately in
[65Z-ci-nix-locks](65z-ci-nix-locks.md).

The two deferred mechanisms solve different problems:

- artifact hashes verify the bytes downloaded for an exact tool version;
- `flake.lock` records the exact Nix input graph, including inputs such as
  `nixpkgs`.

Neither should block generation, validation, or direct CI use of the first
exact-version Nix environments.

### Cross-platform generation

`npm run ci-update` must be Nix-independent. It must run with the repository's
supported Node environment on Linux, macOS, and native Windows.

The maintained CI configuration should contain the exact version, revision, URL,
archive format, host, architecture, and installation metadata needed to render
the generated Nix files. Ordinary generation must not:

- invoke Nix;
- discover or compute artifact hashes;
- generate or update `flake.lock`;
- resolve a moving version or branch;
- download tools merely to regenerate committed files.

Updating an exact tool version or selected Nix input revision remains an
ordinary maintained-configuration change followed by `npm run ci-update`.

### Independent generated flakes

Start without a root-level generic `flake.nix`. Generate one or more independent
flake directories and let GitHub CI reference them directly.

Possible layouts include one flake per OS/architecture:

```text
nix/generated/
  linux-x86_64/flake.nix
  linux-aarch64/flake.nix
  darwin-x86_64/flake.nix
  darwin-aarch64/flake.nix
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

### Fully resolved target files

Each generated flake should describe one known target or CI environment without
unnecessary cross-platform dispatch logic. It should include:

- the exact host OS and architecture;
- the exact required tools and versions;
- platform-specific upstream URLs and archive formats;
- installation and wrapping steps;
- runtime libraries and environment variables;
- validation commands derived from the CI configuration.

A target may use a package already provided by the selected Nix input or a
temporary version-based installation mechanism. Phase 1 does not require the
generator to own expected hashes for every upstream artifact.

Generated duplication is acceptable because each file is a compiled CI artifact
and a minimal reproduction for its environment.

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
32-bit linker and libraries, but it remains an `x86_64-linux` host flake.

### Exact upstream versions

Nix is the environment and build-graph mechanism, not the version authority.
The generator should use the same exact upstream releases selected for Windows,
macOS, and Linux CI, even when those releases are not yet packaged by `nixpkgs`.

`nixpkgs` may provide helpers, patching tools, runtime libraries, and later OCI
builders, but it must not silently select different Node, Deno, Bun, Rust,
Wasmtime, Wasmer, or Playwright versions.

The generated file must make the selected version visible and validation must
confirm the installed version. Stronger byte-level verification is deferred to
[65Z-ci-nix-locks](65z-ci-nix-locks.md).

### Playwright

Treat Playwright as a coordinated bundle rather than a single executable. Keep
these parts synchronized:

- package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser artifacts;
- required native runtime libraries;
- browser-path environment variables.

Preserve the commands already generated by `fjs/ci/playwright/module.f.ts`:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=firefox
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=webkit
```

Do not invent a new package script merely for the Nix wrapper.

### Regeneration drift check

The existing generation job does not need Nix because ordinary generation is
Nix-independent. It must preserve the repository's staged-diff pattern:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - run: npm run ci-update
  - run: git add -A && git diff --cached --exit-code
```

`git add -A` is required before comparison. A plain `git diff --exit-code`
does not detect newly generated untracked files. The staged comparison must
detect additions, deletions, and modifications.

### Nix bootstrap for validation and direct CI

Nix is required only when evaluating, building, validating, or entering the
generated flakes. Linux and macOS jobs must therefore:

1. check out the repository;
2. install Nix using a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache strategy;
4. invoke the target-specific generated flake without requiring a committed
   `flake.lock`.

Validation must not silently make a generated `flake.lock` part of the committed
Phase 1 output. Windows jobs do not use this bootstrap.

### Staged rollout

#### Phase 1: generation

Generate target-specific `flake.nix` files, exact version selections,
installation definitions, validation definitions, and workflow paths.

Phase 1 succeeds when:

- `npm run ci-update` runs on Linux, macOS, and native Windows without Nix;
- generation deletes stale outputs;
- required platform versions and installation sources are represented or
  generation fails;
- `git add -A && git diff --cached --exit-code` reports no change.

Phase 1 intentionally does not collect artifact hashes or generate
`flake.lock`.

#### Phase 2: build and validation

After installing Nix on Linux and macOS, prove that every generated flake:

1. evaluates without requiring a committed `flake.lock`;
2. builds or prepares its declared environment;
3. reports every expected exact tool version;
4. runs representative commands for every packaged tool;
5. uses the expected Playwright package and browser bundle;
6. supports the required Rust, WASM, and 32-bit targets.

A failure must identify the exact generated flake so it can be reproduced and
debugged independently.

#### Phase 3: direct Nix CI

After Phase 2 succeeds, convert Linux and macOS jobs to execute their existing
commands through generated flakes using `nix develop --command` or an equivalent
direct Nix invocation.

This phase intentionally does not create or consume OCI images. Compare the
Nix-backed jobs with existing setup-action jobs until equivalent coverage and
results are established.

#### Phase 4: measurements

Measure:

- cold and warm build times;
- evaluation time;
- cache reuse;
- duplicated downloads;
- CI concurrency behavior;
- failure and debugging isolation.

Use those measurements to choose per-OS/architecture, per-job,
per-major-version, or hybrid boundaries.

#### Later phases: stronger locking and OCI images

After the exact-version environments work, use
[65Z-ci-nix-locks](65z-ci-nix-locks.md) to add automated artifact hashes and Nix
input lock files.

Only after direct Linux CI works reliably through generated flakes should Linux
flakes gain OCI outputs. OCI generation, GHCR publication, and optional CI
consumption are covered by
[65Z-ci-scenario-docker](65z-ci-scenario-docker.md) and Phases 5 and 6 in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

### Tasks

#### Phase 1: generation

- [ ] Extend `npm run ci-update` to generate exact-version target-specific
      `flake.nix` files without invoking Nix.
- [ ] Keep `npm run update` and `npm run ci-update` runnable on native Windows.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Keep exact tool versions, host metadata, source URLs, archive formats, and
      installation logic in maintained CI configuration.
- [ ] Do not require artifact-hash discovery or `flake.lock` generation in
      Phase 1.
- [ ] Preserve `git add -A && git diff --cached --exit-code` so additions,
      deletions, and modifications all fail the drift check.
- [ ] Delete stale generated files when tools, versions, systems,
      architectures, targets, or jobs are removed.
- [ ] Generate exact installed-version and representative execution checks.
- [ ] Model hosts separately from Rust/WASM/32-bit compilation targets.
- [ ] Generate Playwright as a coordinated package, driver, browser, and native
      dependency bundle.

#### Phase 2: build and validation

- [ ] Install pinned Nix and configure the selected cache before the first Nix
      command in every Linux and macOS validation job.
- [ ] Prove every generated flake evaluates and works without requiring a
      committed `flake.lock`.
- [ ] Prove every generated environment reports its expected exact versions and
      passes representative checks.
- [ ] Validate Playwright with the existing browser-specific CI commands.
- [ ] Validate required Rust, WASM, and 32-bit targets.

#### Phase 3: direct Nix CI

- [ ] Run existing Linux and macOS CI commands directly through generated flakes
      without OCI images.
- [ ] Preserve existing Playwright commands generated by
      `fjs/ci/playwright/module.f.ts`.
- [ ] Compare results with existing setup-action jobs before removing them.
- [ ] Keep native Windows jobs on existing generated installation steps.

#### Phase 4: measurements

- [ ] Benchmark per-OS/architecture, per-job, per-major-version, and hybrid
      flake boundaries.
- [ ] Measure cold and warm builds, evaluation, cache reuse, duplicated
      downloads, CI concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI results are
      available.

### Out of scope

- artifact-hash discovery and maintenance;
- generated and committed `flake.lock` files;
- OCI image generation and GHCR publication until direct Nix CI is proven;
- a developer-oriented aggregate `flake.nix`.

### Related

- [65Z-ci-nix-locks](65z-ci-nix-locks.md) — stronger content verification and
  Nix input locking after the exact-version environments are proven.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — blocked OCI stage after
  direct Nix CI succeeds.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  implementation plan.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
