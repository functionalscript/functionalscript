## 65Z-ci-scenario-docker. Build and use Nix-based OCI images for Linux CI

**Priority:** P3
**Status:** blocked
**Phase:** 4
**Blocked by:** [Phase 3 — direct Nix CI](65z-ci-nix-ci.md)
**Does not depend on:** committed `flake.lock`, fixed artifact hashes, or the Phase 7 validation suite

### Goal

Build Linux OCI images from the same generated Nix environment definitions used
by direct Linux CI, then use the images for Linux jobs when they improve total
CI performance.

Do not maintain a separate hand-written Dockerfile installation path. The
committed generated `flake.nix` files and the CI configuration remain the source
of the image contents.

### Dependency

```text
Phase 2: generate flake.nix
        |
        v
Phase 3: run Linux CI through Nix
        |
        v
Phase 4: build and use Linux OCI images [this task]
```

Phase 4 does not wait for:

- [Phase 6](65z-ci-nix-locks.md), which commits Nix input locks;
- [Phase 7](65z-ci-nix-hardening.md), which adds comprehensive validation and
  fixed artifact hashes.

Those later phases can improve the same images after OCI adoption.

### Image source

The image must be built from the generated Linux environment rather than from a
second installer implementation:

```text
generated Linux flake
        |
        +-- direct Linux CI environment
        +-- Linux OCI image output
```

The exact Node, Deno, Bun, Rust, Wasmtime, Wasmer, Playwright, browser, and other
versions come from `fjs/ci/config/module.f.ts` and the generated upstream
installation logic.

`nixpkgs` may provide image builders, system libraries, and build tools. It must
not select the tested CI tool versions.

### Architectures

Build the Linux architectures used by CI:

- `linux/amd64` from an `x86_64-linux` generated environment;
- `linux/arm64` from an `aarch64-linux` generated environment.

Additional compilation targets, such as `i686-unknown-linux-gnu` and WASM
targets, are contents of a host image rather than separate image architectures.

### Initial implementation

The first OCI iteration should optimize for getting a working image into Linux
CI. It may package an environment that still uses version-addressed upstream
downloads and does not yet have fixed artifact hashes.

The existing Linux CI commands are the practical test of the image. A separate
comprehensive image-validation suite belongs to Phase 7 and may be added later.

### Publication safety

Image publication must not expose write credentials to untrusted pull-request
code.

The initial publication workflow should:

- run on `push` to the protected default branch;
- keep workflow-level permissions at `contents: read`;
- grant `packages: write` only to the publication job;
- publish public images so CI and forks can pull anonymously;
- use architecture-specific identities and a multi-platform manifest;
- never push from `pull_request` or `merge_group` jobs.

### CI consumption

For selected Linux jobs:

1. derive the expected image identity from committed generated inputs;
2. pull the public image;
3. run the existing CI command inside it;
4. compare total pull and startup time with direct Nix environment preparation.

Only jobs that become faster or simpler should remain on OCI. Direct Nix may
remain useful for debugging or as a fallback during rollout.

### Measurements

Measure:

- image build time;
- image size;
- upload and pull time;
- container startup time;
- reuse across Linux jobs;
- duplicated layers and downloads;
- direct Nix versus OCI total job duration.

Do not require Phase 7 validation to collect these performance measurements.

### Tasks

#### OCI generation

- [ ] Expose OCI outputs from selected generated Linux environments.
- [ ] Build `linux/amd64` and `linux/arm64` images.
- [ ] Keep image tool versions sourced from maintained CI configuration.
- [ ] Avoid a second hand-written tool installation implementation.
- [ ] Measure candidate per-architecture, per-job, and hybrid image boundaries.

#### Protected publication

- [ ] Generate a protected-default-branch publication workflow.
- [ ] Keep untrusted workflows read-only.
- [ ] Grant `packages: write` only to the publication job.
- [ ] Publish public architecture-specific images and a multi-platform manifest.
- [ ] Verify anonymous pulls.

#### Linux CI consumption

- [ ] Select initial Linux jobs for OCI use.
- [ ] Run their existing commands inside the image.
- [ ] Compare OCI performance with direct Nix CI.
- [ ] Keep OCI only where it improves total CI behavior.
- [ ] Remove or deprecate `docker/Dockerfile` only after the generated Nix image
      path covers its intended use cases.

### Completion criteria

- Linux images are generated from committed Nix environment definitions.
- AMD64 and ARM64 images are published safely.
- Selected Linux CI jobs use the images.
- Measurements document whether OCI improves total CI performance.

### Related

- [Phase 2 — generate Nix environments](65z-ci-nix.md).
- [Phase 3 — direct Nix CI](65z-ci-nix-ci.md).
- [Phase 5 — macOS Nix caching](65z-ci-nix-cache-macos.md).
- [Phase 7 — validation and fixed hashes](65z-ci-nix-hardening.md).
- [66B rollout overview](66b-dockerfile-nix-integration.md).
- i095 — original Docker CI idea.
- i145 — Docker containers for Linux CI jobs.
