## 66B-dockerfile-nix-integration. Generate simple Node CI flakes

**Priority:** P3
**Status:** wip

### Progress

Phase 2 is done: `fjs/ci/nix/module.f.ts` generates
`nix/generated/node{22,24,26}/flake.nix` from the pinned Nixpkgs commit in
`fjs/ci/config/module.f.ts`, and `npm run ci-update` regenerates them without
running Nix. `nodejs_22`, `nodejs_24`, and `nodejs_26` were verified to exist in
the accepted snapshot.

A temporary `nix-flakes` job instantiates every generated flake and compares the
Node it provides to the expected version, so the generated files are checked on
every pull request. It is not part of the migration: the canonical Node jobs
keep their `setup-node` runtime, and the temporary job is deleted once they all
run through `nix develop`.

The Node versions in `fjs/ci/config/module.f.ts` are now the ones the pinned
snapshot provides, shared by `setup-node` and the flakes' package attributes.
The expectation is stated once, in the `nix-flakes` job — the flakes themselves
carry no `assert`, because a flake pinning an exact commit already determines its
package versions, so an in-flake assertion would restate the pin while making a
generated, immutable file harder to read.

**When the temporary job is deleted, each migrated job must check its own Node
version inside the `nix develop` invocation** (already listed under phase 3), or
nothing ties the Nix runtime to the version the Windows and macOS jobs install.

Still open: the `npm run ci-nix-update` command (phase 1's automation — the
versions were read from the snapshot by hand), removal of stale generated job
directories, and the rest of phase 3 (migrating the jobs themselves).
Stale-directory removal needs a recursive `rm` effect — today's `rm` operation
only deletes files.

### Problem

The Node 22, Node 24, and Node 26 CI jobs currently depend on workflow-specific runtime
setup. We need the smallest useful direct-Nix implementation without coupling it to the
generic dependency updater, Playwright, Rust, Deno, Bun, OCI, or a future CI
configuration migration.

The implementation must preserve each job's existing runtime and command sequence while
keeping generated Nix files static and readable.

### Proposal

Implement this path for the three Node jobs:

```text
existing CI config -> generated Node flake.nix -> existing Node job commands
```

#### Design rules

- use one exact official Nixpkgs commit;
- keep the configuration in `fjs/ci/config/module.f.ts` for this milestone;
- generate one self-contained `flake.nix` per Node job;
- expose one static default development shell for each configured system;
- keep generated files static and readable;
- do not add job-selection conditions, helper libraries, or shared generated Nix modules;
- keep commands in GitHub Actions;
- run each migrated job's complete command sequence inside one `nix develop --command`
  invocation;
- preserve each job's current commands, order, and coverage;
- keep `npm run ci-update` Nix-independent and runnable on Windows;
- ignore per-job lock files created beside generated flakes;
- defer generalized shell, cache, and package-provider abstractions until a real
  requirement appears.

#### Phase 1: pin Nixpkgs

Add the stable Nixpkgs reference and exact accepted commit to the current CI
configuration.

Add an explicit Nix-capable update command, for example:

```sh
npm run ci-nix-update
```

It should:

1. resolve the latest commit of the configured official stable Nixpkgs reference;
2. read the Node 22, Node 24, and Node 26 package versions from that commit;
3. verify that the snapshot exposes `nodejs_22`, `nodejs_24`, and `nodejs_26`;
4. update the commit and relevant exact versions in
   `fjs/ci/config/module.f.ts`;
5. invoke `npm run ci-update` to regenerate files.

It does not update npm dependencies or package-manager lockfiles.

#### Phase 2: generate Node flakes

Generate:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

The current Node jobs run on the ARM Linux runner, so each generated file exposes this
public output:

```text
devShells.aarch64-linux.default
```

The package mapping is explicit:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

Each generated file follows this static shape, with the job's package substituted:

```nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/<commit>";

  outputs = { nixpkgs, ... }: {
    devShells.aarch64-linux.default =
      let
        pkgs = import nixpkgs { system = "aarch64-linux"; };
      in
      pkgs.mkShell {
        packages = [ pkgs.nodejs_22 ];
      };
  };
}
```

Do not add loops, system-selection conditions, `flake-utils`, or shared imports. If a job
later supports another system, generate another explicit `devShells.<system>.default`
attribute in that job's file.

The generator owns the generated directory and removes stale job outputs.

Nix may create `flake.lock` beside a generated flake. Keep these files untracked with
this root `.gitignore` rule:

```gitignore
/nix/generated/**/flake.lock
```

The rule is limited to generated CI flakes. A future intentional root or hand-written
lock file remains visible to Git.

##### Node 22 global installation

The Node 22 flake adds this job-local field to its `pkgs.mkShell` expression:

```nix
shellHook = ''
  export NPM_CONFIG_PREFIX="$HOME/.npm-global"
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  mkdir -p "$NPM_CONFIG_PREFIX"
'';
```

This keeps `npm install -g functionalscript` writable and makes `fjs` available to the
remaining commands in the same Nix process. Do not introduce a generalized shell-setup
schema for this one requirement.

#### Phase 3: validate independently

Each migrated Node job has three workflow steps:

1. check out the repository;
2. install Nix through a pinned action;
3. run the job's complete existing command sequence in one invocation:

```sh
nix develop ./nix/generated/<job> --command bash -euo pipefail -c '<commands>'
```

Using one invocation makes the selected Node executable and the job-local `shellHook`
available to every command without exporting a profile or PATH across GitHub Actions
steps.

Preserve the current command sequences and order:

```text
node22:
  npm install -g functionalscript@0.38.0
  npm ci
  fjs t

node24:
  npm ci
  node --test

node26:
  npm ci
  npm run ci-update
  git add -A && git diff --cached --exit-code
  npx tsc
  npm run cov
  npm pack
```

The workflow generator should continue supplying current configured versions; the list
above records the existing command families and their order.

For each Node job:

1. verify the selected Node version inside the Nix invocation;
2. run the complete command sequence above;
3. verify there are no tracked or stageable checkout changes;
4. switch only that job after equivalent behavior is demonstrated.

Node 22, Node 24, and Node 26 can be generated, validated, and adopted independently.
A problem in one job does not block progress on the others unless it affects the shared
Nixpkgs commit itself.

#### Out of scope

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

- [x] Add the stable Nixpkgs reference and exact commit.
- [ ] Add `npm run ci-nix-update`.
- [x] Update Node versions from the accepted Nixpkgs snapshot (by hand for now;
      `ci-nix-update` automates it).
- [x] Verify the three required Node package attributes exist.
- [x] Generate separate Node 22, Node 24, and Node 26 flakes with
      `devShells.aarch64-linux.default`.
- [x] Add the Node 22 `$HOME/.npm-global` shell hook.
- [ ] Remove stale generated job directories.
- [x] Add `/nix/generated/**/flake.lock` to `.gitignore`.
- [x] Keep ordinary generation Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [ ] Add pinned Nix bootstrap to each migrated job (the pinned action is already
      used by the temporary `nix-flakes` job).
- [ ] Run each job's complete command sequence through one `nix develop --command`
      invocation.
- [ ] Validate the three Node jobs independently.
- [ ] Preserve each job's existing commands, order, and coverage.
- [ ] Keep tracked checkout state unchanged.
- [ ] Migrate jobs one at a time.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and task boundaries.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — the OCI image the generator now
  adds to a job's flake, once the Playwright job proved the direct-Nix path. It changed
  the shape of every generated flake: `pkgs` moved into the `outputs` function's `let`,
  so the shell and the image share it. The Node flakes are otherwise unchanged, and
  nothing about this milestone depends on the image.
