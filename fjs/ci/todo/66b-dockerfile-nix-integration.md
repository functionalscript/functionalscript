## 66B-dockerfile-nix-integration. Generate simple Node CI flakes

**Priority:** P3
**Status:** open

### Goal

Implement the smallest useful direct-Nix CI path:

```text
existing CI config -> generated Node flake.nix -> existing Node job commands
```

This task is independent of the generic dependency updater, Playwright, Rust, and OCI
work.

### Design rules

- use one exact official Nixpkgs commit;
- keep the configuration in `fjs/ci/config/module.f.ts` for this milestone;
- generate one self-contained `flake.nix` per Node job;
- keep generated files static and readable;
- do not add job-selection conditions or shared generated Nix modules;
- keep commands in GitHub Actions;
- preserve each job's current commands and coverage;
- keep `npm run ci-update` Nix-independent and runnable on Windows;
- ignore per-job lock files created beside generated flakes;
- defer generalized shell, cache, and package-provider abstractions until a real
  requirement appears.

### Phase 1: pin Nixpkgs

Add the stable Nixpkgs reference and exact accepted commit to the current CI
configuration.

Add an explicit Nix-capable update command, for example:

```sh
npm run ci-nix-update
```

It should:

1. resolve the latest commit of the configured official stable Nixpkgs reference;
2. read the Node 22, Node 24, and Node 26 package versions from that commit;
3. update the commit and relevant exact versions in
   `fjs/ci/config/module.f.ts`;
4. invoke `npm run ci-update` to regenerate files.

It does not update npm dependencies or package-manager lockfiles.

### Phase 2: generate Node flakes

Generate:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

Each file contains only:

- the exact Nixpkgs source;
- the systems supported by that job;
- the selected Node package;
- any small job-local shell setup proven necessary by the real job.

The generator owns the generated directory and removes stale job outputs.

Nix may create `flake.lock` beside a generated flake. Keep these files untracked with
this root `.gitignore` rule:

```gitignore
/nix/generated/**/flake.lock
```

The rule is limited to generated CI flakes. A future intentional root or hand-written
lock file remains visible to Git.

For Node 22, preserve the existing global FunctionalScript installation. Find the
simplest writable npm location and effective `PATH` during implementation. Do not
introduce a general shell-setup schema unless another job demonstrates a need for it.

### Phase 3: validate independently

For each Node job:

1. check out the repository;
2. install Nix through a pinned action;
3. enter that job's generated environment;
4. verify the selected Node version;
5. run the existing job command sequence unchanged;
6. verify there are no tracked or stageable checkout changes;
7. switch only that job after equivalent behavior is demonstrated.

Node 22, Node 24, and Node 26 can be generated, validated, and adopted independently.
A problem in one job does not block progress on the others unless it affects the shared
Nixpkgs commit itself.

### Out of scope

Do not solve these in this task:

- replacing `npm-check-updates`;
- moving CI configuration to `ci-lock.json` or another format;
- Playwright package/browser synchronization;
- Rust components, targets, or linkers;
- Deno or Bun flakes;
- OCI output or caching.

Create separate TODOs for those jobs when work begins. They do not block this Node
milestone.

### Tasks

- [ ] Add the stable Nixpkgs reference and exact commit.
- [ ] Add `npm run ci-nix-update`.
- [ ] Update Node versions from the accepted Nixpkgs snapshot.
- [ ] Generate separate Node 22, Node 24, and Node 26 flakes.
- [ ] Remove stale generated job directories.
- [ ] Add `/nix/generated/**/flake.lock` to `.gitignore`.
- [ ] Keep ordinary generation Nix-independent and Windows-compatible.
- [ ] Commit the generated flakes.
- [ ] Add pinned Nix bootstrap to each migrated job.
- [ ] Validate the three Node jobs independently.
- [ ] Preserve each job's existing commands and coverage.
- [ ] Keep tracked checkout state unchanged.
- [ ] Migrate jobs one at a time.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and task boundaries.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI experiment after one
  direct-Nix Linux job works.
