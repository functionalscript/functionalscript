## 65Z-ci-scenario-docker. Add OCI only after standalone Nix flakes work

**Priority:** P3
**Status:** blocked
**Blocked by:** [65Z-ci-nix](65z-ci-nix.md)

### Problem

OCI images may reduce repeated Linux CI setup work, but they should not be part of
the first Nix milestone. The project first needs to prove that committed,
standalone generated flakes based only on one pinned official stable Nixpkgs
snapshot can build the required Linux and macOS environments and run the existing
CI commands.

Adding OCI at the same time would combine two separate questions:

1. do the generated Nix environments work;
2. does packaging and distributing them as OCI improve CI.

An OCI layer must not hide missing packages, platform failures, version mismatches,
or mistakes in a generated flake.

### Proposal

Keep OCI as a later optional optimization. The required order is:

```text
1. Resolve the latest selected stable Nixpkgs commit
2. Synchronize package versions into CI config
3. Generate and commit standalone self-contained flakes
4. Build and validate every flake on its supported systems
5. Run Linux/macOS CI through the matching flakes
6. Measure build and cache behavior
7. Add Linux OCI outputs only when measurements justify them
8. Publish through a protected GHCR workflow
9. Optionally switch selected Linux jobs to OCI images
```

The direct Nix paths remain the reference behavior and fallback. Any later OCI
image must be built from the same pinned Nixpkgs commit and the same already
validated package selections used by the corresponding standalone flakes.

### Entry criteria

Do not begin OCI work until all of these are true:

- `fjs/ci/config/module.f.ts` contains the selected official stable Nixpkgs ref,
  exact GitHub commit, package-attribute mapping, and synchronized exact versions;
- standalone generated flakes are committed for the required CI environments;
- separate Node 22, 24, and 26 flakes each expose exactly one Node package;
- every generated `flake.nix` is self-contained and imports no generated Nix file;
- ordinary regeneration works without Nix on Linux, macOS, and native Windows;
- every flake builds on each system used by its corresponding CI job;
- metadata and executable version checks pass;
- Playwright and required compilation targets pass;
- existing Linux and macOS CI commands run directly through the matching flakes;
- cold/warm build and cache measurements exist;
- `npm run ci-update` regenerates all flakes without a staged diff.

Until these conditions are met, CI must not build, pull, publish, or depend on OCI
images.

### OCI source

The first OCI experiment should extend selected, already proven Linux flakes with
image outputs. Do not introduce a Dockerfile as an intermediate representation
unless a later concrete requirement needs one.

```text
pinned official Nixpkgs snapshot
               |
               v
     standalone generated flakes
          /              \
 direct CI shells    later OCI outputs
```

The image contents are selected from the same official Nixpkgs package attributes.
Do not add custom derivations merely for OCI. If a custom package source becomes
necessary, propose and validate it separately before using it in an image.

An OCI image may combine multiple proven environments only after measurement shows
that doing so is useful. Combining images must not change which Node version a CI
job executes.

### Architectures

Build and validate separate image outputs for:

- `linux/amd64`, derived from validated `x86_64-linux` environments;
- `linux/arm64`, derived from validated `aarch64-linux` environments.

Publish a multi-platform identity only after both variants pass the same version,
Playwright, and representative execution checks as direct Nix CI.

Additional targets such as `i686-unknown-linux-gnu` remain contents of the host
image; they are not separate host architectures.

### Image identity

The immutable image identity must depend on all inputs affecting its contents,
including:

- the exact Nixpkgs Git commit;
- configured Nix package attributes;
- synchronized top-level tool versions;
- the selected generated flake or explicit set of proven flakes;
- host architecture;
- Rust and WASM targets;
- Playwright package and browser selection;
- any later custom package-source commit, if one is eventually introduced.

CI must consume immutable tags or digests and must never substitute a mutable tag
such as `latest`.

### Measure before selecting image boundaries

Start by measuring complete CI-tools images per Linux architecture and smaller
images matching individual generated flakes. Compare:

- Nix build time;
- OCI assembly time;
- image size;
- upload and pull time;
- cold and warm CI startup;
- cache reuse;
- duplicated layers and downloads;
- failure and debugging isolation.

Only add per-job, per-tool-family, combined, or hybrid image boundaries when
measurements show that they improve total CI behavior.

### Protected GHCR publication

OCI publication is a separate final-stage workflow. The normal CI workflow handles
untrusted `pull_request` and `merge_group` events and remains read-only. Fork code
must never receive package-write credentials.

The initial publication workflow must:

- run only on `push` to the protected default branch after merge;
- omit `workflow_dispatch` initially;
- keep workflow-level permissions at `contents: read`;
- build and validate architecture outputs in jobs without `packages: write`;
- transfer validated immutable outputs to one final publication job;
- grant `packages: write` only to that publication job;
- publish architecture-specific identities first;
- create the multi-platform manifest only after all required variants succeed.

The GHCR packages should be public so CI, fork jobs, and external users can pull
them anonymously. An authentication, permission, registry, or network failure is
not an image miss. Only a confirmed missing immutable manifest or tag may trigger
a direct-Nix fallback.

### Optional CI consumption

Publishing images does not require switching every Linux job to OCI. For a job
selected after measurement:

1. compute the exact immutable image identity;
2. pull that public identity anonymously;
3. treat only a confirmed missing identity as a miss;
4. on a miss, use the already proven matching standalone flake or build its OCI
   output locally;
5. never push from `pull_request` or `merge_group` jobs.

Direct Nix remains the reference behavior throughout the experiment.

### Tasks

#### Prerequisite

- [ ] Complete [65Z-ci-nix](65z-ci-nix.md).
- [ ] Generate and commit standalone flakes from the pinned official Nixpkgs
      snapshot.
- [ ] Validate every environment/system pair used by CI.
- [ ] Preserve separate Node 22, 24, and 26 environments.
- [ ] Run existing Linux and macOS CI commands directly through matching flakes.
- [ ] Record direct-Nix build and cache measurements.
- [ ] Change this TODO from `blocked` to `open` only after the prerequisite is
      complete.

#### OCI generation

- [ ] Add Linux OCI outputs to selected already validated flakes.
- [ ] Build and validate `linux/amd64` and `linux/arm64` variants.
- [ ] Reuse the direct-Nix version, Playwright, and execution checks.
- [ ] Benchmark per-environment and combined image boundaries before selecting one.

#### Protected publication

- [ ] Generate a push-to-protected-default-branch publication workflow.
- [ ] Keep workflow-level permissions at `contents: read`.
- [ ] Keep architecture build and validation jobs free of `packages: write`.
- [ ] Grant `packages: write` only to the final publication job.
- [ ] Do not add initial manual publication.
- [ ] Publish immutable architecture identities and the multi-platform manifest
      only after validation succeeds.
- [ ] Configure public visibility and verify anonymous pulls.

#### Optional consumption

- [ ] Compare OCI-backed CI with direct Nix CI.
- [ ] Select only jobs for which OCI improves total behavior.
- [ ] Implement fallback only for a confirmed missing immutable identity.
- [ ] Fail on authentication, permission, registry, and network errors.
- [ ] Remove or deprecate `docker/Dockerfile` only after the Nix-built OCI path
      covers its intended use cases.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — prerequisite official-Nixpkgs flake work.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  implementation sequence.
- [playwright-package-version-sync](playwright-package-version-sync.md) — keep the
  repository Playwright dependency synchronized with the selected CI release.
- [i096](96.md) — CI caching.
- i095 — original Docker CI idea.
- i145 — Docker containers for Linux CI jobs.
- i183 — scenario test infrastructure.
