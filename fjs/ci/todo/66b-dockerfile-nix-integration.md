## 66B-dockerfile-nix-integration. Generate simple per-job Nix flakes

**Priority:** P3
**Status:** open

### Goal

Prove the Nix CI path with the smallest useful implementation:

```text
declarative job definition -> generated flake.nix -> existing CI commands
```

Begin with simple jobs. Keep generated Nix readable and add complexity only when a
working experiment requires it.

### Design rules

- use one pinned official stable Nixpkgs commit;
- define each CI job's systems, packages, literal environment values, and small
  structured shell setup declaratively;
- generate one self-contained `flake.nix` per job;
- generate static package and shell setup with no job-selection conditions;
- represent materially different package or platform requirements as separate
  jobs/flakes;
- expand runtime-dependent values in readable shell startup code rather than plain
  environment attributes;
- keep workflow commands in GitHub Actions;
- preserve current commands and coverage during migration;
- check out the repository and install Nix through a pinned action before any Nix
  command runs;
- keep Windows on its native exact-version path;
- defer overlays, custom derivations, shared generated modules, OCI outputs, and
  other extensions.

### Phase 1: simple Node flakes

Add the pinned Nixpkgs source and a small declarative job map to
`fjs/ci/config/module.f.ts`.

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
            shell: {
                npmGlobalPrefix: 'npm-global',
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

Each file contains the exact Nixpkgs commit, supported systems, explicit packages,
and straightforward shell setup. It does not inspect the job name or choose between
package variants.

The Node 22 shell needs a writable npm global prefix because its existing job runs
`npm install -g` before invoking `fjs`. The generated flake should expand the
structured `npmGlobalPrefix` setting at shell startup with readable code equivalent
to:

```sh
export NPM_CONFIG_PREFIX="$TMPDIR/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
```

Do not render these expressions as ordinary environment attributes: nested shell
references in those values would remain literal instead of expanding recursively.

The generator owns `nix/generated/` and removes outputs that are no longer declared.

Do not generate `flake.lock` initially. Every generated-flake invocation uses
`--no-write-lock-file`.

### Phase 2: bootstrap, validate, and adopt

Every validation or migrated workflow path has the same simple shape:

```text
checkout
install Nix through a pinned action
invoke the job's generated flake with --no-write-lock-file
run the job's unchanged commands
```

For each Node flake:

1. build it on every declared system;
2. verify the selected Node version;
3. run the corresponding job's existing commands;
4. for Node 22, verify the global install makes `fjs` resolvable on the effective
   `PATH`;
5. compare with the current setup path;
6. switch the job only after equivalent behavior is demonstrated.

Node 22, 24, and 26 remain separate because they select different Node versions and
run different command sequences.

The Node 26 path must not create `flake.lock` or any other checkout file before its
existing drift check runs.

### Phase 3: add jobs incrementally

Add Deno, Bun, and other straightforward jobs using the same declarative shape.

For complex jobs such as Rust or Playwright, first create a small experimental flake
for the real job. Use the experiment to discover the concrete official-Nixpkgs
packages/providers and environment settings. Add the declarative job only after the
existing commands pass.

Do not add Rust using target triples without concrete providers. Playwright joins
after [playwright-package-version-sync](playwright-package-version-sync.md) is
complete and a compatible package/browser composition is proven.

### Snapshot updates

Add:

```sh
npm run ci-nix-update
```

At a high level it resolves the configured stable ref, checks currently declared
jobs, records the accepted commit and versions, and regenerates the flakes.
Implementation mechanics should be decided while building it.

Ordinary generation remains:

```sh
npm run ci-update
```

It reads committed configuration, requires no Nix or moving-ref lookup, and remains
runnable on native Windows.

### Dependency updater boundary

General dependency updates remain owned by
[replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md).
This task only requires that dependencies coupled to CI environments, especially
Playwright, do not drift independently.

### Tasks

#### Initial implementation

- [ ] Add the stable Nixpkgs ref and exact accepted commit.
- [ ] Add a declarative map from job to systems, packages, literal environment, and
      structured shell setup.
- [ ] Generate separate readable flakes for Node 22, 24, and 26.
- [ ] Configure a writable npm global prefix for Node 22.
- [ ] Expand the Node 22 prefix and PATH in generated shell startup code rather than
      plain environment attributes.
- [ ] Remove stale generated job directories.
- [ ] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [ ] Add `npm run ci-nix-update` for deliberate snapshot changes.
- [ ] Require `--no-write-lock-file` for every generated-flake invocation.

#### Validation and adoption

- [ ] Add checkout and a pinned Nix installation before every Nix invocation.
- [ ] Build each generated Node flake on its declared systems.
- [ ] Run each Node job's unchanged commands in its matching flake.
- [ ] Verify the Node 22 global `fjs` executable is on the effective PATH.
- [ ] Keep the Node 26 checkout clean for its drift check.
- [ ] Move jobs to Nix one at a time after equivalent behavior is proven.
- [ ] Add simple Deno/Bun jobs using the same pattern.

#### Discovered complex environments

- [ ] Experiment with real Rust jobs and record concrete providers only after they
      work.
- [ ] Add Rust jobs after their package composition is known.
- [ ] Add Playwright after package/browser synchronization is solved.
- [ ] Record newly discovered issues as focused TODOs rather than expanding this
      proposal with speculative details.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and declarative job model.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI experiment.
- [playwright-package-version-sync](playwright-package-version-sync.md) — Playwright
  version coordination.
- [replace-npm-check-updates-with-an-internal-script](replace-npm-check-updates-with-an-internal-script.md)
  — general dependency updates.