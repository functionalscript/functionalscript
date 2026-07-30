## ci-nix-ci. Run Linux and macOS CI through generated Nix environments

**Priority:** P3
**Status:** blocked
**Phase:** 3
**Blocked by:** [Phase 2 — generated `flake.nix` files](ci-nix.md)
**Does not depend on:** `flake.lock`, fixed artifact hashes, or the Phase 7 validation suite

### Goal

As soon as the target-specific `flake.nix` files are committed, change Linux and
macOS CI jobs to run their existing commands inside those generated Nix
environments.

The existing CI workload is the first practical exercise of the generated
environment. A separate comprehensive validation phase is useful, but it is not
a prerequisite for adopting the environment in CI.

### Dependency

```text
Phase 2: committed generated flake.nix files
        |
        v
Phase 3: run Linux/macOS CI through those files [this task]
        |
        +--> Phase 4: Linux OCI images
        +--> Phase 5: macOS Nix cache investigation
```

Phase 3 may start before:

- [Phase 6](ci-nix-locks.md), which commits `flake.lock` files;
- [Phase 7](ci-nix-hardening.md), which adds comprehensive validation and
  fixed artifact hashes.

### CI behavior

Linux and macOS jobs should:

1. check out the repository;
2. install Nix using a pinned GitHub Action;
3. invoke the generated target-specific environment;
4. run the same CI command the job runs today.

Conceptually:

```sh
nix develop ./nix/generated/<environment> --command <existing-ci-command>
```

The first implementation may use version-addressed upstream downloads while
preparing or entering the environment. It does not require every tool to be a
fixed-output Nix derivation.

Windows remains on the existing native generated installation path.

### Failure model

A Nix-backed job failure should identify the exact generated flake used by the
job. The generated file is the reproduction unit.

Do not require a separate validation job to pass before switching CI. The normal
job itself already tests whether the environment can execute its real workload.
Problems found after migration can be fixed in the generator and regenerated
files.

Phase 7 later adds systematic checks so failures are detected earlier and
reported more precisely.

### Tasks

- [ ] Add pinned Nix installation before the first Nix command in Linux and
      macOS jobs.
- [ ] Map each Linux and macOS job to its generated target-specific flake.
- [ ] Run existing CI commands through `nix develop --command` or an equivalent
      generated-environment invocation.
- [ ] Preserve the existing Playwright browser-specific test commands.
- [ ] Keep Windows jobs on the native generated installation path.
- [ ] Make failures report the generated flake path used by the job.
- [ ] Remove obsolete setup-action installation steps after their Nix-backed
      replacement is working.
- [ ] Do not block this migration on committed locks, fixed hashes, or a separate
      comprehensive validation suite.

### Completion criteria

- Linux CI jobs use committed generated Nix environments.
- macOS CI jobs use committed generated Nix environments.
- The existing CI commands run without a second independently maintained tool
  installation path.
- Windows remains functional through its current native path.

### Unlocks

- [Phase 4 — build and use Linux OCI images](ci-scenario-docker.md).
- [Phase 5 — investigate GitHub caching for macOS Nix environments](ci-nix-cache-macos.md).

### Related

- [Phase 2 — generate Nix environments](ci-nix.md).
- [rollout overview](dockerfile-nix-integration.md).