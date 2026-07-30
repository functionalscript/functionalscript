## 65Z-ci-nix-cache-macos. Investigate GitHub caching for macOS Nix environments

**Priority:** P4
**Status:** blocked
**Phase:** 5
**Blocked by:** [Phase 3 — direct Nix CI](65z-ci-nix-ci.md)

### Goal

Investigate whether GitHub Actions cache can reduce the cost of preparing the
generated Nix environments used by macOS CI jobs.

Linux may later use OCI images. macOS cannot consume those Linux images, so a
Nix-store or environment cache may be the primary way to avoid repeated setup
work there.

### Dependency

```text
Phase 3: macOS CI runs through generated Nix environments
        |
        v
Phase 5: measure GitHub-backed Nix caching [this task]
```

This task does not block Linux OCI work, committed `flake.lock` files, or Phase 7
hardening.

### Questions

- Can the relevant Nix store paths be restored through GitHub Actions cache?
- Does cache restore take less time than preparing the environment normally?
- How well are outputs shared between macOS Intel and ARM jobs?
- Should cache keys depend on the generated `flake.nix`, host architecture, CI
  job boundary, and selected tool versions?
- How quickly are useful cache entries evicted?
- Does uploading the cache cost more than it saves for short-lived jobs?
- Is a dedicated Nix binary cache preferable to GitHub Actions cache?

### Measurements

For representative macOS jobs, record:

- cold environment preparation time;
- warm environment preparation time;
- cache lookup and restore time;
- cache upload time;
- bytes restored and uploaded;
- hit and miss rates;
- duplicate data between jobs and architectures;
- failure behavior when the cache is unavailable.

### Tasks

- [ ] Select one Intel and one ARM macOS job as initial experiments.
- [ ] Test a GitHub Actions cache integration for the generated Nix environment.
- [ ] Define cache keys from committed generated inputs rather than timestamps.
- [ ] Confirm a cache miss falls back to normal Nix environment preparation.
- [ ] Measure cold, warm, hit, miss, upload, and restore behavior.
- [ ] Compare per-job, per-architecture, and shared cache boundaries.
- [ ] Document GitHub cache limits and eviction behavior observed by CI.
- [ ] Decide whether to adopt GitHub cache, a dedicated Nix cache, or no cache.

### Completion criteria

The task is complete when measurements support a documented decision for macOS
Nix environment caching. A negative result is acceptable.

### Related

- [Phase 3 — direct Nix CI](65z-ci-nix-ci.md).
- [Phase 4 — Linux OCI images](65z-ci-scenario-docker.md).
- [i096](96.md) — general CI caching.
- [66B rollout overview](66b-dockerfile-nix-integration.md).
