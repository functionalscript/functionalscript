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
to GHCR from a protected workflow and use them for Ubuntu CI jobs instead of
rerunning tool installation steps.

Nix builds the OCI images directly. Do not generate a Dockerfile as an
intermediate representation unless a later requirement specifically needs one.

```text
CI scripts and config
        |
        v
npm run ci-update
        |
        +-- generated Linux Nix flakes
        |       +-- CI environment
        |       +-- OCI image
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

Measure cold and warm Nix builds, OCI assembly, image upload and download,
cache reuse, CI concurrency, image size, and debugging isolation.

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

They may be published under separate immutable tags and combined into a
multi-platform OCI manifest after both architecture-specific images have been
built and validated.

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
benchmarked for short-lived intra-workflow reuse, but they must not become a
second source of tool-version truth.

### Protected GHCR publication

The normal generated CI workflow runs for untrusted `pull_request` and
`merge_group` events and must remain read-only. Fork pull requests must never
receive package-write credentials. Therefore image publication must not happen
from those jobs.

Generate a separate protected publication workflow with these properties:

- trigger on `push` to the protected default branch after changes are merged;
- optionally support `workflow_dispatch` for an authorized manual rebuild;
- grant `contents: read` and `packages: write` only to the publication job;
- authenticate to GHCR with the workflow token;
- build and validate both architecture-specific image outputs from the committed
  generated flakes;
- push immutable architecture-specific identities;
- create or update the multi-platform manifest only after both variants succeed.

Conceptually:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write
```

The publication workflow is trusted because it runs from committed code on the
protected branch, not from a fork's workflow definition.

### Public visibility and consumer authentication

The FunctionalScript CI images are intended for both CI and external users, so
the GHCR container packages must be public. Public GHCR container packages can
be pulled anonymously; pull-request jobs, fork jobs, and users therefore do not
need package credentials merely to consume a published image.

The first publication is not complete until the package visibility is set to
public and an unauthenticated pull of each immutable architecture identity and
the multi-platform identity succeeds. If GitHub requires an administrator to
set visibility after the first push, document that one-time step and verify it
in the publication workflow or a publication check.

If the policy later changes to private packages, the generated consumer jobs
must instead:

- request `packages: read`;
- authenticate to GHCR before pulling;
- ensure the workflow repository has read access to the package;
- distinguish authorization failures from an absent immutable image.

An authentication, permission, registry, or network failure is not a cache
miss and must fail the pull step. Only a confirmed “manifest/tag not found” for
the exact immutable identity may trigger the local Nix-build fallback.

### Consumer ordering and fallback

A pull request that changes tool versions or generated Nix files cannot assume
that its new GHCR image already exists. CI consumers therefore need an explicit
ordering and fallback strategy:

1. compute the immutable image identity from the generated inputs;
2. attempt an anonymous pull of that exact public image when it already exists;
3. treat only a confirmed missing manifest/tag as an image miss;
4. on a miss, build the environment or OCI image locally from the generated
   flake and optionally reuse GitHub cache or workflow artifacts;
5. never push from `pull_request` or `merge_group` jobs;
6. after merge, let the protected publication workflow publish the validated
   public image for later runs and users.

CI must not fall back to a mutable `latest` image with different tool versions.
A missing immutable image means “build this exact generated environment,” not
“use some older image.”

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
- [ ] Build and validate both `linux/amd64` and `linux/arm64` image variants.
- [ ] Generate a protected `push`/`workflow_dispatch` publication workflow with
      `contents: read` and `packages: write`.
- [ ] Keep `pull_request` and `merge_group` workflows read-only and prevent fork
      code from receiving GHCR write credentials.
- [ ] Publish immutable architecture-specific identities and create the
      multi-platform manifest only after both builds succeed.
- [ ] Configure the GHCR container packages as public and verify anonymous pulls
      of every published immutable identity.
- [ ] Implement pull-by-immutable-identity with a local Nix build fallback only
      for a confirmed missing manifest/tag; fail on authentication, permission,
      registry, or network errors.
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
