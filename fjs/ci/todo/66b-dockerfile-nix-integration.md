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

That makes it difficult to determine whether a failure comes from the generated
Nix environment or from OCI packaging and distribution.

The migration must also preserve cross-platform generation. `npm run update`
invokes `npm run ci-update` and must remain runnable on native Windows, where
Nix has no native execution path.

Collecting platform-specific artifact hashes and maintaining a complete
`flake.lock` graph would introduce another update workflow before the generated
Nix environments themselves are proven. Exact-version generation is therefore
part of this migration; stronger content locking is tracked separately.

### Proposal

Implement the migration in these six strictly ordered phases. Each phase number
has exactly the same meaning in the overview, detailed sections, and task lists:

```text
Phase 1: generate exact-version target-specific Nix flakes
Phase 2: build and validate every generated flake
Phase 3: run Linux/macOS CI directly through Nix
Phase 4: measure and select useful flake boundaries
Phase 5: add and validate Linux OCI outputs
Phase 6: publish OCI images and optionally consume them in CI
```

Each phase gates the next phase. OCI is deliberately last.

`npm run ci-update` initially generates committed `flake.nix` files from exact
versions and platform metadata without invoking Nix. It does not initially
discover artifact hashes or generate `flake.lock`. Those stronger
reproducibility mechanisms are covered by
[65Z-ci-nix-locks](65z-ci-nix-locks.md).

Do not generate a root-level aggregate `flake.nix` in the initial scope. GitHub
jobs reference the specific generated flake directory that defines their
environment. A developer-oriented aggregate flake may be considered later and
must not constrain the CI design.

### 1. Keep `fjs/ci/` as the source of truth

The maintained generator configuration owns:

- tools and major-version variants;
- CI-job requirements;
- supported host OS and architecture combinations;
- additional compilation targets;
- exact versions;
- upstream URLs and archive formats;
- platform-specific installation details;
- Playwright package and browser coordination.

Adding or deleting a tool, version line, host, architecture, target, or CI job
must add or delete the corresponding generated Nix files. Generated `.nix`
files are committed artifacts and are never maintained manually.

The first implementation provides version-level reproducibility. It assumes an
upstream publisher does not replace the artifact associated with an existing
version. Artifact hashes and generated Nix input lock files can later strengthen
that guarantee without changing the maintained version authority.

### 2. Generate independent resolved flakes

Possible boundaries include:

- one flake per OS and architecture;
- one flake per CI job, OS, and architecture;
- one flake per major tool version and target;
- a measured hybrid split.

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

### 3. Pin exact upstream versions

Do not install Node, Deno, Bun, Rust, Wasmtime, Wasmer, or Playwright by asking
`nixpkgs` for whichever version it currently packages.

Generate the same exact releases selected by the existing cross-platform CI
updater. Each generated target records:

- exact version;
- upstream URL or package source;
- archive format where applicable;
- installation and wrapping steps;
- runtime dependencies.

`nixpkgs` may provide helpers, patching hooks, system libraries, shell tools,
and later OCI builders. It does not independently select project tool versions.

The initial migration does not require the maintained generator to discover or
store expected hashes for every platform artifact. When the design is proven,
[65Z-ci-nix-locks](65z-ci-nix-locks.md) can add automated byte-level
verification and Nix input-graph locking.

### 4. Keep ordinary generation simple and cross-platform

Ordinary generation must remain cross-platform:

```sh
npm run update
npm run ci-update
```

Both commands must run on Linux, macOS, and native Windows without Nix. They
render generated Nix expressions from maintained version and platform metadata.

Ordinary generation must not:

- invoke Nix;
- download every upstream tool artifact;
- compute or discover artifact hashes;
- generate or refresh `flake.lock`;
- resolve moving tool versions or Nix input branches.

A version or exact input-revision update is an ordinary configuration change.
A later content-lock update command may require Nix, but it belongs to
[65Z-ci-nix-locks](65z-ci-nix-locks.md) and must not become part of routine
generation.

### 5. Model hosts and targets separately

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

### 6. Generate Playwright as a precise bundle

The Playwright environment must coordinate:

- package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser downloads;
- Linux or macOS native dependencies;
- browser-path environment variables;
- validation that the package and browsers belong together.

The test job must not silently install browser versions that do not correspond
to the selected Playwright package. Preserve the commands already generated by
`fjs/ci/playwright/module.f.ts`:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=firefox
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=webkit
```

### 7. Phase 1: generate exact-version Nix flakes

Phase 1 generates committed target-specific files without converting existing
CI jobs and without adding OCI outputs.

`npm run ci-update` should:

1. read exact versions and platform installation metadata for every target;
2. generate all target-specific `flake.nix` files;
3. generate exact-version validation commands;
4. delete stale generated directories;
5. fail when a required version or platform installation source is unavailable.

It should not compute artifact hashes or generate `flake.lock`.

The existing regeneration job stays Nix-independent:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - run: npm run ci-update
  - run: git add -A && git diff --cached --exit-code
```

A plain `git diff --exit-code` is insufficient because it ignores newly created
untracked files. The staged comparison must detect additions, deletions, and
modifications.

Phase 1 succeeds only when ordinary generation works on native Windows and
produces no staged diff.

### 8. Nix bootstrap for Phases 2 and 3

Nix bootstrap is required for validation and direct CI, not for Phase 1
generation. Before `nix build`, `nix flake check`, `nix develop`, or an
equivalent command, Linux and macOS jobs should:

1. check out the repository;
2. install Nix through a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache strategy;
4. invoke the target-specific generated flake without requiring a committed
   `flake.lock`.

Validation must not silently add generated lock files to the Phase 1 contract.
Windows keeps its existing native setup path.

### 9. Phase 2: build and validate every generated flake

Before converting CI jobs or producing images, every generated flake must pass
standalone validation:

1. it evaluates without requiring a committed `flake.lock`;
2. the declared environment builds or is prepared successfully;
3. every installed tool reports the expected exact version;
4. representative commands run successfully;
5. Playwright uses the expected package and browser bundle;
6. required Rust, WASM, and 32-bit targets compile or execute as expected.

A failure should identify the exact generated file, for example:

```text
nix/generated/playwright-linux-x86_64/flake.nix
```

That file should serve as a minimal reproduction without evaluating unrelated
jobs or systems.

Phase 2 succeeds only after every supported Linux and macOS target passes.

### 10. Phase 3: run CI directly through Nix

After Phase 2 succeeds, convert Linux and macOS jobs to execute their existing
commands directly through generated flakes.

Do not create, publish, pull, or run OCI images during this phase. The purpose is
to prove that generated Nix environments are complete and correct on native
GitHub-hosted runners.

Run Nix-backed and existing setup-action paths in parallel where necessary until
equivalent results and coverage are established.

### 11. Phase 4: measure and choose boundaries

Before selecting the permanent generated layout, measure:

- Nix evaluation time;
- cold and warm environment preparation time;
- cache hit rates;
- duplicated downloads across jobs;
- parallel CI behavior;
- failure and debugging isolation.

Use these measurements to select per-system, per-job, per-major-version, or
hybrid boundaries. OCI considerations must not force this decision before the
direct Nix results are available.

### 12. Phase 5: add and validate Linux OCI outputs

Only after direct Nix CI succeeds should selected Linux flakes expose OCI
outputs built from the same proven environments.

Build `linux/amd64` and `linux/arm64` variants independently and verify that
image contents pass the same exact-version, target, and Playwright checks as the
direct Nix environment.

Benchmark OCI assembly, image size, upload and pull time, and cross-job reuse
before deciding which Linux jobs should consume images.

### 13. Phase 6: protected publication and optional consumption

Image publication is the final phase. The regular generated CI workflow handles
`pull_request` and `merge_group` events with read-only permissions. Fork code
must never receive GHCR write credentials.

The initial publication workflow must:

- run only on `push` to the protected default branch after merge;
- not include `workflow_dispatch`;
- keep workflow-level permissions at `contents: read`;
- build and validate architecture-specific OCI outputs in read-only jobs;
- transfer validated immutable outputs to a final publication job;
- grant `packages: write` only to that final publication job;
- publish architecture-specific identities and the multi-platform manifest only
  after all validation succeeds.

The GHCR packages should be public so CI, fork jobs, and external users can pull
them anonymously.

Publishing an image does not require immediately switching every Linux job to
it. Direct Nix CI remains the reference behavior. A selected OCI-backed job may
fall back only when the exact immutable manifest or tag is confirmed missing;
authentication, permission, registry, and network errors must fail the job.

### 14. Tasks

#### Phase 1: generation

- [ ] Add target-specific Nix generation to `fjs/ci/module.f.ts` or a dedicated
      generator used by `npm run ci-update`.
- [ ] Generate exact per-host versions, URLs, formats, installation logic, and
      `flake.nix` files without invoking Nix.
- [ ] Do not require artifact-hash discovery or `flake.lock` generation.
- [ ] Keep `npm run update` and `npm run ci-update` runnable on native Windows.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Preserve `git add -A && git diff --cached --exit-code`.
- [ ] Delete stale generated files when source tools, versions, targets, or jobs
      are removed.

#### Phase 2: build and validation

- [ ] Install pinned Nix and configure the selected cache before the first Nix
      command in Linux and macOS validation jobs.
- [ ] Prove every generated flake evaluates without requiring a committed
      `flake.lock`.
- [ ] Add exact installed-version and representative execution checks.
- [ ] Implement precise Playwright package/browser validation.
- [ ] Validate required Rust, WASM, and 32-bit targets.
- [ ] Prove every generated flake works on its supported runner architecture.

#### Phase 3: direct Nix CI

- [ ] Run existing Linux and macOS CI commands directly through generated flakes
      without creating OCI images.
- [ ] Preserve existing Playwright commands generated by
      `fjs/ci/playwright/module.f.ts`.
- [ ] Compare Nix-backed jobs with existing setup-action paths before removing
      the old path.
- [ ] Keep Windows on the existing native generated installation path.

#### Phase 4: choose boundaries

- [ ] Benchmark per-system, per-job, per-major-version, and hybrid flake layouts.
- [ ] Measure cold and warm preparation, evaluation, cache reuse, duplicated
      downloads, concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI is proven.

#### Phase 5: OCI generation

- [ ] Expose OCI outputs only from already proven Linux flakes.
- [ ] Build and validate AMD64 and ARM64 variants.
- [ ] Verify OCI contents against the direct-Nix validation suite.
- [ ] Benchmark OCI assembly, size, upload, pull, and reuse behavior.

#### Phase 6: publication and optional consumption

- [ ] Generate a push-to-protected-default-branch GHCR workflow with
      workflow-level `contents: read` only and no initial `workflow_dispatch`.
- [ ] Keep architecture build and validation jobs free of `packages: write`.
- [ ] Grant `packages: write` only to the final publication job.
- [ ] Configure public GHCR visibility and verify anonymous pulls.
- [ ] Publish immutable architecture identities and the multi-platform manifest
      only after all validation succeeds.
- [ ] Compare OCI-backed CI with direct Nix CI before selecting consumers.
- [ ] Implement fallback only for a confirmed missing immutable manifest or tag.
- [ ] Remove or deprecate `docker/Dockerfile` only after the Nix-built OCI path
      covers its intended use cases.

### Out of scope

- artifact-hash discovery and maintenance;
- generated and committed `flake.lock` files;
- a developer-oriented aggregate `flake.nix`;
- manual GHCR publication in the initial implementation.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generation, validation, and direct Nix CI.
- [65Z-ci-nix-locks](65z-ci-nix-locks.md) — later artifact hashes and Nix input
  lock files.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — blocked later OCI
  generation, publication, and optional consumption.
- [GitHub issue #1034](https://github.com/functionalscript/functionalscript/issues/1034)
  — original Dockerfile/Nix proposal.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
- [i096](96.md) — CI caching.
