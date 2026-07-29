## 65Z-ci-nix. Generate Nix environments for Linux and macOS CI

**Priority:** P4
**Status:** open

### Summary

Generate Nix files from the existing CI source of truth in `fjs/ci/` and use
them to install exact tool versions on native Linux and macOS GitHub runners.
Windows remains on the existing generated GitHub Actions installation steps so
that it continues to test native Windows behavior.

Nix must not select tool versions from whatever happens to be available in the
current `nixpkgs` revision. `npm run ci-update` already controls when tool
versions change; it should also generate the Nix expressions with the exact
upstream versions, URLs, platform-specific artifacts, and hashes.

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
        +-- generated Linux/macOS Nix flakes
        +-- generated Linux OCI images
        +-- native Windows installation steps
```

The generated `.nix` files are build artifacts. They are committed so that CI
can use them directly, changes are reviewable, and a failed environment can be
reproduced without rerunning the generator. They are not intended to be
maintained manually or optimized for reuse by developers.

### Independent generated flakes

Start without a root-level generic `flake.nix`. Generate one or more independent
flake directories and let GitHub CI reference them directly.

Possible initial layouts include one flake per OS/architecture:

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

Do not decide the final boundary before measuring build, evaluation, cache, and
CI concurrency behavior. A hybrid layout is also valid. For example, Node,
WASM, and Playwright may use different boundaries.

A developer-oriented root flake may later compose the generated environments,
but that is explicitly out of scope for this task.

### Fully resolved target files

Each generated flake should describe one known target or CI environment with no
unnecessary cross-platform dispatch logic. It may include:

- the exact host OS and architecture;
- the exact set of tools required by the environment;
- the exact tool versions;
- platform-specific upstream URLs and archive formats;
- hashes for every downloaded artifact;
- installation and wrapping steps;
- runtime libraries and environment variables;
- validation commands that compare installed versions with the CI config;
- an optional Linux OCI image output.

This makes a single generated flake an independently buildable and debuggable
specification. A failure such as `playwright-linux-x86_64` can be reproduced
without evaluating unrelated macOS, ARM, Node, or WASM environments.

Generated duplication is acceptable. The reusable abstractions belong in the
TypeScript/FunctionalScript generator; the generated Nix should favor explicit,
resolved build plans over manually maintained generic abstractions.

### Host systems and compilation targets

Keep host systems separate from additional compilation targets.

Examples of hosts:

- `x86_64-linux`
- `aarch64-linux`
- `x86_64-darwin`
- `aarch64-darwin`

Examples of targets installed into a host environment:

- `wasm32-wasip1`
- `wasm32-wasip1-threads`
- `wasm32-wasip2`
- `wasm32-unknown-unknown`
- `i686-unknown-linux-gnu`

An x86-64 Linux environment that tests `i686-unknown-linux-gnu` may require a
32-bit linker and libraries, but it is still an `x86_64-linux` host flake.

### Exact upstream versions

Nix is the reproducible installer and build graph, not the version authority.
The generator should use the same upstream releases selected for Windows,
macOS, and Linux CI, even when those releases are not yet packaged by
`nixpkgs`.

For each supported host, the generated derivation should fetch the exact
upstream artifact using its expected hash. `nixpkgs` remains useful for Nix
helpers, unpacking tools, patching tools, runtime libraries, and image creation,
but it must not silently choose different Node, Deno, Bun, Rust, Wasmtime,
Wasmer, or Playwright versions.

### Playwright

Treat Playwright as a coordinated, precisely versioned environment rather than
as a single executable. The generated configuration should keep these parts in
sync:

- the Playwright package and driver version;
- Chromium, Firefox, and WebKit revisions;
- the platform-specific browser artifacts and hashes;
- required native runtime libraries;
- `PLAYWRIGHT_BROWSERS_PATH` and related environment variables.

The generator should derive this information from the same Playwright version
used by the generated GitHub workflow. CI should validate that the package and
browser bundle belong to the expected version.

### Platform split

| Platform | Tool management | Native OS tested? |
|---|---|---|
| Linux Intel + ARM | Generated Nix flakes; optionally exported as OCI images | Yes without OCI; Linux host with OCI |
| macOS Intel + ARM | Generated Nix flakes on native macOS runners | Yes |
| Windows | Existing generated GitHub Actions steps | Yes |

Nix under WSL is not a replacement for native Windows CI because it tests Linux
behavior rather than Windows paths, shells, binaries, and filesystem semantics.

### Lock files

Each independent flake may have its own generated `flake.lock`. The lock file
pins `nixpkgs` and other flake inputs; exact upstream tools are pinned in the
generated derivations by version, URL, and hash.

The generator should normally keep all flakes on the same intended `nixpkgs`
revision, but independent locks also allow a specific environment to use a
different revision when required.

### CI usage

A GitHub job should reference the generated directory directly, for example:

```sh
nix develop ./nix/generated/playwright-linux-x86_64 --command npm run test-playwright
```

or build a declared package or image output:

```sh
nix build ./nix/generated/linux-x86_64#node-24
nix build ./nix/generated/linux-x86_64#oci-image
```

The exact output names depend on whether the experiment chooses per-system,
per-job, or hybrid flakes.

### Tasks

- [ ] Extend `npm run ci-update` to generate target-specific Nix files with exact
      versions, upstream URLs, archive formats, and hashes.
- [ ] Generate independent flakes for native Linux and macOS CI; do not add a
      root-level generic flake.
- [ ] Keep native Windows jobs on the existing generated installation steps.
- [ ] Add installation-version checks for every generated environment.
- [ ] Model host systems separately from Rust/WASM/32-bit compilation targets.
- [ ] Implement Playwright as a coordinated package, driver, browser, and native
      dependency bundle.
- [ ] Benchmark per-OS/architecture, per-job, and useful hybrid flake boundaries.
- [ ] Measure cold and warm build times, evaluation time, cache reuse, and CI
      concurrency behavior.
- [ ] Verify that `npm run ci-update` leaves no stale generated Nix files after a
      tool, major version, system, architecture, or job is added or removed.
- [ ] Decide how generated `flake.lock` files are refreshed and verify that they
      pin the intended `nixpkgs` revisions.
- [ ] Keep a developer-oriented aggregate `flake.nix` out of scope.

### Related

- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — consume Nix-built OCI
  images in Linux CI.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete
  generator and OCI-image implementation plan.
- i145 — Docker containers for Linux CI jobs.
- i095 — original Docker CI idea.
