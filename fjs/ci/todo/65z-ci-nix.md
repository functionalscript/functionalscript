## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** wip

### Progress

Flake generation is implemented and **Node 24 and Node 26 are migrated**: each installs
Nix through the pinned action and runs its command sequence one `nix develop` step per
command. Nix now runs in CI only where a job uses a flake — the temporary `nix-flakes`
job that instantiated them to check them is gone, and what can be established about a
generated file is established by proofs over the generator's output. See the progress
note in [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).

What remains here is the Nixpkgs update command and **Node 22**, which is the one job
that needs its flake's `shellHook`: it installs the FunctionalScript package globally and
runs the installed `fjs` in a later step. That check is proposed for a different job
entirely — see
[built-package-checks](built-package-checks.md) — which would take the `shellHook` with
it and leave Node 22 as mechanical as the other two.

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

For the current jobs, the Node runtime declarations are:

```text
node22: aarch64-linux, nodejs_22
node24: aarch64-linux, nodejs_24
node26: aarch64-linux, nodejs_26
```

A job may also declare tools required by its own work. Keep those additions job-local;
this TODO does not prescribe which non-Node tools a job needs.

#### Generated environments

Generate one self-contained file for each job:

```text
nix/node22/flake.nix
nix/node24/flake.nix
nix/node26/flake.nix
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

Node 22, Node 24, and Node 26 remain separate because they use different runtimes and run
different command sequences.

The Node 22 flake adds one explicit job-local field for its existing global install:

```nix
shellHook = ''
  export NPM_CONFIG_PREFIX="$HOME/.npm-global"
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  mkdir -p "$NPM_CONFIG_PREFIX"
'';
```

Do not generalize this into a shell-configuration framework unless another surviving job
proves that abstraction useful.

#### Nixpkgs update

Add an explicit Nix-capable command, for example:

```sh
npm run ci-nix-update
```

At a high level it:

1. reads the latest commit from the configured official stable Nixpkgs reference;
2. verifies that `nodejs_22`, `nodejs_24`, and `nodejs_26` exist;
3. reads the package versions needed by the currently declared Nix jobs;
4. updates the Nixpkgs commit and relevant exact versions in
   `fjs/ci/config/module.f.mjs`;
5. runs ordinary CI generation to regenerate the declared flakes;
6. leaves all generated changes for review and commit.

Do not require the generic dependency updater to run this flow. Package-manager manifests
and lockfiles are changed only when a separately scoped task explicitly requires them.
Browser-runner and browser-package synchronization is outside this Node-only update flow.

#### Generated flake locks

Nix may create a `flake.lock` beside a generated `flake.nix` during evaluation. Do not
commit these per-job lock files in the first milestone. Ignore them with the scoped root
`.gitignore` rule:

```gitignore
/nix/*/flake.lock
```

This keeps the Node 26 generated-file drift check clean without adding special Nix flags
to every invocation. The rule matches one level down, so it covers the per-job flakes and
no more: a future intentional `nix/flake.lock`, hand-maintained, is unaffected.

#### Validation and adoption

Adopt jobs independently. Each migrated workflow uses:

1. checkout;
2. a pinned Nix installer action;
3. one step per command of that job's existing sequence, each entering the job's shell:

```sh
nix develop ./nix/<job> --command <command>
```

A CI step runs one command (root [`AGENTS.md`](../../../AGENTS.md) §7), so the sequence
is not bundled into a `bash -c` script: the step is what CI reports on, and a bundle
names the wrapper rather than the command that failed.

A step enters the shell only when it needs a tool the flake pins. `git` and `grep` are
the runner's, as they are for a `setup-node` job today, so the Node 26 drift check and
the typedef gate stay plain steps:

```sh
nix develop ./nix/node26 --command npm run ci-update
git add -A && git diff --cached --exit-code
```

They read a workspace the previous step wrote, which is the same workspace either way.
This is also why no flake needs to declare `git`, and why it never matters whether
`nix develop` leaves the runner's `PATH` in place or replaces it with the shell's: only
commands that must run on the pinned toolchain go through it.

Re-entering the shell per step costs nothing the bundle was buying. `nix develop` runs
the shell's `shellHook` on every entry, so a job-local environment is re-established for
each step rather than exported across them, and what such a hook puts on disk — the
Node 22 `$HOME/.npm-global` prefix — persists across steps anyway. Each step still names
the flake, so no step falls back to the runner's preinstalled Node.

For each job:

1. verify the selected Node version, inside the flake, as the job's first real step;
2. run the existing commands in their current order;
3. verify there are no tracked or stageable checkout changes;
4. remove the old setup only after equivalent behavior is demonstrated.

Step 1 is the check a `setup-node` job already makes of its own runtime, pointed through
`nix develop`. It is a step of the job rather than a separate flake job: the version
`fjs/ci/config/module.f.mjs` records is a claim about what the pinned snapshot provides,
and the job that runs on it is where that claim is worth checking.

#### Independent follow-ups

Add other jobs only when useful:

- Deno and Bun can be separate straightforward follow-ups;
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
- [x] Verify all required Node package attributes exist in the candidate snapshot.
- [x] Generate one readable self-contained flake per Node job with
      `devShells.aarch64-linux.default`.
- [x] Add the Node 22 `$HOME/.npm-global` shell hook.
- [ ] Remove stale generated job directories.
- [x] Ignore `/nix/*/flake.lock`.
- [x] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [ ] Bootstrap Nix through a pinned CI action in each migrated job — Node 24 and
      Node 26 done, Node 22 remains.
- [ ] Run each migrated job's complete command sequence through its flake, one
      `nix develop --command` step per command — Node 24 and Node 26 done.
- [ ] Validate each Node job independently with its existing commands and order —
      Node 24 and Node 26 done.
- [ ] Keep tracked checkout state unchanged.
- [ ] Migrate jobs one at a time — Node 24, then Node 26; the rule still binds Node 22.
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
