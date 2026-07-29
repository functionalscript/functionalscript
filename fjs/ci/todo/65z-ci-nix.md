## 65Z-ci-nix. Generate Nix environments for Linux and macOS CI

**Priority:** P4
**Status:** open

### Summary

Generate Nix files from the existing CI source of truth in `fjs/ci/` and prove
that they can reproduce the required tool environments on native Linux and
macOS GitHub runners.

The first goal is not OCI. The first goal is to generate correct Nix files,
build them, validate every installed tool, and run the existing CI commands
through them directly. Linux OCI images and GHCR publication are a later stage
that must reuse an already proven Nix environment.

Windows remains on the existing generated GitHub Actions installation steps so
that it continues to test native Windows behavior.

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

Nix must not select tool versions from whatever happens to be available in the
current `nixpkgs` revision. `npm run ci-update` already controls when tool
versions change; it should also generate the exact upstream versions, URLs,
platform-specific artifacts, archive formats, and hashes used by Nix.

The generated `.nix` files are committed build artifacts. They are not intended
to be maintained manually or optimized for developer use.

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
and CI concurrency behavior. A hybrid layout is also valid.

A developer-oriented root flake may later compose the generated environments,
but that is explicitly out of scope for this task.

### Fully resolved target files

Each generated flake should describe one known target or CI environment with no
unnecessary cross-platform dispatch logic. It should include:

- the exact host OS and architecture;
- the exact set of tools required by the environment;
- the exact tool versions;
- platform-specific upstream URLs and archive formats;
- hashes for every downloaded artifact;
- installation and wrapping steps;
- runtime libraries and environment variables;
- validation commands that compare installed versions with the CI config.

Generated duplication is acceptable. Reusable abstractions belong in the
TypeScript/FunctionalScript generator; generated Nix should favor explicit,
resolved build plans that are easy to reproduce and debug independently.

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

For each supported host, the generated derivation should fetch the exact
upstream artifact using its expected hash. `nixpkgs` may provide helpers,
unpacking and patching tools, runtime libraries, and later OCI builders, but it
must not silently choose different Node, Deno, Bun, Rust, Wasmtime, Wasmer, or
Playwright versions.

### Playwright

Treat Playwright as a coordinated, precisely versioned environment rather than
as a single executable. Keep these parts synchronized:

- the Playwright package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser artifacts and hashes;
- required native runtime libraries;
- `PLAYWRIGHT_BROWSERS_PATH` and related environment variables.

CI should validate that the package and browser bundle belong to the expected
Playwright version and must not download an unpinned replacement during tests.

### Nix bootstrap on GitHub-hosted runners

The generated flakes cannot run until Nix itself is installed. Stock Linux and
macOS GitHub-hosted runners must therefore receive an explicit bootstrap before
any `nix build`, `nix flake check`, or `nix develop` command.

For every generated Linux or macOS job, the generated workflow should perform
this sequence:

1. check out the repository;
2. install Nix using a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache action or cache strategy;
4. invoke the target-specific generated flake.

Conceptually:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - uses: <nix-installer-action>@<pinned-version>
  - uses: <nix-cache-action>@<pinned-version>
  - run: >
      nix develop ./nix/generated/playwright-linux-x86_64
      --command npm run test-playwright
```

The installer and cache actions are part of generated workflow configuration.
The bootstrap must be emitted before the first Nix command and must work on
both Linux and macOS. Windows jobs do not use this bootstrap.

### Staged rollout

#### Phase 1: generate and prove the Nix files

Before changing existing CI jobs, prove that each generated flake is correct:

1. evaluate the flake;
2. build its declared environment;
3. run its exact installed-version checks;
4. run representative commands for every packaged tool;
5. verify Playwright package/browser compatibility;
6. verify `npm run ci-update` regenerates the same files without a diff.

A failure must identify the exact generated flake so that it can be reproduced
and debugged independently.

#### Phase 2: run CI directly through Nix

After Phase 1 succeeds, convert Linux and macOS jobs to execute their existing CI
commands through the generated flakes using `nix develop --command` or an
equivalent direct Nix invocation.

This phase intentionally does not create or consume OCI images. It proves that
the generated Nix environments are complete enough to run real CI on every
supported native host and architecture.

Compare the Nix-backed jobs with the existing setup-action jobs until equivalent
test coverage and results are established.

#### Phase 3: measure and choose environment boundaries

Measure:

- cold and warm build times;
- evaluation time;
- cache reuse;
- duplicated downloads;
- CI concurrency behavior;
- failure and debugging isolation.

Use those measurements to decide whether generated flakes should be per
OS/architecture, per job, per major tool version, or a hybrid.

#### Later: OCI images

Only after the generated Nix files work reliably in direct Linux CI should Linux
flakes be extended with OCI outputs. OCI construction, GHCR publication, and CI
image consumption are covered by
[65Z-ci-scenario-docker](65z-ci-scenario-docker.md) and are not prerequisites for
this task.

### Lock files

Each independent flake may have its own generated `flake.lock`. The lock file
pins `nixpkgs` and other flake inputs; exact upstream tools are pinned in the
generated derivations by version, URL, and hash.

The generator should normally keep all flakes on the same intended `nixpkgs`
revision, while allowing an exceptional environment to use another revision
when required.

### Tasks

#### Phase 1: generation and validation

- [ ] Extend `npm run ci-update` to generate target-specific Nix files with exact
      versions, upstream URLs, archive formats, and hashes.
- [ ] Generate independent flakes for native Linux and macOS CI; do not add a
      root-level generic flake.
- [ ] Generate and refresh a `flake.lock` for each independent flake.
- [ ] Delete stale generated Nix files when a tool, major version, system,
      architecture, target, or job is added or removed.
- [ ] Add exact installed-version checks for every generated environment.
- [ ] Model host systems separately from Rust/WASM/32-bit compilation targets.
- [ ] Implement Playwright as a coordinated package, driver, browser, and native
      dependency bundle.
- [ ] Prove that every generated flake evaluates, builds, and passes its checks.
- [ ] Add a regeneration check proving that `npm run ci-update` leaves no diff.

#### Phase 2: direct Nix CI

- [ ] Generate the Linux/macOS workflow bootstrap: checkout, pinned Nix installer,
      selected Nix cache configuration, then the first Nix command.
- [ ] Verify the bootstrap on every supported Linux and macOS runner and
      architecture.
- [ ] Run existing Linux and macOS CI commands directly through the generated
      flakes without OCI images.
- [ ] Compare results with the existing setup-action jobs before removing them.
- [ ] Keep native Windows jobs on the existing generated installation steps.

#### Phase 3: measurements

- [ ] Benchmark per-OS/architecture, per-job, per-major-version, and useful hybrid
      flake boundaries.
- [ ] Measure cold and warm build times, evaluation time, cache reuse, duplicated
      downloads, and CI concurrency behavior.
- [ ] Select the generated flake boundary only after the direct Nix CI results are
      available.

### Out of scope

- OCI image generation and GHCR publication until direct Nix CI is proven;
- a developer-oriented aggregate `flake.nix`.

### Related

- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI stage after
  direct Nix CI succeeds.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  implementation plan.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
