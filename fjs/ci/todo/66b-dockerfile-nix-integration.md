## 66B-dockerfile-nix-integration. Generate simple Node CI flakes

**Priority:** P3
**Status:** wip

### Progress

Phase 2 is done: `fjs/ci/nix/module.f.mjs` generates
`nix/node{22,24,26}/flake.nix` from the pinned Nixpkgs commit in
`fjs/ci/config/module.f.mjs`, and `npm run ci-update` regenerates them without
running Nix. `nodejs_22`, `nodejs_24`, and `nodejs_26` were verified to exist in
the accepted snapshot.

Phase 3 has started: **Node 24 is migrated.** Its job is checkout, the pinned
Nix installer, and one `nix develop --command` step each for `npm ci` and
`node --test` — the same commands in the same order, on the runtime the pinned
snapshot provides instead of the one `setup-node` installs.

**CI does not check the flakes; it uses them.** The temporary `nix-flakes` job
that instantiated each generated file and compared the Node it provided to an
expected version is gone, and no job replaces it. Nix runs in CI only where a
job's own commands run through a flake.

What is checkable about a generated file is checked in `fjs/ci/proof.f.mjs`,
off the generator's output: each job's flake carries the accepted commit, the
job's `devShells.<system>.default`, and the `nodejs_<major>` matching the
version `fjs/ci/config/module.f.mjs` records for that job. A proof cannot
evaluate a flake or reach Nixpkgs, so it cannot say the shell builds or which
Node it yields — the pin decides that, and a migrated job running its real
commands is what exercises it.

The flakes carry no `assert` of their own either: a flake pinning an exact
commit already determines its package versions, so an in-flake assertion would
restate the pin while making a generated, immutable file harder to read.

The cost is stated rather than hidden. Nothing evaluates the Node 22 and Node
26 flakes until those jobs migrate, so a package attribute the snapshot does not
actually carry would surface at migration time rather than now; and nothing
compares a recorded version against the snapshot, which is what the Nixpkgs
update command has to own.

Still open: the `npm run ci-nix-update` command (phase 1's automation — the
versions were read from the snapshot by hand), removal of stale generated job
directories, and the two remaining jobs. Stale-directory removal needs a
recursive `rm` effect — today's `rm` operation only deletes files. Node 22 and
Node 26 are not repeats of Node 24: Node 22 is the first job to depend on a
`shellHook`, and Node 26 is the one that regenerates the tracked files and fails
on drift.

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
- keep the configuration in `fjs/ci/config/module.f.mjs` for this milestone;
- generate one self-contained `flake.nix` per Node job;
- expose one static default development shell for each configured system;
- keep generated files static and readable;
- do not add job-selection conditions, helper libraries, or shared generated Nix modules;
- keep commands in GitHub Actions;
- run each migrated job's complete command sequence through its flake, one
  `nix develop --command` step per command;
- preserve each job's current commands, order, and coverage;
- keep `npm run ci-update` Nix-independent and runnable on Windows;
- ignore per-job lock files created beside generated flakes;
- let a job add tools required by its own work without changing the Node runtime mapping;
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
   `fjs/ci/config/module.f.mjs`;
5. invoke `npm run ci-update` to regenerate files.

It does not update npm dependencies or package-manager lockfiles.

#### Phase 2: generate Node flakes

Generate:

```text
nix/node22/flake.nix
nix/node24/flake.nix
nix/node26/flake.nix
```

The current Node jobs run on the ARM Linux runner, so each generated file exposes this
public output:

```text
devShells.aarch64-linux.default
```

The Node runtime mapping is explicit:

```text
node22 -> pkgs.nodejs_22
node24 -> pkgs.nodejs_24
node26 -> pkgs.nodejs_26
```

That mapping defines the runtime, not the complete shell. A job may add explicit tools
required by its own work; their owning TODO defines those requirements.

Each generated file follows this static shape, with the job's declared packages
substituted:

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

The generator owns the job subdirectories of `nix/` and removes stale job outputs. It
does not own `nix/` itself: `nix/README.md` is written by hand, so stale-output removal
deletes directories it generated rather than everything it finds there.

Nix may create `flake.lock` beside a generated flake. Keep these files untracked with
this root `.gitignore` rule:

```gitignore
/nix/*/flake.lock
```

The rule matches one level down, so it is limited to the generated per-job flakes. A
future intentional `nix/flake.lock` remains visible to Git.

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

Each migrated Node job checks out the repository, installs Nix through a pinned action,
and then runs one step per command of its existing sequence:

```sh
nix develop ./nix/<job> --command <command>
```

A CI step runs one command (root [`AGENTS.md`](../../../AGENTS.md) §7): a bundled
`bash -c` script collapses the job into a single red result naming the wrapper rather
than the command that failed. Re-entering the shell per step loses nothing — `nix
develop` runs the `shellHook` on every entry, and what a hook puts on disk persists
across steps regardless — while each step names the flake, so none can fall back to the
runner's preinstalled Node.

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
above records the existing command families and their order. Other TODOs may change a
job's required tools or commands independently.

For each Node job:

1. run the complete command sequence above;
2. verify there are no tracked or stageable checkout changes;
3. switch only that job after equivalent behavior is demonstrated.

A migrated job states no expected Node version: the flake pins an exact commit,
which already determines the version, so the job would only be restating the
pin. Nothing then checks that job's recorded version in
`fjs/ci/config/module.f.mjs` against the snapshot — see the progress note above.

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
- [x] Add `/nix/*/flake.lock` to `.gitignore`.
- [x] Keep ordinary generation Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [ ] Add pinned Nix bootstrap to each migrated job — Node 24 done.
- [ ] Run each job's complete command sequence through its flake, one
      `nix develop --command` step per command — Node 24 done.
- [ ] Validate the three Node jobs independently — Node 24 done.
- [ ] Preserve each job's existing commands, order, and coverage — Node 24's are
      unchanged.
- [ ] Keep tracked checkout state unchanged.
- [ ] Migrate jobs one at a time — Node 24 went alone; Node 22 and Node 26 remain.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and task boundaries.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — later OCI design work after one
  direct-Nix Linux job works.
