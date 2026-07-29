## 66B-dockerfile-nix-integration. Generate CI Nix flakes and Linux OCI images from `fjs/ci/`

**Priority:** P3
**Status:** open

### Problem

The current CI generator maintains exact cross-platform tool versions, but
Linux and macOS jobs still install tools through generated GitHub Actions steps.
The hand-written `docker/Dockerfile` is disconnected from those version pins and
is not the source of the current CI environments.

The earlier proposal to generate a Dockerfile that installs Nix inside the
container adds an unnecessary intermediate format:

```text
CI config -> Dockerfile -> install Nix -> install tools
```

It also risks making `nixpkgs` package freshness the authority for tool
versions. FunctionalScript needs to adopt the same exact upstream release across
Windows, macOS, and Linux as soon as `npm run ci-update` selects it.

### Proposal

Generate independent target-specific Nix flakes directly from `fjs/ci/`. Use
them natively on Linux and macOS, and let Linux flakes optionally produce OCI
images for GHCR and container-based CI.

```text
fjs/ci scripts and config
          |
          v
    npm run ci-update
          |
          +-- generated GitHub workflow
          +-- generated Linux Nix flakes
          |       +-- CI packages/shells/checks
          |       +-- OCI image outputs
          +-- generated macOS Nix flakes
          +-- generated native Windows setup steps
```

Do not generate a root-level aggregate `flake.nix` in the initial scope. GitHub
jobs reference the specific generated flake directory that defines their
environment. A developer-oriented aggregate flake may be considered later and
must not constrain the CI design.

### 1. Keep `fjs/ci/` as the source of truth

The generator owns:

- which tools and major-version variants exist;
- which CI jobs need each tool;
- supported host OS and architecture combinations;
- additional compilation targets;
- exact versions;
- upstream URLs and archive formats;
- hashes;
- platform-specific installation details;
- Playwright package and browser coordination.

Adding or deleting a tool, version line, host, architecture, or CI job in the
source configuration must add or delete the corresponding generated Nix files.
The `.nix` files are committed generated artifacts and are never maintained
manually.

### 2. Generate independent resolved flakes

Possible boundaries include:

- one flake per OS and architecture;
- one flake per CI job, OS, and architecture;
- one flake per major tool version and target;
- a hybrid split selected by measurements.

Examples:

```text
nix/generated/linux-x86_64/flake.nix
nix/generated/linux-aarch64/flake.nix
nix/generated/darwin-x86_64/flake.nix
nix/generated/darwin-aarch64/flake.nix
```

or:

```text
nix/generated/node-24-linux-x86_64/flake.nix
nix/generated/wasm-linux-x86_64/flake.nix
nix/generated/playwright-linux-x86_64/flake.nix
nix/generated/node-24-darwin-aarch64/flake.nix
```

Do not choose the final boundary before benchmarking. Each target-specific flake
should be explicit, independently buildable, and independently debuggable.

### 3. Pin exact upstream artifacts

Do not install Node, Deno, Bun, Rust, Wasmtime, Wasmer, or Playwright by asking
`nixpkgs` for its currently packaged version.

Generate fixed-output fetches from the same release artifacts selected by the
cross-platform CI updater. Each generated target records its own exact version,
URL, archive format, expected hash, installation steps, runtime dependencies,
and wrappers.

`nixpkgs` may provide Nix helpers, patching hooks, system libraries, shell tools,
and OCI builders. Its revision is pinned by each generated `flake.lock`, but it
does not independently select project tool versions.

### 4. Model hosts and targets separately

Generated hosts include `x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, and
`aarch64-darwin`. A host may additionally install Rust/WASM/32-bit targets such
as `wasm32-wasip1`, `wasm32-wasip2`, or `i686-unknown-linux-gnu`.

A 32-bit compilation target does not automatically imply a separate 32-bit host
flake.

### 5. Generate Playwright as a precise bundle

The Playwright environment must coordinate:

- the npm package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser downloads and hashes;
- Linux or macOS native dependencies;
- browser-path environment variables;
- validation that the package and browsers belong together.

The test job must not silently download a different browser bundle at runtime.
A Playwright-specific flake or image may remain separate when that improves
build time, cache reuse, image size, or failure isolation.

### 6. Bootstrap Nix before using generated flakes

GitHub-hosted Linux and macOS runners do not provide the generated Nix
environment by themselves. Before any `nix build` or `nix develop` invocation,
the generated workflow must:

1. check out the repository;
2. install Nix through a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache action or cache strategy;
4. invoke the target-specific generated flake.

Conceptually:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - uses: <nix-installer-action>@<pinned-version>
  - uses: <nix-cache-action>@<pinned-version>
  - run: nix develop ./nix/generated/node-24-darwin-aarch64 --command npm test
```

The installer and cache actions are part of generated workflow configuration.
The generator must emit them before the first Nix command for every converted
Linux and macOS job. Windows keeps its existing native setup path.

### 7. Use Nix natively on macOS

Generated macOS flakes run directly on GitHub's Intel and ARM macOS runners.
They must preserve native macOS testing rather than placing macOS jobs inside a
Linux VM or container.

### 8. Produce Linux OCI images directly

A generated Linux flake may expose an OCI output built from the same derivations
used by its native Nix environment:

```sh
nix build ./nix/generated/linux-x86_64#oci-image
```

or:

```sh
nix build ./nix/generated/playwright-linux-x86_64#oci-image
```

Build `linux/amd64` and `linux/arm64` variants independently. The final image
boundary remains undecided until one complete image per architecture, per-job
images, and useful hybrid groupings are benchmarked.

### 9. Publish OCI images only from a protected workflow

The regular generated CI workflow handles `pull_request` and `merge_group`
events with read-only permissions. It must not publish packages, and fork code
must never receive GHCR write credentials.

Generate a separate publication workflow that:

- runs on `push` to the protected default branch after merge;
- optionally supports authorized `workflow_dispatch`;
- grants `contents: read` and `packages: write` only to the publication job;
- builds and validates both architecture-specific OCI outputs;
- pushes immutable architecture-specific identities;
- publishes the multi-platform manifest only after both variants succeed.

Pull-request and merge-queue jobs should compute the immutable image identity,
try to pull it, and build the exact generated flake locally on a miss. They may
use GitHub cache or workflow artifacts for temporary reuse, but they must never
push and must never substitute an unrelated mutable image such as `latest`.

After merge, the protected publication workflow makes the validated image
available for subsequent CI runs and external users.

### 10. Keep Windows unchanged

Windows continues to use the existing generated GitHub Actions installation
steps and native Windows upstream artifacts. Nix through WSL would test Linux,
not native Windows behavior.

The Windows installer and generated Nix flakes must consume the same source
versions so all operating systems test the intended release set.

### 11. Validation and debugging

Every generated environment should validate the exact installed versions.
Playwright validation should also cover the expected package and browser bundle.

A CI failure should identify the exact generated flake, for example:

```text
nix/generated/playwright-linux-x86_64/flake.nix
```

That flake must be independently buildable so it can serve as a minimal
reproduction without evaluating unrelated jobs or systems.

### 12. Generation consistency

`npm run ci-update` should:

1. resolve versions and upstream artifacts for every supported target;
2. compute or import expected hashes;
3. generate all target-specific `flake.nix` files;
4. generate or refresh their `flake.lock` files;
5. delete stale generated directories;
6. regenerate the GitHub workflow using the resulting flake paths;
7. emit Nix installer/cache bootstrap steps for Linux and macOS jobs;
8. emit the protected GHCR publication workflow;
9. fail if a required platform artifact is unavailable;
10. support a CI check that regeneration produces no diff.

### 13. Performance experiment

Before selecting the permanent file/image layout, measure Nix evaluation, cold
and warm derivation builds, cache hit rates, parallel CI behavior, duplicated
downloads, OCI assembly/upload/pull time, image size, and debugging isolation.

File layout is a generated implementation choice. Optimize it for CI
performance and clarity, not for manual Nix-code maintainability.

### Tasks

- [ ] Add target-specific Nix generation to `fjs/ci/module.f.ts` or a dedicated
      generator used by `npm run ci-update`.
- [ ] Generate exact per-host tool artifacts, URLs, formats, and hashes from the
      existing CI source configuration.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Generate and refresh a `flake.lock` for each independent flake.
- [ ] Delete stale generated Nix files when source tools, versions, targets, or
      jobs are removed.
- [ ] Generate pinned Nix installer and cache bootstrap steps before the first
      Nix command in every Linux and macOS job.
- [ ] Verify the bootstrap on every supported GitHub-hosted runner architecture.
- [ ] Add exact installed-version validation to each generated environment.
- [ ] Implement precise Playwright package/browser generation.
- [ ] Keep Windows on the existing native generated installation path.
- [ ] Expose Linux OCI outputs and build both AMD64 and ARM64 variants.
- [ ] Generate a protected `push`/`workflow_dispatch` GHCR publication workflow
      with `packages: write`; keep PR and merge-group workflows read-only.
- [ ] Implement immutable-image pull with local Nix-build fallback on a miss.
- [ ] Publish architecture-specific images and the multi-platform manifest only
      after validation succeeds.
- [ ] Benchmark per-system, per-job, per-major-version, and hybrid boundaries.
- [ ] Update Linux and macOS GitHub jobs to reference generated flake directories
      directly.
- [ ] Add a regeneration check to ensure `npm run ci-update` leaves the working
      tree unchanged.
- [ ] Remove or deprecate `docker/Dockerfile` after the Nix-built OCI images cover
      its intended use cases.
- [ ] Keep a developer-oriented aggregate `flake.nix` out of scope.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and platform split for generated
  CI flakes.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — Linux CI consumption and
  OCI image distribution.
- [GitHub issue #1034](https://github.com/functionalscript/functionalscript/issues/1034)
  — original Dockerfile/Nix proposal.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
- i096 — CI caching.
