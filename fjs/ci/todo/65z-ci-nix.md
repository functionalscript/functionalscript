## 65Z-ci-nix. Generate Nix environments for Linux and macOS CI

**Priority:** P4
**Status:** open

### Problem

Linux and macOS CI currently install tools through generated GitHub Actions
steps. This duplicates installation logic and does not provide one reproducible
environment definition that can be built and debugged independently.

The Nix work must also preserve the existing cross-platform generator workflow.
`npm run update` invokes `npm run ci-update` and must remain runnable on native
Windows. Ordinary generation therefore cannot require a local Nix installation.

OCI images are a separate concern. Creating them before the generated Nix
environments are proven would make it difficult to distinguish Nix-generation
failures from OCI packaging and distribution failures.

### Proposal

Generate explicit target-specific Nix flakes from the existing `fjs/ci/` source
of truth, commit those generated files, validate them on native Linux and macOS,
and then run existing CI commands directly through Nix.

Use this order:

```text
Phase 1: generate exact target-specific Nix flakes and lock files
Phase 2: build and validate every generated flake
Phase 3: run Linux/macOS CI directly through Nix
Phase 4: measure and select useful flake boundaries
Later: add OCI outputs, publication, and optional consumption
```

The first four phases do not create, publish, pull, or run OCI images. Windows
keeps its existing native generated installation path.

A developer-oriented aggregate `flake.nix` may be added later, but it is
explicitly out of scope and must not constrain the initial CI layout.

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
        +-- generated Linux/macOS Nix flakes and lock files
        +-- native Windows installation steps
```

Generated `.nix` and `flake.lock` files are committed build artifacts. They are
not maintained manually. Reusable abstractions belong in the
TypeScript/FunctionalScript generator.

### Cross-platform generation

`npm run ci-update` must be Nix-independent. It must run with the repository's
supported Node environment on Linux, macOS, and native Windows.

The maintained CI configuration must contain all normalized input metadata
needed to generate deterministic lock files, not only a moving input name. For
`nixpkgs`, this should include at least:

- the exact full Git commit;
- the locked content hash such as `narHash`;
- any other stable lock fields required by the generated `flake.lock` format.

For example, the maintained configuration may expose a value such as
`config.nix.nixpkgsLock`. The generator uses that data to emit both:

```nix
inputs.nixpkgs.url = "github:NixOS/nixpkgs/<configured-full-commit>";
```

and the corresponding deterministic `flake.lock` node without invoking Nix.

A normal `npm run update` or `npm run ci-update` must never resolve a moving
branch, contact Nix to refresh a lock, or require Nix to be installed.

### Deliberate input updates

Changing the maintained `nixpkgs` input is a separate operation from ordinary
generation. Add an explicit command, for example:

```sh
npm run ci-nix-input-update
```

This command may require Nix and is supported on a documented Nix-capable host,
such as Linux, macOS, or Windows through WSL. It should:

1. resolve the intentionally selected `nixpkgs` revision;
2. write the full normalized locked-input metadata into maintained `fjs/ci/`
   configuration;
3. run the ordinary Nix-independent `npm run ci-update`;
4. stage all generated changes and expose any diff for review.

The command is used only when intentionally changing a Nix input. It is not
called by `npm run update`, ordinary development on native Windows, or the
normal regeneration check.

A target-specific input exception must be explicit in maintained configuration.
Generated lock-file drift is never an implicit exception.

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
and CI concurrency behavior. A hybrid layout is valid.

### Fully resolved target files

Each generated flake should describe one known target or CI environment without
unnecessary cross-platform dispatch logic. It should include:

- the exact host OS and architecture;
- the exact required tools and versions;
- platform-specific upstream URLs and archive formats;
- hashes for every downloaded artifact;
- installation and wrapping steps;
- runtime libraries and environment variables;
- validation commands derived from the CI configuration.

Generated duplication is acceptable because each file is a compiled CI artifact
and a minimal reproduction for its environment.

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
32-bit linker and libraries, but it remains an `x86_64-linux` host flake.

### Exact upstream versions

Nix is the reproducible installer and build graph, not the version authority.
The generator should use the same upstream releases selected for Windows,
macOS, and Linux CI, even when those releases are not yet packaged by
`nixpkgs`.

Generated derivations should fetch exact upstream artifacts using expected
hashes. `nixpkgs` may provide helpers, patching tools, runtime libraries, and
later OCI builders, but it must not silently select different Node, Deno, Bun,
Rust, Wasmtime, Wasmer, or Playwright versions.

### Playwright

Treat Playwright as a coordinated bundle rather than a single executable. Keep
these parts synchronized:

- package and driver version;
- Chromium, Firefox, and WebKit revisions;
- platform-specific browser artifacts and hashes;
- required native runtime libraries;
- browser-path environment variables.

Preserve the commands already generated by `fjs/ci/playwright/module.f.ts`:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=chromium
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=firefox
nix develop ./nix/generated/playwright-linux-x86_64 \
  --command npx playwright test --browser=webkit
```

Do not invent a new package script merely for the Nix wrapper.

### Regeneration drift check

The existing generation job does not need Nix because ordinary generation is
Nix-independent. It must preserve the repository's staged-diff pattern:

```yaml
steps:
  - uses: actions/checkout@<pinned-version>
  - run: npm run ci-update
  - run: git add -A && git diff --cached --exit-code
```

`git add -A` is required before comparison. A plain `git diff --exit-code`
does not detect newly generated untracked files. The staged comparison must
detect additions, deletions, and modifications.

### Nix bootstrap for validation and direct CI

Nix is required only when evaluating, building, validating, or entering the
generated flakes. Linux and macOS jobs must therefore:

1. check out the repository;
2. install Nix using a pinned, trusted GitHub Action;
3. configure the selected Nix-store cache strategy;
4. invoke the target-specific generated flake.

Validation must treat committed lock files as immutable input. It must fail
rather than silently update a lock. It must also verify that the generated
locked revision and hash match maintained configuration.

Windows jobs do not use this bootstrap.

### Staged rollout

#### Phase 1: generation

Generate deterministic target-specific `flake.nix` and `flake.lock` files,
exact artifact fetches, validation definitions, and workflow paths.

Phase 1 succeeds when:

- `npm run ci-update` runs on Linux, macOS, and native Windows without Nix;
- generation deletes stale outputs;
- required platform artifacts are resolved or generation fails;
- `git add -A && git diff --cached --exit-code` reports no change.

#### Phase 2: build and validation

After installing Nix on Linux and macOS, prove that every generated flake:

1. evaluates without changing its committed lock;
2. builds its declared environment;
3. reports every expected exact tool version;
4. runs representative commands for every packaged tool;
5. uses the expected Playwright package and browser bundle;
6. supports the required Rust, WASM, and 32-bit targets;
7. uses the maintained locked Nix inputs.

A failure must identify the exact generated flake so it can be reproduced and
debugged independently.

#### Phase 3: direct Nix CI

After Phase 2 succeeds, convert Linux and macOS jobs to execute their existing
commands through generated flakes using `nix develop --command` or an equivalent
direct Nix invocation.

This phase intentionally does not create or consume OCI images. Compare the
Nix-backed jobs with existing setup-action jobs until equivalent coverage and
results are established.

#### Phase 4: measurements

Measure:

- cold and warm build times;
- evaluation time;
- cache reuse;
- duplicated downloads;
- CI concurrency behavior;
- failure and debugging isolation.

Use those measurements to choose per-OS/architecture, per-job,
per-major-version, or hybrid boundaries.

##### Baseline to beat: the Docker experiment

A generated `docker/Dockerfile` and the `docker-intel` / `docker-arm` jobs that
publish it to GHCR already exist. They are an **experiment, deliberately kept**
until Nix demonstrates the same capability at comparable or better cost — not
an alternative design competing with this one, and not something to remove as
off-plan. Measured on the runners:

| | Docker experiment |
|---|---|
| Cold build, per architecture | ~26 min |
| Warm run (image unchanged) | ~43 s, pull and smoke test |
| Cache key | SHA-256 of the generated Dockerfile, per architecture |

Phase 4 should produce the same two numbers for the generated flakes. Nix wins
the comparison by matching the warm number without a registry round trip, or by
making the cold number small enough that caching matters less. The Docker jobs
retire when it does; until then they stay, and `docker/README.md` describes
what they do today.

#### Later phases: OCI images

Only after direct Linux CI works reliably through generated flakes should Linux
flakes gain OCI outputs. OCI generation, GHCR publication, and optional CI
consumption are covered by
[65Z-ci-scenario-docker](65z-ci-scenario-docker.md) and Phases 5 and 6 in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

### Tasks

#### Phase 1: generation

- [ ] Extend `npm run ci-update` to generate exact target-specific `flake.nix`
      and `flake.lock` files without invoking Nix.
- [ ] Add complete normalized `nixpkgs` locked-input metadata to maintained
      `fjs/ci/` configuration.
- [ ] Generate every flake input and lock from that maintained metadata.
- [ ] Keep `npm run update` and `npm run ci-update` runnable on native Windows.
- [ ] Add a separate documented Nix-capable-host command for intentional input
      updates; do not call it from ordinary generation.
- [ ] Generate independent Linux and macOS flake directories without a root
      aggregate flake.
- [ ] Preserve `git add -A && git diff --cached --exit-code` so additions,
      deletions, and modifications all fail the drift check.
- [ ] Delete stale generated files when tools, versions, systems,
      architectures, targets, or jobs are removed.
- [ ] Generate exact installed-version and representative execution checks.
- [ ] Model hosts separately from Rust/WASM/32-bit compilation targets.
- [ ] Generate Playwright as a coordinated package, driver, browser, and native
      dependency bundle.

#### Phase 2: build and validation

- [ ] Install pinned Nix and configure the selected cache before the first Nix
      command in every Linux and macOS validation job.
- [ ] Verify generated locks without allowing validation to rewrite them.
- [ ] Verify generated locked revisions and hashes match maintained input
      metadata.
- [ ] Prove every generated flake evaluates, builds, and passes its checks.
- [ ] Validate Playwright with the existing browser-specific CI commands.
- [ ] Validate required Rust, WASM, and 32-bit targets.

#### Phase 3: direct Nix CI

- [ ] Run existing Linux and macOS CI commands directly through generated flakes
      without OCI images.
- [ ] Preserve existing Playwright commands generated by
      `fjs/ci/playwright/module.f.ts`.
- [ ] Compare results with existing setup-action jobs before removing them.
- [ ] Keep native Windows jobs on existing generated installation steps.

#### Phase 4: measurements

- [ ] Benchmark per-OS/architecture, per-job, per-major-version, and hybrid
      flake boundaries.
- [ ] Measure cold and warm builds, evaluation, cache reuse, duplicated
      downloads, CI concurrency, and debugging isolation.
- [ ] Select the generated boundary only after direct Nix CI results are
      available.

### Out of scope

- OCI image generation and GHCR publication until direct Nix CI is proven;
- a developer-oriented aggregate `flake.nix`.

### Related

- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — blocked OCI stage after
  direct Nix CI succeeds.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — staged
  implementation plan.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
