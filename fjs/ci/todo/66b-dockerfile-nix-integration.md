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

Generate independent target-specific Nix flakes directly from `fjs/ci/`.
Use them natively on Linux and macOS, and let Linux flakes optionally produce
OCI images for GHCR and container-based CI.

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

Do not choose the final boundary before benchmarking. The generator should make
it inexpensive to change the layout.

Each target-specific flake should be explicit and independently debuggable. It
should avoid branches for unrelated systems and expose only the outputs useful
for that environment.

### 3. Pin exact upstream artifacts

Do not install Node, Deno, Bun, Rust, Wasmtime, Wasmer, or Playwright by asking
`nixpkgs` for its currently packaged version.

Generate fixed-output fetches from the same release artifacts selected by the
cross-platform CI updater. Each generated target records its own:

- exact version;
- upstream URL;
- archive format;
- expected hash;
- unpacking and installation steps;
- runtime dependency and wrapper requirements.

`nixpkgs` may provide Nix helpers, patching hooks, system libraries, shell tools,
and OCI builders. Its revision is pinned by each generated `flake.lock`, but it
does not independently select project tool versions.

### 4. Model hosts and targets separately

A generated host flake is one of:

- `x86_64-linux`;
- `aarch64-linux`;
- `x86_64-darwin`;
- `aarch64-darwin`.

It may additionally install targets such as:

- `wasm32-wasip1`;
- `wasm32-wasip1-threads`;
- `wasm32-wasip2`;
- `wasm32-unknown-unknown`;
- `i686-unknown-linux-gnu`.

For example, 32-bit Linux support may require a linker and 32-bit libraries in
an x86-64 host environment. It does not automatically imply a separate 32-bit
host flake.

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

### 6. Use Nix natively on macOS

Generated macOS flakes run directly on GitHub's Intel and ARM macOS runners.
They must preserve native macOS testing rather than placing macOS jobs inside a
Linux VM or container.

A job may run a command such as:

```sh
nix develop ./nix/generated/node-24-darwin-aarch64 --command npm test
```

The exact directory and output depend on the selected generation boundary.

### 7. Produce Linux OCI images directly

A generated Linux flake may expose an OCI output built from the same derivations
used by its native Nix environment:

```sh
nix build ./nix/generated/linux-x86_64#oci-image
```

or:

```sh
nix build ./nix/generated/playwright-linux-x86_64#oci-image
```

Build `linux/amd64` and `linux/arm64` variants independently. Publish them to
GHCR using immutable identities, and optionally combine them into a
multi-platform manifest.

The final image boundary is intentionally undecided. Benchmark one complete
image per architecture, per-job images, and useful hybrid groupings.

### 8. Keep Windows unchanged

Windows continues to use the existing generated GitHub Actions installation
steps and native Windows upstream artifacts. Nix through WSL would test Linux,
not native Windows behavior.

The Windows installer and generated Nix flakes must consume the same source
versions so all three operating systems test the intended release set.

### 9. Validation and debugging

Every generated environment should include checks for the exact installed
versions. At minimum, validate the tools used by that environment, such as:

```text
node --version
bun --version
deno --version
rustc --version
wasmtime --version
wasmer --version
```

Playwright validation should also cover the expected package and browser bundle.

A CI failure should identify the exact generated flake, for example:

```text
nix/generated/playwright-linux-x86_64/flake.nix
```

That flake must be independently buildable so it can serve as a minimal
reproduction without evaluating unrelated jobs or systems.

### 10. Generation consistency

`npm run ci-update` should:

1. resolve versions and upstream artifacts for every supported target;
2. compute or import the expected hashes;
3. generate all target-specific `flake.nix` files;
4. generate or refresh their `flake.lock` files;
5. delete stale generated directories;
6. regenerate the GitHub workflow using the resulting flake paths;
7. fail if a required platform artifact is unavailable;
8. support a CI check that regeneration produces no diff.

### 11. Performance experiment

Before selecting the permanent file/image layout, measure:

- Nix evaluation time;
- cold and warm derivation build time;
- cache hit rates;
- parallel CI behavior;
- duplicated downloads across jobs;
- OCI assembly, upload, and pull time;
- image size;
- debugging and failure isolation.

File layout is a generated implementation choice. It should be optimized for CI
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
- [ ] Add exact installed-version validation to each generated environment.
- [ ] Implement precise Playwright package/browser generation.
- [ ] Keep Windows on the existing native generated installation path.
- [ ] Expose Linux OCI image outputs and build both AMD64 and ARM64 variants.
- [ ] Publish OCI images to GHCR with immutable tags or digests.
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
