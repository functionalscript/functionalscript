## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** open

### Goal

Use one pinned official Nixpkgs snapshot to generate small, readable CI
environments.

The first implementation should prove the path with simple jobs. Details that are
not yet proven should be discovered by running the real job, then recorded in a
focused follow-up task.

### Architectural contract

- use packages provided by an official Nixpkgs snapshot;
- keep a stable update reference and pin each accepted snapshot to an exact Git
  commit;
- keep one authoritative committed CI configuration source;
- make Windows/native setup, workflow generation, dependency updating, and Nix
  generation read that same source;
- do not maintain duplicate writable version or job-configuration sources;
- generate one self-contained `flake.nix` per CI job;
- keep each generated flake static, readable, and free of job-selection logic,
  unrelated platform conditions, and shared generated imports;
- represent meaningful package or platform differences as separate job/flake
  definitions;
- keep the job commands in GitHub Actions and preserve them during migration;
- remove stale generated outputs when a job is renamed or removed;
- keep `npm run ci-update` independent of Nix and runnable on native Windows;
- install Nix through a pinned CI action before invoking a generated flake;
- ensure Nix invocation does not modify the repository checkout;
- defer overlays, custom derivations, caches, OCI images, and other extensions until
  a concrete requirement appears.

### Shared configuration source

The exact representation and path of the authoritative CI configuration are not
part of this proposal. It may be a TypeScript module, a JSON lock file, or another
simple committed format.

[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
must settle that choice before this task is implemented. The chosen source must
hold the accepted Nixpkgs reference and commit, exact cross-platform versions, and
the declarative per-job environment definitions needed by the generators.

The important rule is:

```text
one committed CI source -> native/workflow/Nix generators
```

### Generated job environments

A job definition describes the systems and packages needed by one existing CI job.
The generator emits one corresponding flake:

```text
CI job -> systems + explicit packages -> one flake.nix
```

Start with separate Node 22, Node 24, and Node 26 environments. They must remain
separate because they select different Node versions and run different command
sequences.

The Node 22 environment must preserve its existing global FunctionalScript install.
It therefore needs a writable npm global location and an effective `PATH` containing
the installed executable. The exact Nix/shell representation should be chosen by a
small working experiment rather than standardized in advance.

### Nixpkgs updates

Add an explicit Nix-capable command, for example:

```sh
npm run ci-nix-update
```

At a high level it:

1. resolves the configured stable reference to an exact candidate commit;
2. checks all currently declared job environments against that snapshot;
3. records the accepted commit and synchronized cross-platform versions in the
   shared CI source;
4. regenerates the declared flakes;
5. leaves the changes for normal review.

Because the declared jobs share one accepted Nixpkgs revision, a candidate is
accepted only when all currently declared environments validate. Detailed rollback,
temporary-file, and evaluation mechanics are implementation choices.

Ordinary generation remains:

```sh
npm run ci-update
```

It only renders committed configuration and does not resolve a moving Nixpkgs
reference.

### Validation and adoption

Migrate one job at a time:

1. generate and commit its flake;
2. check out the repository and install pinned Nix in CI;
3. run the job through the flake without creating or changing repository files;
4. run the job's existing command sequence unchanged;
5. compare with the current setup path;
6. remove the old setup only after equivalent behavior is demonstrated.

Whether checkout cleanliness is achieved with committed lock files,
`--no-write-lock-file`, or another simple mechanism should be decided by the first
working implementation.

### Complex jobs

Do not guess detailed schemas for Rust targets, linkers, Playwright browsers, or
other complicated environments.

For each complex job:

1. create a small experimental flake for the real job;
2. identify the concrete official-Nixpkgs packages and environment requirements;
3. record only the proven declarative data;
4. generate the final readable flake;
5. migrate only after the existing commands pass.

Rust remains outside the initial declared set until its native, i686, rustfmt,
Clippy, and WASM commands work. Playwright remains outside until
[playwright-package-version-sync](playwright-package-version-sync.md) establishes a
compatible local package and browser bundle.

### Tasks

- [ ] Resolve one authoritative CI configuration source with the internal-updater
      task.
- [ ] Add the stable Nixpkgs reference and exact accepted commit to that source.
- [ ] Define a minimal declarative job-to-systems-and-packages model.
- [ ] Generate separate readable flakes for Node 22, Node 24, and Node 26.
- [ ] Prove a writable Node 22 global install and effective `PATH` without designing a
      general shell-setup framework prematurely.
- [ ] Remove stale generated job directories.
- [ ] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [ ] Add the explicit Nix snapshot-update command.
- [ ] Bootstrap Nix through a pinned CI action.
- [ ] Keep Nix invocations from modifying the checkout.
- [ ] Preserve every migrated job's existing commands and coverage.
- [ ] Add simple jobs incrementally.
- [ ] Add complex jobs only after focused experiments identify their concrete
      package composition.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — first
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — optional OCI work after a
  direct-Nix job works.
- [playwright-package-version-sync](playwright-package-version-sync.md) — Playwright
  version coordination.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — choose the shared CI source and update dependencies without
  `npm-check-updates`.