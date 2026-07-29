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
Nix generation + CI conversion + OCI creation + GHCR publication
```

That makes it harder to determine whether a failure comes from the generated
Nix environment or from its OCI packaging and distribution.

### Proposal

Implement the migration in strict phases:

```text
Phase 1: generate exact target-specific Nix flakes
Phase 2: build and validate every generated flake
Phase 3: run Linux/macOS CI directly through Nix
Phase 4: measure and select useful flake boundaries
Phase 5: add Linux OCI outputs
Phase 6: publish OCI images and optionally consume them in CI
```

OCI is deliberately last. The first milestone is proving that `npm run
ci-update` can generate proper Nix files that reproduce the current CI tool
sets and run the existing CI commands without creating an OCI image.

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

Adding or deleting a tool, version line, host, architecture, target, or CI job
in the source configuration must add or delete the corresponding generated Nix
files. The `.nix` files are committed generated artifacts and are never
maintained manually.

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

### 3. Pin exact upstream artifacts

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
and later OCI builders. Its revision is pinned by each generated `flake.lock`,
but it does not independently select project tool versions.

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

### 6. Phase 1: prove the generated Nix files

Before converting CI jobs or producing images, each generated flake must pass a
standalone proof:

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

### 7. Bootstrap Nix on GitHub-hosted runners

Before any `nix build`, `nix flake check`, or `nix develop` invocation, the
generated Linux and macOS workflow must:

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

Windows keeps its existing native setup path.

### 8. Phase 2: run CI directly through Nix

After the standalone proof succeeds, convert Linux and macOS jobs to execute
their existing commands directly through the generated flakes.

```sh
nix develop ./nix/generated/playwright-linux-x86_64 --command npm run test-playwright
```

Do not create, publish, pull, or run OCI images during this phase. The purpose is
to prove that the generated Nix environments themselves are complete and
correct on native GitHub-hosted runners.

Run the Nix-backed and existing setup-action paths in parallel where necessary
until equivalent results and coverage are established.

### 9. Phase 3: performance and boundary measurements

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

### 10. Phase 4: add Linux OCI outputs

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

### 11. Phase 5: protected GHCR publication

Image publication is a final-stage workflow. The regular generated CI workflow
handles `pull_request` and `merge_group` events with read-only permissions. It
must not publish packages, and fork code must never receive GHCR write
credentials.

The initial publication workflow must:

- run only on `push` to the protected default branch after merge;
- not include `workflow_dispatch`;
- grant `contents: read` and `packages: write` only to the publication job;
- build from the protected default-branch commit;
- build and validate both architecture-specific OCI outputs;
- push immutable architecture-specific identities;
- publish the multi-platform manifest only after both variants succeed.

A manual rebuild may be designed later only with an enforced protected-branch
ref and, when appropriate, a protected environment approval. It is not part of
the initial path.

The GHCR packages should be public so CI, fork jobs, and external users can pull
them anonymously. The first publication is complete only after unauthenticated
pulls of all published immutable identities succeed.

Authentication, permission, registry, and network failures must not be treated
as image misses. Only a confirmed missing manifest or tag for the exact
immutable identity may trigger a direct-Nix or local-image fallback.

### 12. Optional OCI consumption

Publishing an image does not require immediately switching every Linux job to
it. Direct Nix CI remains the reference behavior.

For a selected OCI-backed job:

1. compute the immutable identity from generated inputs;
2. attempt to pull that exact public image;
3. treat only a confirmed missing manifest or tag as a miss;
4. on a miss, run through the proven generated Nix flake or build its OCI output
   locally;
5. never push from `pull_request` or `merge_group` jobs;
6. never substitute an unrelated mutable image such as `latest`.

### 13. Generation consistency

During the initial Nix phases, `npm run ci-update` should:

1. resolve versions and upstream artifacts for every supported target;
2. compute or import expected hashes;
3. generate all target-specific `flake.nix` files;
4. generate or refresh their `flake.lock` files;
5. delete stale generated directories;
6. regenerate the Linux/macOS workflow using the resulting flake paths;
7. emit Nix installer and cache bootstrap steps;
8. fail if a required platform artifact is unavailable;
9. support a CI check that regeneration produces no diff.

Only in the later OCI phase should the generator add OCI outputs and the
protected publication workflow.

### Tasks

#### Phase 1: generate and prove Nix

- [ ] Add target-specific Nix generation to `fjs/ci/module.f.ts` or a dedicated
      generator used by `npm run ci-update`.
- [ ] Generate exact per-host tool artifacts, URLs, formats, and hashes from the
      existing CI source configuration.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Generate and refresh a `flake.lock` for each independent flake.
- [ ] Delete stale generated Nix files when source tools, versions, targets, or
      jobs are removed.
- [ ] Add exact installed-version and representative execution checks.
- [ ] Implement precise Playwright package/browser generation and validation.
- [ ] Prove every generated flake evaluates, builds, and passes its checks.
- [ ] Add a regeneration check proving `npm run ci-update` leaves no diff.

#### Phase 2: direct Nix CI

- [ ] Generate pinned Nix installer and cache bootstrap steps before the first
      Nix command in every Linux and macOS job.
- [ ] Verify the bootstrap on every supported GitHub-hosted runner architecture.
- [ ] Run existing Linux and macOS CI commands directly through generated flakes
      without creating OCI images.
- [ ] Compare the Nix-backed jobs with the existing setup-action paths before
      removing the old path.
- [ ] Keep Windows on the existing native generated installation path.

#### Phase 3: choose boundaries

- [ ] Benchmark per-system, per-job, per-major-version, and hybrid flake layouts.
- [ ] Measure cold and warm builds, evaluation, cache reuse, duplicated downloads,
      concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI is proven.

#### Phase 4: OCI generation

- [ ] Expose OCI outputs only from already proven Linux flakes.
- [ ] Build and validate AMD64 and ARM64 variants.
- [ ] Verify OCI contents against the same direct-Nix validation suite.
- [ ] Benchmark OCI assembly, image size, upload, pull, and reuse behavior.

#### Phase 5: publication and optional consumption

- [ ] Generate a push-to-protected-default-branch GHCR publication workflow with
      `packages: write` and no initial `workflow_dispatch` trigger.
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
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI generation,
  publication, and optional consumption.
- [GitHub issue #1034](https://github.com/functionalscript/functionalscript/issues/1034)
  — original Dockerfile/Nix proposal.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
- [i096](96.md) — CI caching.
