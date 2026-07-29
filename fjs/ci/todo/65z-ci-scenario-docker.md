## 65Z-ci-scenario-docker. Add Nix-built OCI images after direct Nix CI is proven

**Priority:** P3
**Status:** blocked
**Blocked by:** [65Z-ci-nix](65z-ci-nix.md)

### Problem

Ubuntu CI currently installs Node, Bun, Deno, Rust, Wasmtime, Wasmer,
Playwright, and their dependencies repeatedly. The existing hand-written
`docker/Dockerfile` is not generated from the same exact versions, upstream
artifacts, URLs, and hashes as the GitHub Actions workflow.

OCI images may eventually reduce repeated setup work and provide a reusable
Linux CI environment, but creating them before the generated Nix environments
are proven would combine two independent problems:

1. whether the CI generator produces a complete and correct Nix environment;
2. whether packaging and distributing that environment as OCI improves CI.

An OCI layer must not hide defects in the generated Nix environment. This TODO
is therefore blocked until [65Z-ci-nix](65z-ci-nix.md) proves that Linux and
macOS CI can run directly through the generated flakes.

### Proposal

Make OCI images the final stage of the Nix CI migration. After the direct-Nix
prerequisite succeeds, extend selected, already validated Linux flakes with OCI
outputs built from the same derivations. Publish those images through a
protected GHCR workflow, then optionally migrate only the Linux jobs for which
OCI measurably improves total CI behavior.

The required order is:

```text
1. Generate exact Nix flakes
2. Build and validate the flakes
3. Run Linux/macOS CI directly through Nix
4. Measure flake boundaries and cache behavior
5. Add Linux OCI outputs
6. Publish images to GHCR
7. Optionally switch selected Linux jobs to OCI images
```

Direct Nix CI remains the reference behavior and fallback during the OCI
experiment. Nix builds the image directly; do not generate a Dockerfile as an
intermediate representation unless a later requirement specifically needs one.

That constraint describes the **Nix-built** images this TODO plans. It is not a
verdict on the generated `docker/Dockerfile` and the `docker-intel` /
`docker-arm` jobs that exist today: those are a separate, deliberately retained
experiment, kept until Nix shows it can do the same at comparable or better
cost. [65Z-ci-nix](65z-ci-nix.md) records the times they set as the baseline
for that comparison, and they retire when Nix beats it.

```text
proven generated Linux flake
        |
        +-- direct CI environment
        +-- OCI image output
```

The exact versions, upstream artifacts, URLs, hashes, installation logic,
compilation targets, and Playwright browser revisions remain controlled by the
same `fjs/ci/` source configuration.

### Entry criteria

Do not start OCI integration until all of these are true:

- generated Linux flakes evaluate and build on Intel and ARM runners;
- generated macOS flakes evaluate and build on Intel and ARM runners;
- exact installed-version checks pass;
- Playwright package and browser validation passes;
- existing Linux and macOS CI commands run directly through Nix;
- the generated flake layout has enough performance data to choose useful image
  boundaries;
- `npm run ci-update` regenerates the committed Nix files without a diff.

Until those conditions are met, Linux CI should use the generated Nix flakes
directly and should not build, pull, or publish OCI images.

### Image boundary is a measured decision

Candidate image boundaries include:

1. one image per Linux architecture containing all CI tools;
2. one image per CI job and architecture;
3. one image per major tool-version family and architecture;
4. a hybrid split, such as common Node tools, WASM tools, and Playwright.

The direct Nix CI measurements should inform this decision. After OCI outputs
exist, additionally measure:

- OCI assembly time;
- image size;
- upload and pull time;
- duplicated layers and downloads;
- cross-job reuse;
- failure and debugging isolation.

### Image contents

An image contains exactly the tools required by its selected boundary. A
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

The Playwright image must reuse the already validated direct-Nix environment and
keep these parts synchronized:

- package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser archives and hashes;
- native runtime libraries;
- browser-path environment variables.

Whether Playwright shares an image with other jobs remains a performance
decision.

### Architectures

Build Linux images for the architectures used by GitHub CI:

- `linux/amd64` from an `x86_64-linux` flake;
- `linux/arm64` from an `aarch64-linux` flake.

They may be published under separate immutable identities and combined into a
multi-platform manifest only after both architecture-specific outputs build and
pass the same validation used by direct Nix CI.

Additional compilation targets such as `i686-unknown-linux-gnu` are contents of
the host image; they are not separate host architectures unless CI runs a true
32-bit host job.

### Image identity

The image identity must depend on every generated input that affects its
contents, including:

- tool versions and major-version selections;
- upstream artifact hashes;
- host architecture;
- Rust and WASM targets;
- Playwright package and browser revisions;
- generated Nix files;
- the locked `nixpkgs` revision.

CI must consume immutable tags or digests and must never silently substitute an
unrelated mutable image such as `latest`.

### Protected GHCR publication

OCI publication is a separate final-stage workflow. The normal generated CI
workflow handles untrusted `pull_request` and `merge_group` events and must
remain read-only. Fork code must never receive GHCR write credentials.

The initial publication workflow must:

- run only on `push` to the protected default branch after merge;
- not expose `workflow_dispatch` in the initial implementation;
- keep workflow-level permissions at `contents: read`;
- build and validate architecture-specific OCI outputs in jobs without
  `packages: write`;
- transfer the validated image archives or equivalent immutable outputs to a
  final publication job;
- grant `packages: write` only to that final publication job;
- push immutable architecture-specific identities from the publication job;
- create the multi-platform manifest only after both variants succeed.

Conceptually:

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  build-amd64:
    # Build, validate, and upload the OCI archive as a workflow artifact.

  build-arm64:
    # Build, validate, and upload the OCI archive as a workflow artifact.

  publish:
    needs: [build-amd64, build-arm64]
    permissions:
      contents: read
      packages: write
    # Download the validated archives, push both identities, then publish the
    # multi-platform manifest.
```

The architecture build and validation jobs must not inherit package-write
permission. If the final design combines build and push in one job instead,
that single job is the publication job and is the only job allowed to receive
`packages: write`.

A manual rebuild may be designed later, but only with an enforced protected
branch ref and, when appropriate, a protected environment approval. It is not
part of the initial publication path.

### Public visibility and consumers

The FunctionalScript CI images are intended for CI and external users, so the
GHCR container packages must be public. The first publication is not complete
until unauthenticated pulls of the immutable architecture identities and the
multi-platform identity succeed.

If the policy later changes to private packages, generated consumers must use
`packages: read`, authenticate to GHCR, and distinguish authorization errors
from a missing image.

An authentication, permission, registry, or network failure is not an image
miss. Only a confirmed missing manifest or tag for the exact immutable identity
may trigger a fallback.

### CI consumption is also a later step

Publishing an image does not automatically require every Linux job to consume
it. Compare direct Nix CI with OCI-based CI first.

For a job selected to use OCI:

1. compute the immutable image identity from the generated inputs;
2. attempt an anonymous pull of that exact public image;
3. treat only a confirmed missing manifest or tag as an image miss;
4. on a miss, run the job directly through the already proven generated Nix
   flake or build its OCI output locally;
5. never push from `pull_request` or `merge_group` jobs.

The direct Nix path remains the reference behavior and fallback during the OCI
experiment.

### Tasks

#### Prerequisite

- [ ] Complete the generation, validation, and direct Nix CI phases in
      [65Z-ci-nix](65z-ci-nix.md).
- [ ] Record the direct Nix build, cache, and job-boundary measurements.
- [ ] Change this TODO from `blocked` to `open` only after the prerequisite is
      complete.

#### OCI generation

- [ ] Expose OCI outputs from selected, already proven Linux flakes.
- [ ] Build and validate both `linux/amd64` and `linux/arm64` variants.
- [ ] Verify that OCI contents pass the same version and Playwright checks as the
      direct Nix environment.
- [ ] Benchmark one image per architecture, per job, per major version, and useful
      hybrid boundaries.

#### Protected publication

- [ ] Generate a push-to-protected-default-branch publication workflow with
      workflow-level `contents: read` only.
- [ ] Keep architecture build and validation jobs free of `packages: write`.
- [ ] Grant `contents: read` and `packages: write` only to the final job that
      pushes the validated architecture images and manifest.
- [ ] Do not add `workflow_dispatch` to the initial publication workflow.
- [ ] Keep `pull_request` and `merge_group` workflows read-only.
- [ ] Publish immutable architecture-specific identities and create the
      multi-platform manifest only after both variants succeed.
- [ ] Configure the GHCR packages as public and verify anonymous pulls.

#### Optional CI consumption

- [ ] Compare direct Nix CI with OCI pull/startup performance.
- [ ] Select only the Linux jobs for which OCI improves total CI behavior.
- [ ] Implement immutable-image pull with direct-Nix fallback only for a
      confirmed missing manifest or tag.
- [ ] Fail on authentication, permission, registry, and network errors.
- [ ] Remove or deprecate `docker/Dockerfile` only after the Nix-built OCI path
      covers its intended use cases.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — prerequisite generated and direct Nix CI work.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  implementation plan.
- i095 — original Docker CI idea.
- i145 — Docker containers for Linux CI jobs.
- i183 — scenario test infrastructure.
- i65Y-scenarios-proof — scenario files converted to `export const proof`;
  prerequisite.
