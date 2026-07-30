## 66B-dockerfile-nix-integration. Generate simple per-job Nix flakes

**Priority:** P3
**Status:** open

### Goal

Prove the Nix CI path with the smallest useful implementation:

```text
declarative job definition -> generated flake.nix -> existing CI commands
```

Do not design every toolchain detail before trying the real jobs. Begin with easy
environments, keep the generated Nix readable, and add complexity only when a
working experiment requires it.

### Design rules

- use one pinned official stable Nixpkgs commit;
- define each CI job's systems, packages, and static shell environment
  declaratively;
- generate one self-contained `flake.nix` per job;
- generate a static package list with no job-selection conditions;
- split materially different systems or package sets into separate jobs/flakes;
- keep workflow commands in the workflow rather than embedding them in Nix;
- preserve the current commands and coverage while migrating;
- keep Windows on its native exact-version path;
- avoid overlays, custom derivations, shared generated Nix modules, OCI outputs,
  and other extensions in the first implementation.

### Phase 1: generate simple Node flakes

Add the pinned Nixpkgs source and a small declarative job map to
`fjs/ci/config/module.f.ts`.

For example:

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

Generate:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

Each generated file should be understandable without reading the generator. It
contains the exact Nixpkgs commit, the supported systems, the job's explicit
package list, and any static environment settings. It does not choose among Node
versions or inspect a job name.

The Node 22 job runs `npm install -g functionalscript@<version>`. Its generated
shell must therefore expose a writable npm global prefix and prepend that prefix's
`bin` directory to `PATH`. This is ordinary declarative job data, not custom Nix
logic.

The generator owns `nix/generated/` and removes directories that are no longer
declared.

Do not generate `flake.lock` initially; reference the immutable Nixpkgs commit
directly. Every `nix develop`, `nix build`, or other CI/validation invocation of a
generated flake must use `--no-write-lock-file`.

### Phase 2: validate and use the Node flakes

For each generated flake:

1. build it on every declared system with `--no-write-lock-file`;
2. verify the selected executable version;
3. run the corresponding job's existing commands;
4. compare the result with the current setup action;
5. switch the job only after equivalent behavior is demonstrated.

The Node 22, 24, and 26 jobs remain separate because they select different Node
versions and run different command sequences.

The Node 26 drift check must run with a clean checkout. The Nix invocation must not
create `flake.lock` or any other repository file before
`git add -A && git diff --cached --exit-code` executes.

### Phase 3: add jobs incrementally

Add Deno, Bun, and other straightforward environments using the same declarative
shape.

For a complex job such as Rust or Playwright, first write a small experimental
flake for that exact job. Use the experiment to discover the concrete
official-Nixpkgs package/provider list and any required environment variables.
Only then add the job record and generate its final simple flake.

Do not add a Rust job using only target triples. It joins the generated set after
the experiment identifies concrete providers for every command the job currently
runs, including its format, Clippy, native, i686, and WASM coverage.

Playwright joins after
[playwright-package-version-sync](playwright-package-version-sync.md) establishes a
compatible local package and browser bundle.

### Snapshot updates

Add:

```sh
npm run ci-nix-update
```

At a high level it resolves the configured stable ref, checks the currently
declared jobs, records the accepted commit and versions, and regenerates the
flakes. Detailed rollback, temporary-file, and provider-discovery mechanics should
be chosen during implementation rather than specified here.

Ordinary generation remains:

```sh
npm run ci-update
```

It reads committed configuration, requires no Nix or moving-ref lookup, and remains
runnable on native Windows.

### Dependency updater boundary

Do not make this task responsible for replacing general dependency updates.
The separate
[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
TODO must preserve updates for all ordinary dependencies, including TypeScript and
`@types/node`.

This task only depends on that updater respecting exact versions coupled to CI
jobs, especially Playwright.

### Later work

After direct Nix CI works, separately consider:

- committed lock files;
- custom package definitions or overlays;
- binary caches;
- OCI images and publication;
- combining environments for performance.

These extensions must not complicate the first per-job flakes.

### Tasks

#### Initial implementation

- [ ] Add the stable Nixpkgs ref and exact accepted commit.
- [ ] Add a declarative map from CI job to systems, explicit packages, and static
      environment settings.
- [ ] Generate separate static flakes for Node 22, 24, and 26.
- [ ] Configure a writable npm global prefix and PATH for Node 22.
- [ ] Keep each generated flake self-contained and readable.
- [ ] Remove stale generated job directories.
- [ ] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [ ] Add `npm run ci-nix-update` for deliberate snapshot changes.
- [ ] Require `--no-write-lock-file` for every generated-flake invocation.

#### Validation and adoption

- [ ] Build every generated Node flake on its declared systems without writing a
      lock file.
- [ ] Run each Node job's unchanged commands in its matching flake.
- [ ] Verify the Node 26 drift check runs before Nix creates any checkout files.
- [ ] Move jobs to Nix one at a time after equivalent behavior is proven.
- [ ] Add simple Deno/Bun jobs using the same pattern.

#### Discovered complex environments

- [ ] Experiment with the real Rust jobs and record concrete Nixpkgs providers only
      after they work.
- [ ] Add Rust job records and flakes after their package composition is known.
- [ ] Add Playwright only after package/browser synchronization is solved.
- [ ] Record newly discovered issues as focused TODOs instead of expanding this
      proposal with speculative implementation details.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and declarative job model.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI experiment.
- [playwright-package-version-sync](playwright-package-version-sync.md) — Playwright
  version coordination.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — general dependency updates.
