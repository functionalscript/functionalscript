## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** wip

### Progress

Flake generation is implemented and **every canonical job but `bun` is migrated** — the
three Node jobs, then `deno`. Each installs Nix through the pinned action and runs its
command sequence one `nix develop` step per command. Nix runs in CI only where a job uses
a flake — the temporary `nix-flakes` job that instantiated them to check them is gone,
and every generated flake is now evaluated by the job that uses it. What needs no Nix is
established by proofs over the generator's output. See the progress note in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

`setup-deno` is gone with the Deno migration, and `fjs/ci/config/module.f.mjs` no longer
records that action version; its `deno` pin now names what the snapshot provides — 2.8.3
— rather than deno.com's latest, exactly as the Node pins do. `nixJobs` in
`fjs/ci/module.f.mjs` composes the flakes of two families rather than aliasing the Node
list.

Separately from Nix, `deno` and `bun` both stopped installing and running a published
`functionalscript`; the platform matrix is the only family that still does. That is
[built-package-checks](built-package-checks.md)'s subject, not this issue's, but it is
why those two jobs are shorter than the migration alone would leave them.

Deno brought one thing the Node jobs did not: `pkgs.deno` carries no version, so the
proof that ties `nodejs_24` to the configured Node has no counterpart for it. Its CI
version check is the whole tie, which is why that check is worth more there than it is
for Node.

**Bun was attempted and reverted.** Nixpkgs ships Bun 1.3.13 — on the pinned commit and
on `master` — and two of this repository's proofs fail on it while passing on the 1.4.0
`setup-bun` installs. One is a real difference in when `Symbol.species` is read, not a
slow machine, so no timeout or configuration change reaches it, and weakening a proof to
move a job to Nix is not a trade worth making.
[bun-nix-blocked-on-nixpkgs](bun-nix-blocked-on-nixpkgs.md) owns that job and records
what has to change first.

What remains here is the Nixpkgs update command; the other open items are `bun` and
removing stale generated job directories, which waits on a recursive `rm` effect.

### Problem

The CI environments are currently assembled by workflow-specific setup steps rather than
small, readable, declarative Nix environments. A broad design also risks coupling the
first useful Node migration to unrelated dependency-updater, browser-testing, Rust, OCI,
and configuration-migration work.

We need to prove the smallest independent path:

```text
current CI config -> generated per-job flake.nix -> direct CI execution
```

### Proposal

Use one official Nixpkgs snapshot to generate a separate self-contained flake for each
selected CI job. Start only with Node 22, Node 24, and Node 26, and adopt each job
independently after its existing commands pass through direct Nix.

#### Scope

This task owns only:

- selecting and pinning an exact Nixpkgs commit;
- recording package versions provided by that snapshot;
- declaring simple Nix environments for selected Node CI jobs;
- generating and committing one `flake.nix` per job;
- validating and adopting those flakes in CI.

This task does not own:

- replacing `npm-check-updates`;
- designing a repository-wide CI lock format;
- browser-test application or Playwright adapter design;
- solving Rust target/toolchain composition;
- building OCI images.

Those concerns evolve independently and must not block the first Node flakes.

#### Configuration

For this milestone, extend the existing `fjs/ci/config/module.f.mjs` configuration. It is
already consumed by CI generation and works on native Windows.

A future task may migrate CI configuration to another format. That migration is not a
prerequisite for Nix generation; it only needs to update the Nix generator to read the
new source when it happens.

Add only the data needed now:

- stable Nixpkgs update reference;
- exact accepted Nixpkgs commit;
- exact package versions copied from that snapshot where native CI needs them;
- simple per-job system and package declarations.

The runtime declarations are:

```text
node22: aarch64-linux, nodejs_22
node24: aarch64-linux, nodejs_24
node26: aarch64-linux, nodejs_26
deno:   aarch64-linux, deno
```

`bun` would be `aarch64-linux, bun`, and is not declared while its migration is blocked.

The Node attributes name a major version; Deno's names nothing. Where the attribute is
unversioned the configured version is a claim the flake cannot restate, so only the job's
own check can hold it.

A job may also declare tools required by its own work. Keep those additions job-local;
this TODO does not prescribe which non-Node tools a job needs.

#### Generated environments

Generate one self-contained file for each job:

```text
nix/node22/flake.nix
nix/node24/flake.nix
nix/node26/flake.nix
nix/deno/flake.nix
```

Each generated file should:

- pin the exact Nixpkgs commit;
- expose `devShells.aarch64-linux.default` for the current ARM Linux job;
- use `pkgs.mkShell` with that job's declared packages;
- be readable without inspecting the generator;
- contain no job-selection logic;
- contain no unrelated platform branches;
- avoid helper libraries and shared generated Nix modules.

The minimal public contract is:

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

The generator substitutes the job's packages. If another system is later required, emit
another explicit `devShells.<system>.default` attribute rather than adding a loop or
system-selection framework.

Node 22, Node 24, Node 26 and `deno` remain separate because they use different
runtimes and run different command sequences.

No job declares a `shellHook`. The generator still emits one — a job needing environment
set up on shell entry can declare it, and `fjs/ci/nix/proof.f.mjs` holds that capability
to its shape — but Node 22's, which existed for a global install the job no longer makes,
is gone. Do not generalize this into a shell-configuration framework unless a surviving
job proves that abstraction useful.

#### Nixpkgs update

Add an explicit Nix-capable command, for example:

```sh
npm run ci-nix-update
```

At a high level it:

1. reads the latest commit from the configured official stable Nixpkgs reference;
2. verifies that `nodejs_22`, `nodejs_24`, `nodejs_26` and `deno` exist;
3. reads the package versions needed by the currently declared Nix jobs — for the
   unversioned attributes this is the only way to learn them, and today all five were
   read from the snapshot's package files by hand;
4. updates the Nixpkgs commit and relevant exact versions in
   `fjs/ci/config/module.f.mjs`;
5. runs ordinary CI generation to regenerate the declared flakes;
6. leaves all generated changes for review and commit.

Do not require the generic dependency updater to run this flow. Package-manager manifests
and lockfiles are changed only when a separately scoped task explicitly requires them.
Browser-runner and browser-package synchronization is outside this Node-only update flow.

#### Generated flake locks

Nix writes a `flake.lock` beside the `flake.nix` it evaluates unless told not to. CI
tells it not to: every invocation passes `--no-write-lock-file`, so a CI run leaves the
checkout exactly as it found it. The pin in `flake.nix` already determines every input,
so the lock resolves nothing the flake did not already say.

Every invocation also passes `--quiet`, which is about the log rather than the
checkout: it drops Nix's logging from `info` to `notice`, removing the `copying N
paths` substitution chatter and leaving warnings and errors. Nix has no short
spelling — `--quiet` declares no short name, and the `-Q` that exists is
`--no-build-output` on the legacy commands — so `-q` is not available here.

#### Generated `run` scripts

Neither flag is written in a workflow step. Each job directory holds a generated
`run` script beside its flake, and a step invokes that:

```sh
./nix/node26/run npm run cov
```

The script is the same for every job — `exec nix develop … "$(dirname "$0")"
--command "$@"` — so the spelling and its flags have one home instead of fifteen,
and a step reads as the command it runs. Its executable bit is committed rather
than generated, because nothing in `fjs/effects/node` can set a file mode;
[generated-run-script-mode](generated-run-script-mode.md) owns closing that gap.

An earlier revision took the opposite trade — ignore the lock rather than add a flag to
every invocation — and the scoped root `.gitignore` rule it added stays:

```gitignore
/nix/*/flake.lock
```

Not for CI, which no longer writes one, but for a developer running `nix develop` by hand
without the flag. The rule matches one level down, so it covers the per-job flakes and no
more: a future intentional `nix/flake.lock`, hand-maintained, is unaffected.

#### Validation and adoption

Adopt jobs independently. Each migrated workflow uses:

1. checkout;
2. a pinned Nix installer action;
3. one step per command of that job's existing sequence, each entering the job's shell:

```sh
./nix/<job>/run <command>
```

A CI step runs one command (root [`AGENTS.md`](../../../AGENTS.md) §7), so the sequence
is not bundled into a `bash -c` script: the step is what CI reports on, and a bundle
names the wrapper rather than the command that failed.

A step enters the shell only when it needs a tool the flake pins. `git` is the
runner's, so the Node 26 drift check stays a plain step:

```sh
./nix/node26/run npm run ci-update
git add -A && git diff --cached --exit-code
```

They read a workspace the previous step wrote, which is the same workspace either way.
This is also why no flake needs to declare `git`, and why it never matters whether
`nix develop` leaves the runner's `PATH` in place or replaces it with the shell's: only
commands that must run on the pinned toolchain go through it.

Re-entering the shell per step costs nothing the bundle was buying. `nix develop` runs
the shell's `shellHook` on every entry, so a job-local environment would be
re-established for each step rather than exported across them, and what such a hook puts
on disk persists across steps anyway. Each step still names the flake, so no step falls
back to the runner's preinstalled Node.

For each job:

1. verify the selected Node version, inside the flake, as the job's first real step;
2. run the existing commands in their current order;
3. verify there are no tracked or stageable checkout changes;
4. remove the old setup only after equivalent behavior is demonstrated.

Step 1 is a step of the job rather than a separate flake job: the version
`fjs/ci/config/module.f.mjs` records is a claim about what the pinned snapshot provides,
and the job that runs on it is where that claim is worth checking.

#### Independent follow-ups

Add other jobs only when useful:

- Deno is done; Bun is blocked on Nixpkgs, tracked separately in
  [bun-nix-blocked-on-nixpkgs](bun-nix-blocked-on-nixpkgs.md);
- Rust should have its own experiment and TODO for concrete toolchain/target packages;
- real browser execution is tracked by
  [browser-testing](../../emergent_testing/todo/browser-testing.md); the Node-only
  Playwright integration has already been removed;
- a future browser runner may use Nix-provided browsers, but that should be designed after
  the shared HTML/JavaScript browser application exists and must not restore the deleted
  Node-only Playwright job;
- OCI remains a later design and optimization task after one direct-Nix Linux job
  completes validation.

A failure or unresolved design in one follow-up must not block unrelated flakes.

### Tasks

- [x] Add the stable Nixpkgs reference and exact accepted commit to the current CI
      configuration, plus the exact Node versions that snapshot provides.
- [x] Add the Node job system and package declarations above.
- [ ] Add the explicit Nixpkgs update command.
- [x] Verify all required package attributes exist in the candidate snapshot —
      `nodejs_{22,24,26}` and `deno`, the last confirmed to carry `aarch64-linux`
      in `meta.platforms`. `bun` exists and carries it too, but the version it
      provides fails this repository's suite.
- [x] Generate one readable self-contained flake per job with
      `devShells.aarch64-linux.default`.
- [ ] Remove stale generated job directories.
- [x] Generate a `run` script per job, so a workflow step names a command rather
      than a `nix develop` invocation.
- [x] Ignore `/nix/*/flake.lock`.
- [x] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [x] Bootstrap Nix through a pinned CI action in each migrated job.
- [x] Run each migrated job's complete command sequence through its flake, one
      `nix develop --command` step per command.
- [x] Validate each Node job independently with its existing commands and order.
- [x] Keep tracked checkout state unchanged.
- [x] Migrate jobs one at a time — Node 24, then Node 26, then Node 22, then `deno`.
- [ ] Migrate `bun`, once Nixpkgs provides a Bun this repository's proofs pass on.
- [ ] Create independent follow-up TODOs only when experiments expose concrete needs.

### Related

- [`fjs/media/nix`](../../media/nix/module.f.mjs) — generic Nix eDSL used by the
  generated-flake code generator.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — first Node
  implementation.
- [browser-testing](../../emergent_testing/todo/browser-testing.md) — replacement design
  for real browser execution and the optional external Playwright runner.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — optional OCI design work after
  one direct-Nix job completes validation.
