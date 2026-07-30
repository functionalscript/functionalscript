## 65Z-ci-scenario-docker. Consider OCI after one direct Nix job works

**Priority:** P3
**Status:** blocked
**Blocked by:** [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md),
Phase 1 and Phase 2 for one selected Linux job

### Goal

Keep OCI images out of the first direct-Nix implementation.

First prove this path for at least one Linux job:

```text
declarative CI job -> generated flake.nix -> direct CI execution
```

Then test whether packaging that already proven environment as an OCI image improves
build time or cache reuse.

Rust, Playwright, and other unfinished complex jobs do not block this experiment.

### Principles

- direct Nix CI is the reference behavior;
- OCI is an optional optimization;
- an OCI output reuses an already validated per-job flake;
- an image may include only environments whose direct flakes pass their existing CI
  commands;
- do not introduce a Dockerfile unless a concrete requirement needs one;
- measure before deciding whether images should be per job or combined;
- preserve immutable identities and safe publication boundaries;
- keep OCI-specific details out of the first generated flakes.

### Entry criteria

Begin OCI work after one selected Linux job has:

- a simple committed self-contained flake;
- a pinned Nix bootstrap in CI;
- successful direct-Nix execution of its existing commands;
- a reliable direct path that can serve as the fallback and comparison;
- basic cold/warm build and cache measurements.

Completion of the full [65Z-ci-nix](65z-ci-nix.md) task is not required. Additional
jobs can join the OCI experiment only after their own direct flakes pass.

### First experiment

For the proven Linux job:

1. add an OCI output derived from its existing flake;
2. build it for the required Linux architecture;
3. run the same CI commands;
4. compare image size, build time, pull time, and cache reuse with direct Nix;
5. keep the OCI path only when it improves total CI behavior.

Additional architectures, combined images, publication workflows, and fallback
rules should be designed from the experiment's results.

### Publication constraints

When publication is eventually added:

- publish only immutable identities;
- do not expose package-write credentials to pull-request code;
- validate before publishing;
- keep direct Nix as the fallback/reference path.

### Tasks

- [ ] Complete Phase 1 and Phase 2 of
      [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) for one
      selected Linux job.
- [ ] Record direct-Nix build and cache measurements for that job.
- [ ] Change this TODO from `blocked` to `open` when those criteria pass.
- [ ] Generate an OCI output from the job's validated flake.
- [ ] Compare OCI-backed and direct-Nix CI behavior.
- [ ] Add architecture and publication details only after the first experiment.
- [ ] Adopt OCI only for jobs where measurements justify it.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — direct Nix
  implementation and the narrowed prerequisite.
- [i096](96.md) — CI caching.
