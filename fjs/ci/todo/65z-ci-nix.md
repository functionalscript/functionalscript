## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** open

### Goal

Use one pinned official stable Nixpkgs snapshot to generate readable Nix
environments for CI.

The first implementation should prove the basic path rather than design every
package and platform detail in advance. We expect to discover additional
requirements while converting real jobs.

### Principles

- use only packages already provided by the selected official Nixpkgs snapshot;
- pin the snapshot to an exact Git commit;
- describe CI environments declaratively;
- generate one small, self-contained `flake.nix` per CI job;
- keep generated flakes free of job-selection logic, conditions, and shared
  generated imports;
- represent meaningful platform differences as separate job/flake definitions
  instead of conditional Nix code;
- allow each job definition to declare static environment variables and PATH
  additions required by its existing commands;
- keep the generated files readable enough to review directly;
- add jobs incrementally, beginning with the simplest environments;
- keep Windows on native installers using synchronized exact version strings;
- defer overlays, custom derivations, OCI images, and other optimizations until a
  concrete need appears.

### Nixpkgs source

Maintain:

- a stable update ref, initially `nixos-26.05`;
- the exact accepted Nixpkgs Git commit.

The stable ref is only an update policy. Generated files and CI must use the exact
commit.

```ts
export const nix = {
    nixpkgs: {
        ref: 'nixos-26.05',
        rev: '<exact-github-commit>',
    },
} as const
```

### Declarative job environments

The maintained configuration should say which packages, systems, and static shell
environment belong to each CI job. The generator should not hardcode relationships
between package names, workflow jobs, and generated directories.

Start with simple jobs whose package composition is already clear:

```ts
export const nix = {
    nixpkgs: {
        ref: 'nixos-26.05',
        rev: '<exact-github-commit>',
    },
    jobs: {
        node22: {
            systems: ['x86_64-linux', 'aarch64-linux'],
            packages: ['nodejs_22'],
            environment: {
                NPM_CONFIG_PREFIX: '$TMPDIR/npm-global',
                PATH: '$NPM_CONFIG_PREFIX/bin:$PATH',
            },
        },
        node24: {
            systems: ['x86_64-linux', 'aarch64-linux'],
            packages: ['nodejs_24'],
        },
        node26: {
            systems: ['x86_64-linux', 'aarch64-linux'],
            packages: ['nodejs_26'],
        },
    },
} as const
```

The exact schema may evolve during implementation. The important contract is:

```text
job name -> supported systems + explicit packages/environment -> one flake
```

A generated flake should contain a static package list and static environment
settings. It should not inspect the job name, choose between Node versions, or
contain branches for unrelated platforms.

For example:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

Each Node flake exposes only its selected Node version. The existing workflow
commands remain in the workflow; the flake only defines the environment.

The Node 22 environment must provide a writable npm global prefix because its
existing job runs `npm install -g` before invoking `fjs`. The prefix and its `bin`
directory are declared as ordinary static environment data, not as special-case
logic in the generated Nix.

### Complex jobs

Do not guess detailed schemas for Rust targets, linkers, Playwright browsers, or
other complicated environments before trying them.

Instead:

1. build a small hand-verified flake for the real CI job;
2. identify the exact official-Nixpkgs packages/providers needed by that job;
3. record that concrete package composition declaratively;
4. generate the same simple flake;
5. migrate the job only after its existing commands pass.

Rust is added only after an experiment identifies a direct, readable package set
that supports its current rustfmt, Clippy, native, i686, and WASM commands. A list
of Rust target triples without concrete Nixpkgs providers is not sufficient
configuration.

Playwright is added only after
[playwright-package-version-sync](playwright-package-version-sync.md) is complete
and the local package and browser bundle are known to be compatible.

### Versions

Keep exact version exports in `fjs/ci/config/module.f.ts` because Windows still
uses them. Scalar exports should preserve literal types with `as const`.

The Nixpkgs snapshot is the source of the versions available to Nix. The explicit
update command may copy accepted package versions into the cross-platform version
exports so Windows and Nix stay aligned.

### Commands

Add a deliberate Nix-capable update command:

```sh
npm run ci-nix-update
```

Its high-level responsibility is simple:

1. resolve the configured stable ref to an exact candidate commit;
2. check the currently declared jobs against that snapshot;
3. update the accepted commit and synchronized versions;
4. regenerate the declared flakes;
5. leave the changes for normal review.

Implementation details such as temporary files, rollback strategy, and provider
discovery should be decided while implementing the command.

Ordinary generation remains:

```sh
npm run ci-update
```

It renders committed configuration without requiring Nix or resolving a moving
ref, and must remain runnable on native Windows.

### Dependency updates

Removing `npm-check-updates` and updating dependencies outside CI configuration
belongs to
[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md).
That replacement must continue updating ordinary dependencies such as TypeScript
and `@types/node`.

This Nix task only requires that dependencies coupled to CI environments, such as
Playwright, are synchronized by the maintained updater rather than changed
independently.

### Generation and adoption

The generator owns `nix/generated/` and removes stale outputs that are no longer
declared.

Do not generate `flake.lock` in the first implementation. Each generated input can
reference the exact Nixpkgs commit directly. Every validation and CI invocation of
a generated flake must pass `--no-write-lock-file`, so evaluation cannot create an
untracked lock file or interfere with the repository drift check.

Convert jobs one at a time:

1. generate and commit the job's flake;
2. build it on the job's systems using `--no-write-lock-file`;
3. run the job's existing commands in that environment;
4. compare with the existing setup path;
5. remove the old setup only after equivalent behavior is demonstrated.

### Tasks

- [ ] Add the stable Nixpkgs ref and exact accepted commit.
- [ ] Define a small declarative job-environment schema.
- [ ] Allow static environment variables and PATH additions in job definitions.
- [ ] Generate one self-contained, static `flake.nix` per declared job.
- [ ] Start with separate Node 22, 24, and 26 jobs.
- [ ] Give Node 22 a writable npm global prefix and PATH entry.
- [ ] Keep generated Nix readable and free of job/platform selection branches.
- [ ] Keep `npm run ci-update` Nix-independent and runnable on native Windows.
- [ ] Add `npm run ci-nix-update` for deliberate snapshot updates.
- [ ] Remove stale generated job directories during regeneration.
- [ ] Invoke every lockless generated flake with `--no-write-lock-file`.
- [ ] Commit and validate generated flakes.
- [ ] Add complex jobs only after a working experiment identifies their concrete
      package/provider composition.
- [ ] Keep ordinary dependency updating covered by the separate internal-updater
      TODO.
- [ ] Migrate CI jobs incrementally without changing their existing commands.

### Related

- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — first
  implementation sequence.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — optional OCI work after
  direct Nix CI works.
- [playwright-package-version-sync](playwright-package-version-sync.md) — keep
  Playwright package and browser versions aligned.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — update ordinary and CI-managed dependencies without `npm-check-updates`.
