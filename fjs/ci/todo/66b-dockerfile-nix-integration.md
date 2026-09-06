## 66B-dockerfile-nix-integration. Generate simple Node CI flakes

**Priority:** P3
**Status:** wip

The `dockerfile` in this file's name is historical: the task generates flakes and no
Dockerfile is planned — see `65Z-ci-nix`. The name stays because other issues cite it.

### Progress

Phase 2 is done: `fjs/ci/nix/module.f.mjs` generates
`nix/node{22,24,26}/flake.nix` from the pinned Nixpkgs commit in
`fjs/ci/config/module.f.mjs`, and `npm run gen` regenerates them without
running Nix. `nodejs_22`, `nodejs_24`, and `nodejs_26` were verified to exist in
the accepted snapshot.

**Phase 3 is done: all three Node jobs are migrated.** Each is checkout, the
pinned Nix installer, its runtime check, and one `nix develop --command` step
per command — the same commands on the runtime the pinned snapshot provides
instead of the one `setup-node` installs. No canonical Node job installs a
runtime any more; `setup-node` is left to the platform matrix and to
`package-check`, which installs `node.default` to type-check the packed tarball.

Node 22 and Node 24 run the suite and nothing else, and differ only in the
version they name, so one builder emits both.

Node 26 orders itself differently, for a reason that is about the job rather
than about Nix: `npm run gen` and the drift check it feeds run last, after
`npm ci`, `tsc`, `npm run cov` and `npm pack`. The check compares the tree
against what the generator produces, so running it at the end makes it the last
word — every earlier step has finished writing. Nothing those steps leave is
tracked: `npm pack`'s tarball and the declarations its `prepack` emits are
ignored, and `--no-update-lock-file` means Nix leaves nothing at all. The drift
check is a plain step, since `git` is the runner's tool.

Deno, `wasm` and Bun have since migrated the same way, under [65Z](65z-ci-nix.md),
which named the first as one of its own follow-ups. All are out of this issue's scope —
it is the Node milestone — but the sentences below about how a migrated job is shaped
now describe every canonical job rather than three.

**No job exists to check the flakes.** The temporary `nix-flakes` job that
instantiated each generated file and compared the Node it provided to an
expected version is gone. Nix runs in CI only where a job's own commands run
through a flake, and each such job checks its own runtime as its first real
step, against the version the configuration records. What was a separate job is
a step of the job that cares.

That check is the one thing about a generated flake that only CI can establish:
`nix develop` has to resolve the pin, build the shell, and put a Node on
`PATH`. What can be established without Nix is checked off the generator's
output, by two proofs: `fjs/ci/proof.f.mjs` requires the written file to equal
the generator's text for that job and the job's package attribute to be the
`nodejs_<major>` matching the version `fjs/ci/config/module.f.mjs` records for
it, while `fjs/ci/nix/proof.f.mjs` pins that text character for character —
the accepted commit and the job's `devShells.<system>.default` included.

The flakes carry no `assert` of their own: a flake pinning an exact commit
already determines its package versions, so an in-flake assertion would restate
the pin while making a generated, immutable file harder to read.

The gap this issue recorded through the migrations is closed: every generated
flake is now evaluated by the job that uses it, so a package attribute the
snapshot does not actually carry fails CI rather than waiting for a migration
that has already happened.

Still open, and neither is about a job: the `npm run ci-nix-update` command
(phase 1's automation — every version, Deno's and Bun's included, was read from
the snapshot's package files by hand), and removal of stale generated job
directories, which needs a recursive `rm` effect since today's `rm` operation
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
- keep the configuration in `fjs/ci/config/module.f.mjs` for this milestone;
- generate one self-contained `flake.nix` per Node job;
- expose one static default development shell for each configured system;
- keep generated files static and readable;
- do not add job-selection conditions, helper libraries, or shared generated Nix modules;
- keep commands in GitHub Actions;
- run each migrated job's complete command sequence through its flake, one
  `nix develop --command` step per command;
- preserve each job's current commands, order, and coverage;
- keep `npm run gen` Nix-independent and runnable on Windows;
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
5. invoke `npm run gen` to regenerate files.

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

A `flake.lock` is committed beside every `flake.nix` — so a copy of `nix/` carries
a fully locked flake, resolving to the same inputs wherever it is evaluated — but
`gen` never writes one: it is refreshed by a maintainer running `npm run lock-update`
(real `nix flake lock`, one per generated directory) only when a pin moves. It pins
those inputs rather than vendoring them; what a build still has to fetch, and from
where, is for whoever needs one to establish. Every CI invocation still passes
`--no-update-lock-file`, so `nix develop` cannot resolve, let alone write over, a
lock that no longer matches its flake. The `.gitignore` rule that used to hide these
files is gone.

##### Shell hooks

One shell declares one, for one of its systems: the shared shell on
`x86_64-linux`, pointing `cargo` at a 32-bit linker. Node 22's kept
`npm install -g functionalscript` writable and put the installed `fjs` on
`PATH`, and went when that install did. The generator still emits a `shellHook`
where a system declares one, and `fjs/ci/nix/proof.f.mjs` holds that capability
to its shape; do not introduce a generalized shell-setup schema until a job
needs it.

#### Phase 3: validate independently

Each migrated Node job checks out the repository, installs Nix through a pinned action,
and then runs one step per command of its existing sequence:

```sh
./nix/<job>/run <command>
```

A CI step runs one command (root [`AGENTS.md`](../../../AGENTS.md) §7): a bundled
`bash -c` script collapses the job into a single red result naming the wrapper rather
than the command that failed. Re-entering the shell per step loses nothing — `nix
develop` would run a `shellHook` on every entry, and what such a hook puts on disk
persists across steps regardless — while each step names the flake, so none can fall back
to the runner's preinstalled Node.

A step names the flake only when it needs a tool the flake pins. Node 26's sequence is
the case that shows the difference: `npm run gen`, `tsc`, `npm run cov` and
`npm pack` run on the pinned Node, while `git add -A && git diff --cached --exit-code`
uses the runner's `git` and stays a plain step. It reads the workspace the Nix steps
wrote, which is the same workspace either way.

So no flake declares `git`, and it never matters whether `nix develop` leaves the
runner's `PATH` in place or replaces it with the shell's — a question no job has had to
answer, since the other commands are `npm` and `node`, both from the shell itself.

Preserve each job's command sequence. This is what the three jobs run, all migrated:

```text
node22 (flake):
  test "$(./nix/node22/run node --version)" = v<configured>
  ./nix/node22/run npm ci
  ./nix/node22/run node --test

node24 (flake) — the same, one builder emits both:
  test "$(./nix/node24/run node --version)" = v<configured>
  ./nix/node24/run npm ci
  ./nix/node24/run node --test

node26 (flake):
  test "$(./nix/node26/run node --version)" = v<configured>
  ./nix/node26/run npm ci
  ./nix/node26/run tsc
  ./nix/node26/run npm run cov
  ./nix/node26/run npm pack
  ./nix/node26/run npm run gen
  git add -A && git diff --cached --exit-code
```

Two orderings above are load-bearing rather than incidental. The runtime check precedes
`npm ci`, which runs lifecycle hooks that would otherwise execute on an unchecked
runtime; and Node 26's regeneration and drift check come last, so the comparison covers
every earlier step's output.

The workflow generator supplies the configured versions; the list records command
families and their order. Other TODOs may change a job's required tools or commands
independently. Node 22 lost its global install and `fjs test` outright: it carried them
only because it could not run `node --test`.

For each Node job:

1. run the complete command sequence above;
2. verify there are no tracked or stageable checkout changes;
3. switch only that job after equivalent behavior is demonstrated.

A migrated job checks its Node version like any other, as its first real step:
`test "$(./nix/<job>/run node --version)" = v<version>`. The
pin decides which Node the flake resolves to, and `fjs/ci/config/module.f.mjs`
only claims to know which — so the claim is checked where it can be, and the
migration changes a job's runtime without changing what CI guarantees about it.

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
- OCI output or caching (see `65Z-ci-nix`).

Create separate TODOs for those jobs when work begins. They do not block this Node
milestone. Neither Deno nor Bun ended up needing a lasting one: Deno was already listed
as a follow-up in [65Z](65z-ci-nix.md), and Bun's own issue was closed by the migration
it asked for. Both migrated once this milestone had settled the shape.

### Tasks

- [x] Add the stable Nixpkgs reference and exact commit.
- [ ] Add `npm run ci-nix-update`.
- [x] Update Node versions from the accepted Nixpkgs snapshot (by hand for now;
      `ci-nix-update` automates it).
- [x] Verify the three required Node package attributes exist.
- [x] Generate separate Node 22, Node 24, and Node 26 flakes with
      `devShells.aarch64-linux.default`.
- [ ] Remove stale generated job directories.
- [x] Generate and commit a `flake.lock` per flake, so `nix/` is self-contained.
- [x] Keep ordinary generation Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [x] Add pinned Nix bootstrap to each migrated job.
- [x] Run each job's complete command sequence through its flake, one
      `nix develop --command` step per command.
- [x] Validate the three Node jobs independently.
- [x] Preserve each job's existing commands, order, and coverage. Node 24's and
      Node 22's are unchanged; Node 26 keeps its commands with the drift check
      moved last, so it compares a tree every other step has finished writing.
- [x] Keep tracked checkout state unchanged.
- [x] Migrate jobs one at a time — Node 24, then Node 26, then Node 22.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — architecture and task boundaries.
