## 65Z-ci-scenario-docker. Replace Ubuntu setup steps with Nix-built OCI images

**Priority:** P3
**Status:** open

### Problem

Ubuntu CI jobs currently install every tool (Node, Bun, Deno, Rust, Wasmtime,
Wasmer, etc.) from scratch on every run. This is slow and duplicates work
already performed by earlier runs. Additionally:

- Playwright is kept in a separate Ubuntu job because its installation is
  expensive, fragmenting the matrix.
- Scenario tests (`./fjs/emergent_testing/scenarios/run.sh`) are not run in CI
  because no single job currently has all required runners.
- The current hand-written `docker/Dockerfile` is not generated from the same
  exact version and artifact information as the GitHub Actions workflow.

### Proposal

Generate independent Nix flakes from the existing CI source of truth and let
the Linux flakes expose OCI image outputs. Publish the resulting Linux images
to GHCR and use them for Ubuntu CI jobs instead of rerunning tool installation
steps.

Nix builds the OCI images directly. Do not generate a Dockerfile as an
intermediate representation unless a later requirement specifically needs one.

```text
CI scripts and config
        |
        v
npm run ci-update
        |
        +-- generated Linux Nix flakes
        |       |
        |       +-- CI environment
        |       +-- OCI image
        |
        +-- generated macOS Nix flakes
        +-- generated Windows setup steps
```

The exact tool versions, platform artifacts, URLs, hashes, installation logic,
and Playwright browser revisions must come from the same CI configuration used
to generate the Windows and macOS jobs.

### Image boundary is an experiment

Do not require one global image before measuring build behavior. Candidate
boundaries include:

1. one image per Linux architecture containing all CI tools;
2. one image per CI job and architecture;
3. a hybrid split, such as common Node tools, WASM tools, and Playwright.

The generator may emit different independent flakes while this is evaluated.
There is no root-level generic `flake.nix`; each GitHub job references the
specific generated flake or image it needs.

Measure:

- cold and warm Nix build time;
- OCI image assembly time;
- image upload and download time;
- Nix and GitHub cache reuse;
- CI concurrency and duplicated downloads;
- image size;
- failure and debugging isolation.

### What changes

| | Today | Proposed |
|---|---|---|
| Ubuntu Intel + ARM | installs tools inline each run | uses generated Nix environment or Nix-built OCI image |
| Playwright | separate expensive setup | precise generated Playwright environment/image |
| Scenario tests | no job has every runner | run in an environment containing all required runners |
| macOS Intel + ARM | generated setup steps | generated native Nix flakes |
| Windows | generated setup steps | unchanged native Windows setup steps |

### Image contents

An image contains exactly the tools required by its chosen CI boundary. The
complete Linux environment may include:

| Tool | Version source |
|------|----------------|
| Node major versions | `config.node` |
| Deno | `config.deno` |
| Bun | `config.bun` |
| Playwright package and browsers | `config.playwright` |
| Rust toolchain and targets | CI config, including `dtolnay/rust-toolchain` inputs |
| Wasmtime | `config.wasmtime` |
| Wasmer | `config.wasmer` |

The generated derivations must pin exact upstream artifacts and hashes for each
Linux architecture. Nix must not substitute whatever tool version happens to
be packaged in the selected `nixpkgs` revision.

### Playwright

The Playwright OCI environment must keep the package, driver, browser revisions,
platform-specific browser archives, hashes, native libraries, and environment
variables synchronized. It should not download browsers implicitly during a
test job.

Whether Playwright shares an image with the other Ubuntu jobs or remains a
separate image is a performance decision, not a requirement of this proposal.

### Architectures

Generate Linux images for the architectures used by GitHub CI:

- `linux/amd64` from an `x86_64-linux` flake;
- `linux/arm64` from an `aarch64-linux` flake.

They may be published under separate tags or combined into a multi-platform OCI
manifest after both architecture-specific images have been built.

Additional compilation targets such as `i686-unknown-linux-gnu` are contents of
the host image; they are not separate host architectures unless CI runs a true
32-bit host job.

### Image identity and reuse

The image identity should depend on all generated inputs that affect its
contents, including:

- tool versions and major-version selections;
- upstream artifact hashes;
- host architecture;
- Rust and WASM targets;
- Playwright package and browser revisions;
- generated Nix files;
- the locked `nixpkgs` revision.

Prefer immutable tags or digests for CI consumption. A human-readable version
tag may also be published for inspection.

GHCR is the intended durable distribution point so users and CI can pull the
same image. GitHub Actions cache or workflow artifacts may additionally be
benchmarked for short-lived intra-workflow reuse, but they should not become a
second source of tool-version truth.

### What runs inside the Linux environment

Run all tests that currently run on Ubuntu, plus environments that become
possible after the toolchain is assembled reproducibly:

- Playwright tests;
- scenario tests across `fjs`, Node, Bun, Deno, and Playwright;
- exact installed-version validation before the main tests.

The final job split depends on the image-boundary measurements.

### Tasks

- [ ] Generate Linux Nix flakes from `fjs/ci/` with exact per-architecture
      versions, URLs, archive formats, and hashes.
- [ ] Expose OCI image outputs from the generated Linux flakes.
- [ ] Build both `linux/amd64` and `linux/arm64` image variants.
- [ ] Publish generated images to GHCR using immutable identities.
- [ ] Validate every installed tool and Playwright browser bundle against the CI
      source configuration.
- [ ] Benchmark one image per architecture, one image per job, and useful hybrid
      boundaries before selecting the final layout.
- [ ] Benchmark GHCR pulls against GitHub Actions cache or artifacts for
      short-lived reuse.
- [ ] Update Ubuntu jobs to consume the selected generated Nix environment or
      OCI image instead of installing tools inline.
- [ ] Run scenario tests in an environment containing all required runners.
- [ ] Remove or deprecate the hand-written `docker/Dockerfile` once the generated
      OCI path covers its use cases.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generated independent Nix flakes for Linux and
  macOS CI.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  generator and OCI implementation plan.
- i095 — original Docker CI idea.
- i145 — Docker containers for Linux CI jobs.
- i183 — scenario test infrastructure.
- i65Y-scenarios-proof — scenario files converted to `export const proof`;
  prerequisite.
