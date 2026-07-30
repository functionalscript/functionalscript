## 65Z-ci-scenario-docker. Consider OCI after direct Nix CI works

**Priority:** P3
**Status:** blocked
**Blocked by:** [65Z-ci-nix](65z-ci-nix.md)

### Goal

Keep OCI images out of the first Nix milestone.

First prove the simpler path:

```text
declarative CI job -> generated flake.nix -> direct CI execution
```

Only then decide whether packaging selected Linux environments as OCI images
improves build time or cache reuse.

### Principles

- direct Nix CI is the reference behavior;
- OCI is an optional optimization, not a requirement for adopting Nix;
- OCI outputs must reuse already validated per-job flakes;
- do not introduce a Dockerfile as another generated representation unless a
  concrete requirement needs one;
- measure before deciding whether images should be per job or combined;
- preserve immutable identities and safe publication boundaries;
- keep OCI-specific details in this later task rather than complicating the first
  generated flakes.

### Entry criteria

Begin OCI work only after:

- simple self-contained flakes are generated and committed for selected Linux
  jobs;
- those jobs run their existing commands directly through Nix;
- the direct path is reliable enough to serve as a fallback and comparison;
- basic cold/warm build and cache measurements exist.

Complex jobs do not need to block an OCI experiment for already proven simple
jobs, but an image may include only environments whose direct flakes have passed.

### Experiment

For one proven Linux job:

1. add an OCI output derived from its existing flake;
2. build it for the required Linux architecture;
3. run the same CI commands;
4. compare image size, build time, pull time, and cache reuse with direct Nix;
5. keep the OCI path only when it improves total CI behavior.

Additional architectures, combined images, publication workflows, and fallback
rules should be designed from the experiment's results rather than specified in
advance.

### Publication constraints

When publication is eventually added:

- publish only immutable identities;
- do not expose package-write credentials to pull-request code;
- validate before publishing;
- keep direct Nix as the fallback/reference path.

### Tasks

- [ ] Complete the first direct-Nix per-job implementation.
- [ ] Record direct-Nix build and cache measurements.
- [ ] Select one proven Linux job for an OCI experiment.
- [ ] Generate the OCI output from that job's validated flake.
- [ ] Compare OCI-backed and direct-Nix CI behavior.
- [ ] Add architecture and publication details only after the first experiment.
- [ ] Adopt OCI only for jobs where measurements justify it.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — prerequisite declarative per-job flakes.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — direct Nix
  implementation sequence.
- [i096](96.md) — CI caching.
