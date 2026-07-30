## 65Z-ci-scenario-docker. Design OCI after one direct Nix job works

**Priority:** P3
**Status:** blocked
**Blocked by:** [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md),
Phase 1 through Phase 3 for one selected Linux job

### Problem

We do not yet know whether packaging a Nix CI environment as an OCI image improves total
CI behavior. Selecting a builder, image layout, runtime model, identity, caching, or
publication workflow before a direct-Nix job works would turn an optimization experiment
into speculative implementation.

The first direct-Nix milestone should therefore remain independent of OCI work.

### Proposal

First prove this path for at least one Linux job:

```text
declarative CI job -> generated flake.nix -> direct CI execution
```

Then use the working job and measurements to write and review a concrete OCI design.
Do not implement an OCI output in this task. Rust, Playwright, and other unfinished
complex jobs do not block this design work.

#### Principles

- direct Nix CI is the reference behavior and fallback;
- OCI is an optional optimization;
- design from a validated job and measured bottlenecks;
- do not select a builder, image layout, or publication workflow before that evidence;
- do not introduce a Dockerfile unless the reviewed design requires one;
- preserve immutable identities and safe publication boundaries;
- keep OCI-specific details out of the first generated flakes;
- create a separate implementation TODO after the design is reviewed.

#### Entry criteria

Begin this design task after one selected Linux job has completed Phase 1 through Phase
3 and has:

- a simple committed self-contained flake;
- a pinned Nix bootstrap in CI;
- successful direct-Nix execution of its existing commands;
- a reliable direct path that can serve as the fallback and comparison;
- basic cold/warm build and cache measurements.

Completion of the full [65Z-ci-nix](65z-ci-nix.md) task is not required.

#### Design deliverable

For the selected proven job, the proposal must decide and explain:

- the OCI builder/provider;
- which files, packages, and runtime dependencies enter the image;
- the image entry point or command-execution model;
- how the existing CI command sequence runs inside the image;
- the immutable output identity and tag policy;
- the required Linux architecture;
- expected build, pull, and cache behavior compared with direct Nix;
- credential and publication boundaries;
- the direct-Nix fallback;
- validation and acceptance criteria.

Keep this design specific to one job. Do not generalize to combined images, additional
architectures, or repository-wide publication until the first implementation produces
real results.

#### Handoff

After the design is reviewed:

1. create a separate implementation TODO containing the selected concrete design;
2. implement the first OCI output there;
3. run the same CI commands through direct Nix and OCI;
4. compare image size, build time, pull time, and cache reuse;
5. adopt OCI only if it improves total CI behavior.

#### Publication constraints

Any later implementation must:

- publish only immutable identities;
- avoid exposing package-write credentials to pull-request code;
- validate before publishing;
- keep direct Nix as the fallback/reference path.

### Tasks

- [ ] Complete Phase 1 through Phase 3 of
      [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) for one
      selected Linux job.
- [ ] Record direct-Nix build and cache measurements for that job.
- [ ] Change this TODO from `blocked` to `open` when those criteria pass.
- [ ] Write the job-specific OCI design covering every item in the design deliverable.
- [ ] Review and accept or reject the OCI design.
- [ ] Create a separate implementation TODO only after the design is accepted.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — direct Nix
  implementation and prerequisite.
- [i096](96.md) — CI caching.
