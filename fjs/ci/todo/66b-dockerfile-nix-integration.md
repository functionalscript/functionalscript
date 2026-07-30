## 66B-dockerfile-nix-integration. Generate simple per-job Nix flakes

**Priority:** P3
**Status:** open

### Goal

Prove the Nix CI path with the smallest useful implementation:

```text
declarative CI job -> generated flake.nix -> existing CI commands
```

Begin with simple Node jobs. Keep generated Nix readable and postpone unproven
implementation choices until a real job exposes the requirement.

### Prerequisite

Before implementation, resolve one authoritative committed CI configuration source
with
[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md).

This task must not introduce a second writable source for Nixpkgs revisions, tool
versions, or job definitions. Native Windows setup, workflow generation, dependency
updating, and Nix generation must consume the same source.

The exact file format and location are intentionally deferred.

### Design rules

- use one exact official Nixpkgs commit;
- define each job's supported systems and explicit packages declaratively;
- generate one self-contained `flake.nix` per job;
- keep generated files static and free of job-selection logic, unrelated platform
  branches, and shared generated modules;
- split materially different package or platform requirements into separate jobs;
- keep job commands in GitHub Actions;
- preserve existing commands and coverage during migration;
- remove stale generated outputs;
- install Nix through a pinned CI action before use;
- ensure Nix does not modify the checkout;
- keep Windows on its native path using the same authoritative versions;
- defer overlays, custom derivations, caches, OCI outputs, and other extensions.

### Phase 1: simple Node jobs

Add three declarative environments to the shared CI source:

```text
node22 -> Node 22
node24 -> Node 24
node26 -> Node 26
```

Generate:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

Each file should be understandable without reading the generator. It contains only
the exact Nixpkgs source, supported systems, and packages required by that job.

The Node 22 job also performs a global FunctionalScript install. Its Nix environment
must provide a writable npm global location and make the installed `fjs` executable
resolvable. Choose the simplest working representation during the Node 22
experiment; do not design a general shell-setup schema unless another job proves it
is needed.

### Phase 2: validate and adopt

Every migrated path follows this shape:

```text
checkout
install Nix through a pinned action
enter the job's generated environment
run the job's unchanged commands
```

For each Node job:

1. build the environment on its declared systems;
2. verify the selected Node version;
3. run the current job commands unchanged;
4. verify Nix did not create or modify checkout files;
5. for Node 22, verify the global install makes `fjs` executable;
6. compare with the current setup path;
7. switch only after equivalent behavior is demonstrated.

The first implementation should choose the simplest checkout-cleanliness approach.
Committed lock files, `--no-write-lock-file`, and other alternatives remain open
until tested.

### Snapshot updates

Add an explicit Nix-capable command, for example:

```sh
npm run ci-nix-update
```

It resolves the stable Nixpkgs reference, validates every currently declared job,
updates the accepted commit and synchronized versions in the shared CI source, and
regenerates the flakes.

The candidate snapshot is accepted as one unit for the currently declared jobs.
Detailed transaction and rollback mechanics are deferred to implementation.

Ordinary generation remains:

```sh
npm run ci-update
```

It only reads committed configuration, requires no Nix or moving-reference lookup,
and remains runnable on native Windows.

### Later jobs

Add Deno, Bun, and other straightforward jobs with the same model.

For Rust, Playwright, and other complex jobs, first create a focused experimental
flake for the real job. Add the declarative environment only after the existing
commands pass and the concrete official-Nixpkgs package composition is known.

Record newly discovered problems as focused TODOs rather than expanding this plan
with speculative schemas.

### Tasks

#### Initial implementation

- [ ] Resolve the shared authoritative CI source with the internal-updater task.
- [ ] Add the accepted Nixpkgs reference and commit to that source.
- [ ] Add minimal Node 22, Node 24, and Node 26 job definitions.
- [ ] Generate one readable self-contained flake per Node job.
- [ ] Remove stale generated job directories.
- [ ] Prove the Node 22 writable global install with the simplest working approach.
- [ ] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [ ] Add the explicit Nix snapshot-update command.

#### Validation and adoption

- [ ] Add checkout and pinned Nix bootstrap before every Nix invocation.
- [ ] Build each Node environment on its declared systems.
- [ ] Run each job's existing commands unchanged.
- [ ] Verify Nix leaves the checkout unchanged.
- [ ] Migrate jobs one at a time after equivalent behavior is proven.

#### Discovered environments

- [ ] Add simple jobs incrementally.
- [ ] Experiment with complex jobs before declaring their package composition.
- [ ] Create focused TODOs for issues discovered during those experiments.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and declarative job model.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI experiment.
- [playwright-package-version-sync](playwright-package-version-sync.md) — Playwright
  version coordination.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — authoritative CI source and dependency updating.