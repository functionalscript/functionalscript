## Investigate mise and Pixi as Nix alternatives

**Priority:** P3
**Status:** open

### Problem

The shared Nix development environment and native Windows CI use different
installation paths. Investigate whether [mise](https://mise.jdx.dev/),
[Pixi](https://pixi.prefix.dev/), or another cross-platform system can provide
the project's development and CI tooling through one primary environment
manager across all supported platforms.

### Requirements

- **Native platform support is mandatory:** Linux, macOS, and Windows, each on
  x64 and ARM64. Windows must work without requiring WSL2 or a Linux container.
- **Easy support for uncommon tools:** adding a pinned binary such as
  SpiderMonkey should require little configuration, packaging, and ongoing
  maintenance, including any native runtime dependencies.
- **Good coverage in globally available, trusted binary caches:** evaluate usable
  prebuilt artifacts for the project's exact tool versions on each platform.
  Record the publishers, provenance and integrity checks, update lag, and gaps
  that would require our own builds or hosting.
- **Fast package installation on CI:** compare the time needed to make the
  required tools available with empty caches and restored caches, including
  manager bootstrap and cache overhead.

### Stages

#### 1. Create a PR with a development environment for developers to try

- [ ] Inventory the tool versions, Rust components and compilation targets,
      native libraries, linkers, and SDK requirements from the current tool
      configuration, Nix environment, and platform CI jobs.
- [ ] Compare mise, Pixi, and any other candidates against that inventory for
      every required host. Classify each requirement as available from a trusted
      public binary source, requiring custom packaging or a source build, or
      unavailable. Distinguish public binary availability from local download
      caches, GitHub Actions caches, and cached successful test results.
- [ ] Demonstrate adding SpiderMonkey to each candidate. Evaluate version and
      checksum locking, runtime dependencies, maintenance effort, and reuse of
      prebuilt artifacts through our own server or GitHub storage when public
      coverage is insufficient.
- [ ] Create a PR with a development environment based on mise, Pixi, or another
      cross-platform system for developers to try on Linux, macOS, and native
      Windows. Include setup instructions, VS Code extension, task, and terminal
      access to the tools, and representative CI configurations. Collect
      feedback on every supported OS and architecture; record prerequisites,
      separately managed tools, and integration work for the generators.
- [ ] Benchmark CI environment setup for each candidate and the current setup
      on each supported platform, using comparable runners and equivalent
      tool versions, components, and targets. Measure elapsed time until tools
      are ready with empty local and CI caches and with restored caches,
      including manager bootstrap, cache restoration, downloads, extraction,
      installation, and any source builds.
      Report cache save time separately from setup time, and keep build/test
      execution separate. Use repeated runs to record typical timings and
      variation.
- [ ] Document developer feedback, platform/package coverage, example
      configurations, reproducibility limits, CI installation timings,
      maintenance costs, and unresolved gaps.

#### 2. Decide which system to keep and replace or retain Nix

- [ ] Use the trial results to choose the system to keep and decide whether to
      replace or retain Nix. A replacement must meet the requirements above;
      retaining the current setup remains a valid outcome.
- [ ] If a migration is selected, implement it in a follow-up PR. This may also
      require replacing or updating CI environments and workflows,
      configuration generators, caching, and developer setup documentation.
      Verify the resulting development and CI setup on all supported platforms.

### Related

- [Tool configuration](../config/module.f.js) — exact supported tool versions.
- [Nix environment](../nix/README.md) — current development environment.
- [CI](../README.md) — platform jobs and generated workflows.
- [CI caching](./096-ci-caching.md) — related cache investigation.
