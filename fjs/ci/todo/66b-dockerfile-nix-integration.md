## 66B-dockerfile-nix-integration. Generate and prove CI Nix flakes before adding OCI

**Priority:** P3
**Status:** open

### Problem

The current CI generator maintains exact cross-platform tool versions, but
Linux and macOS jobs still install tools through generated GitHub Actions steps.
The hand-written `docker/Dockerfile` is disconnected from those version pins and
is not the source of the current CI environments.

The earlier proposal combined too many steps at once:

```text
Nix generation + validation + CI conversion + OCI creation + GHCR publication
```

That makes it harder to determine whether a failure comes from the generated
Nix environment or from its OCI packaging and distribution.

### Proposal

Implement the migration in these six strictly ordered phases. Each phase number
has exactly the same meaning in the overview, detailed sections, and task lists:

```text
Phase 1: generate exact target-specific Nix flakes
Phase 2: build and validate every generated flake
Phase 3: run Linux/macOS CI directly through Nix
Phase 4: measure and select useful flake boundaries
Phase 5: add and validate Linux OCI outputs
Phase 6: publish OCI images and optionally consume them in CI
```

Each phase is a gate for the next phase. OCI is deliberately last. The first
milestone is proving that `npm run ci-update` can generate proper Nix files that
reproduce the current CI tool sets and run the existing CI commands without
creating an OCI image.

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
- Playwright package and browser coordination;
- the exact full `nixpkgs` commit used by every generated flake.

Adding or deleting a tool, version line, host, architecture, target, or CI job
in the source configuration must add or delete the corresponding generated Nix
files. The `.nix` files are committed generated artifacts and are never
maintained manually.

The maintained configuration must include one authoritative exact `nixpkgs`
revision, for example `config.nix.nixpkgsRevision`. The generator must not infer
this value from an existing generated lock or resolve a moving branch when a
flake or lock is created.

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

Do not choose the permanent boundary before benchmarking. Each target-specific
flake should be explicit, independently buildable, and independently
debuggable.

### 3. Pin exact upstream artifacts and `nixpkgs`

Do not install Node, Deno, Bun, Rust, Wasmtime, Wasmer, or Playwright by asking
`nixpkgs` for its currently packaged version.

Generate fixed-output fetches from the same release artifacts selected by the
cross-platform CI updater. Each generated target records its own:

- exact version;
- upstream URL;
- archive format;
- expected hash;
- installation and wrapping steps;
- runtime dependencies.

`nixpkgs` may provide helpers, patching hooks, system libraries, shell tools,
and later OCI builders. It does not independently select project tool versions.

Every generated flake must construct its `nixpkgs` input from the maintained
full commit, for example:

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/<configured-full-commit>";
```

`npm run ci-update` must generate or refresh every `flake.lock` from that exact
revision and verify that each lock's `locked.rev` equals the configured value.
The lock records resolved metadata such as `narHash`, but it is not the
maintained source of the revision. A target-specific revision exception must be
explicit in maintained configuration rather than appearing as lock-file drift.

### 4. Model hosts and targets separately

Generated hosts include:

- `x86_64-linux`;
- `aarch64-linux`;
- `x86_64-darwin`;
- `aarch64-darwin`.

A host may additionally install targets such as:

- `wasm32-wasip1`;
- `wasm32-wasip1-threads`;
- `wasm32-wasip2`;
- `wasm32-unknown-unknown`;
- `i686-unknown-linux-gnu`.

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
A Playwright-specific flake may remain separate when that improves build time,
cache reuse, or failure isolation.

The generated Nix-backed workflow should preserve the existing test commands
from `fjs/ci/playwright/module.f.ts` rather than inventing an absent package
script:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=firefox
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=webkit
```

### 6. Phase 1: generate exact Nix flakes

Phase 1 generates the committed target-specific files without converting the
existing CI jobs and without adding OCI outputs.

`npm run ci-update` should:

1. resolve versions and upstream artifacts for every supported target;
2. read the exact maintained `nixpkgs` revision;
3. compute or import expected hashes;
4. generate all required target-specific `flake.nix` files;
5. generate or refresh their `flake.lock` files from the configured revision;
6. verify every lock's `locked.rev` matches the configured revision;
7. delete stale generated directories;
8. fail when a required platform artifact is unavailable;
9. support a regeneration check that produces no diff.

The generated files should already contain their exact version checks and the
commands needed by Phase 2, but Phase 1 is complete when generation itself is
deterministic and structurally valid.

### 7. Bootstrap Nix on GitHub-hosted runners

Nix bootstrap is shared infrastructure for Phases 2 and 3. Before any
`nix build`, `nix flake check`, or `nix develop` invocation, the generated Linux
and macOS workflow must:

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
  - run: nix flake check ./nix/generated/node-24-linux-x86_64
```

Windows keeps its existing native setup path.

### 8. Phase 2: build and validate every generated flake

Before converting CI jobs or producing images, each generated flake must pass a
standalone validation:

1. `nix flake check` or equivalent evaluation succeeds;
2. the declared environment builds;
3. every installed tool reports the expected exact version;
4. representative commands for every packaged tool run successfully;
5. Playwright uses the expected package and browser bundle;
6. required Rust, WASM, and 32-bit targets compile or execute as expected;
7. regeneration through `npm run ci-update` produces no diff.

A failure should identify the exact generated file, for example:

```text
nix/generated/playwright-linux-x86_64/flake.nix
```

This file should serve as a minimal reproduction without evaluating unrelated
jobs or systems.

Phase 2 succeeds only after every supported Linux and macOS target passes its
build and validation checks.

### 9. Phase 3: run CI directly through Nix

After Phase 2 succeeds, convert Linux and macOS jobs to execute their existing
commands directly through the generated flakes.

For Playwright, preserve the browser-specific commands already generated by
`fjs/ci/playwright/module.f.ts`, for example:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
```

Do not create, publish, pull, or run OCI images during this phase. The purpose is
to prove that the generated Nix environments themselves are complete and
correct on native GitHub-hosted runners.

Run the Nix-backed and existing setup-action paths in parallel where necessary
until equivalent results and coverage are established.

### 10. Phase 4: performance and boundary measurements

Before selecting the permanent generated layout, measure:

- Nix evaluation time;
- cold and warm derivation build time;
- cache hit rates;
- duplicated downloads across jobs;
- parallel CI behavior;
- failure and debugging isolation.

Use these measurements to select per-system, per-job, per-major-version, or
hybrid boundaries. OCI considerations must not force this decision before the
direct Nix results are available.

### 11. Phase 5: add and validate Linux OCI outputs

Only after direct Nix CI succeeds should selected Linux flakes expose OCI
outputs built from the same proven derivations:

```sh
nix build ./nix/generated/linux-x86_64#oci-image
```

or:

```sh
nix build ./nix/generated/playwright-linux-x86_64#oci-image
```

Build `linux/amd64` and `linux/arm64` variants independently and verify that the
image contents pass the same exact-version, target, and Playwright checks as
the direct Nix environment.

Benchmark OCI assembly, image size, upload and pull time, and cross-job reuse
before deciding which Linux jobs should consume images.

### 12. Phase 6: protected publication and optional consumption

Image publication is the final phase. The regular generated CI workflow handles
`pull_request` and `merge_group` events with read-only permissions. It must not
publish packages, and fork code must never receive GHCR write credentials.

The initial publication workflow must:

- run only on `push` to the protected default branch after merge;
- not include `workflow_dispatch`;
- keep workflow-level permissions at `contents: read`;
- build and validate architecture-specific OCI outputs in read-only jobs;
- transfer validated image archives or equivalent immutable outputs to a final
  publication job;
- grant `packages: write` only to that final publication job;
- push immutable architecture-specific identities from the publication job;
- publish the multi-platform manifest only after both variants succeed.

Conceptually:

```yaml
permissions:
  contents: read

jobs:
  build-amd64:
    # Build, validate, and upload the OCI archive.

  build-arm64:
    # Build, validate, and upload the OCI archive.

  publish:
    needs: [build-amd64, build-arm64]
    permissions:
      contents: read
      packages: write
    # Push validated images and publish the manifest.
```

The build and validation jobs must never inherit package-write permission. If a
later implementation combines build and push in one job, that job is the
publication job and is the only job allowed to receive `packages: write`.

A manual rebuild may be designed later only with an enforced protected-branch
ref and, when appropriate, a protected environment approval. It is not part of
the initial path.

The GHCR packages should be public so CI, fork jobs, and external users can pull
them anonymously. The first publication is complete only after unauthenticated
pulls of all published immutable identities succeed.

Authentication, permission, registry, and network failures must not be treated
as image misses. Only a confirmed missing manifest or tag for the exact
immutable identity may trigger a direct-Nix or local-image fallback.

Publishing an image does not require immediately switching every Linux job to
it. Direct Nix CI remains the reference behavior. For a selected OCI-backed job:

1. compute the immutable identity from generated inputs;
2. attempt to pull that exact public image;
3. treat only a confirmed missing manifest or tag as a miss;
4. on a miss, run through the proven generated Nix flake or build its OCI output
   locally;
5. never push from `pull_request` or `merge_group` jobs;
6. never substitute an unrelated mutable image such as `latest`.

### 13. Tasks

#### Phase 1: generation

- [ ] Add target-specific Nix generation to `fjs/ci/module.f.ts` or a dedicated
      generator used by `npm run ci-update`.
- [ ] Generate exact per-host tool artifacts, URLs, formats, and hashes from the
      existing CI source configuration.
- [ ] Add the exact full `nixpkgs` commit to maintained CI configuration.
- [ ] Generate every flake and lock from that configured revision and reject any
      lock whose `locked.rev` differs.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Generate and refresh a `flake.lock` for each independent flake.
- [ ] Delete stale generated Nix files when source tools, versions, targets, or
      jobs are removed.
- [ ] Add the regeneration check proving `npm run ci-update` leaves no diff.

#### Phase 2: build and validation

- [ ] Generate pinned Nix installer and cache bootstrap steps before the first
      Nix command in every Linux and macOS validation job.
- [ ] Add exact installed-version and representative execution checks.
- [ ] Implement precise Playwright package/browser generation and validation.
- [ ] Validate required Rust, WASM, and 32-bit targets.
- [ ] Prove every generated flake evaluates, builds, and passes its checks on its
      supported runner architecture.

#### Phase 3: direct Nix CI

- [ ] Run existing Linux and macOS CI commands directly through generated flakes
      without creating OCI images.
- [ ] Preserve the existing Playwright commands generated by
      `fjs/ci/playwright/module.f.ts`.
- [ ] Compare the Nix-backed jobs with the existing setup-action paths before
      removing the old path.
- [ ] Keep Windows on the existing native generated installation path.

#### Phase 4: choose boundaries

- [ ] Benchmark per-system, per-job, per-major-version, and hybrid flake layouts.
- [ ] Measure cold and warm builds, evaluation, cache reuse, duplicated downloads,
      concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI is proven.

#### Phase 5: OCI generation

- [ ] Expose OCI outputs only from already proven Linux flakes.
- [ ] Build and validate AMD64 and ARM64 variants.
- [ ] Verify OCI contents against the same direct-Nix validation suite.
- [ ] Benchmark OCI assembly, image size, upload, pull, and reuse behavior.

#### Phase 6: publication and optional consumption

- [ ] Generate a push-to-protected-default-branch GHCR workflow with
      workflow-level `contents: read` only and no initial `workflow_dispatch`.
- [ ] Keep architecture build and validation jobs free of `packages: write`.
- [ ] Grant `contents: read` and `packages: write` only to the final publication
      job that pushes the validated images and manifest.
- [ ] Keep PR and merge-group workflows read-only.
- [ ] Configure public GHCR visibility and verify anonymous pulls.
- [ ] Publish architecture-specific images and the multi-platform manifest only
      after validation succeeds.
- [ ] Compare OCI-backed CI with direct Nix CI before selecting consumers.
- [ ] Implement fallback only for a confirmed missing immutable manifest or tag.
- [ ] Remove or deprecate `docker/Dockerfile` only after the Nix-built OCI path
      covers its intended use cases.

### Out of scope

- a developer-oriented aggregate `flake.nix`;
- manual GHCR publication in the initial implementation.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generation, validation, and direct Nix CI.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — blocked later OCI
  generation, publication, and optional consumption.
- [GitHub issue #1034](https://github.com/functionalscript/functionalscript/issues/1034)
  — original Dockerfile/Nix proposal.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
- [i096](96.md) — CI caching.
