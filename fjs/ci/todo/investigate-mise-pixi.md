## Investigate mise and Pixi as Nix alternatives

**Priority:** P3
**Status:** open

### Problem

The shared Nix development environment and native Windows CI use different
installation paths. Investigate whether [mise](https://mise.jdx.dev/) or
[Pixi](https://pixi.prefix.dev/) can provide the project's development and CI
tooling through one primary environment manager across all supported platforms.

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

### Tasks

- [ ] Inventory the tool versions, Rust components and compilation targets,
      native libraries, linkers, and SDK requirements from the current tool
      configuration, Nix environment, and platform CI jobs.
- [ ] Compare mise and Pixi against that inventory for every required host.
      Classify each requirement as available from a trusted public binary
      source, requiring custom packaging or a source build, or unavailable.
      Distinguish public binary availability from local download caches,
      GitHub Actions caches, and cached successful test results.
- [ ] Demonstrate adding SpiderMonkey to each candidate. Evaluate version and
      checksum locking, runtime dependencies, maintenance effort, and reuse of
      prebuilt artifacts through our own server or GitHub storage when public
      coverage is insufficient.
- [ ] Try representative development and CI configurations, including native
      Windows and VS Code extension, task, and terminal access to the tools.
      Record prerequisites or separately managed tools, installation after
      caches are cleared, and integration work for the configuration generators.
- [ ] Document the platform/package coverage, example configurations,
      reproducibility limits, maintenance costs, and unresolved gaps. Recommend
      a candidate only if it meets the requirements; retaining the current
      setup remains a valid outcome.

This issue covers investigation. Any migration follows a separate decision
based on the findings.

### Related

- [Tool configuration](../config/module.f.js) — exact supported tool versions.
- [Nix environment](../nix/README.md) — current development environment.
- [CI](../README.md) — platform jobs and generated workflows.
- [CI caching](./096-ci-caching.md) — related cache investigation.
