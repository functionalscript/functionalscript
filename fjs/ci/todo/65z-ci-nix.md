## 65Z-ci-nix. Generate simple CI flakes from official Nixpkgs

**Priority:** P3
**Status:** wip

### Progress

Flake generation is implemented, and a temporary `nix-flakes` CI job instantiates
the generated flakes — see the progress note in
[66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md). What remains
here is the Nixpkgs update command and adopting the flakes in the real jobs.

### Problem

The CI environments are currently assembled by workflow-specific setup steps rather than
small, readable, declarative Nix environments. A broad design also risks coupling the
first useful Node migration to unrelated dependency-updater, Playwright, Rust, OCI, and
configuration-migration work.

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
- declaring simple Nix environments for selected CI jobs;
- generating and committing one `flake.nix` per job;
- validating and adopting those flakes in CI.

This task does not own:

- replacing `npm-check-updates`;
- designing a repository-wide CI lock format;
- synchronizing Playwright packages and browsers;
- solving Rust target/toolchain composition;
- building OCI images.

Those concerns may evolve independently and must not block the first Node flakes.

#### Configuration

For this milestone, extend the existing `fjs/ci/config/module.f.ts` configuration.
It is already consumed by CI generation and works on native Windows.

A future task may migrate CI configuration to another format. That migration is not a
prerequisite for Nix generation; it only needs to update the Nix generator to read the
new source when it happens.

Add only the data needed now:

- stable Nixpkgs update reference;
- exact accepted Nixpkgs commit;
- exact package versions copied from that snapshot where native CI needs them;
- simple per-job system and package declarations.

For the current jobs, the declarations are:

```text
node22: aarch64-linux, nodejs_22
node24: aarch64-linux, nodejs_24
node26: aarch64-linux, nodejs_26
```

#### Generated environments

Generate one self-contained file for each job:

```text
nix/generated/node22/flake.nix
nix/generated/node24/flake.nix
nix/generated/node26/flake.nix
```

Each generated file should:

- pin the exact Nixpkgs commit;
- expose `devShells.aarch64-linux.default` for the current ARM Linux job;
- use `pkgs.mkShell` with exactly that job's Node package;
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

The generator substitutes the job's package. If another system is later required, emit
another explicit `devShells.<system>.default` attribute rather than adding a loop or
system-selection framework.

Node 22, Node 24, and Node 26 remain separate because they use different runtimes and
run different command sequences.

The Node 22 flake adds one explicit job-local field for its existing global install:

```nix
shellHook = ''
  export NPM_CONFIG_PREFIX="$HOME/.npm-global"
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
  mkdir -p "$NPM_CONFIG_PREFIX"
'';
```

Do not generalize this into a shell-configuration framework unless another job proves
that abstraction useful.

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
   `fjs/ci/config/module.f.ts`;
5. runs ordinary CI generation to regenerate the declared flakes;
6. leaves all generated changes for review and commit.

Do not require the generic dependency updater to run this flow. Package-manager
manifests and lockfiles are changed only when a separately scoped task explicitly
requires them.

#### Generated flake locks

Nix may create a `flake.lock` beside a generated `flake.nix` during evaluation. Do not
commit these per-job lock files in the first milestone. Ignore them with the scoped
root `.gitignore` rule:

```gitignore
/nix/generated/**/flake.lock
```

This keeps the Node 26 generated-file drift check clean without adding special Nix
flags to every invocation. The rule is deliberately limited to generated CI flakes,
so a future intentional root or hand-maintained `flake.lock` is unaffected.

#### Validation and adoption

Adopt jobs independently. Each migrated workflow uses:

1. checkout;
2. a pinned Nix installer action;
3. one `nix develop --command` invocation containing that job's complete existing
   command sequence.

The invocation has this shape:

```sh
nix develop ./nix/generated/<job> --command bash -euo pipefail -c '<commands>'
```

Using one Nix process keeps the selected Node executable and any job-local `shellHook`
available to every command. It avoids profiles, cross-step PATH exports, and accidental
fallback to the runner's preinstalled Node.

For each job:

1. verify the selected Node version inside the Nix invocation;
2. run the existing commands in their current order;
3. verify there are no tracked or stageable checkout changes;
4. remove the old setup only after equivalent behavior is demonstrated.

#### Independent follow-ups

Add other jobs only when useful:

- Deno and Bun can be separate straightforward follow-ups;
- Rust should have its own experiment and TODO for concrete toolchain/target packages;
- Playwright has its own experiment and TODO — see
  [65Z-ci-nix-playwright](65z-ci-nix-playwright.md);
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
- [x] Ignore `/nix/generated/**/flake.lock`.
- [x] Keep `npm run ci-update` Nix-independent and Windows-compatible.
- [x] Commit the generated flakes.
- [ ] Bootstrap Nix through a pinned CI action in each migrated job (the pinned
      action is already used by the temporary `nix-flakes` job).
- [ ] Run each migrated job's complete command sequence inside one
      `nix develop --command` invocation.
- [ ] Validate each Node job independently with its existing commands and order.
- [ ] Keep tracked checkout state unchanged.
- [ ] Migrate jobs one at a time.
- [ ] Create independent follow-up TODOs only when experiments expose concrete needs.

### Related

- [`fjs/media/nix`](../../media/nix/module.f.ts) — generic Nix eDSL used by the
  generated-flake code generator.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — first Node
  implementation.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — Playwright's own Nix flake
  experiment.
- [65Z-ci-scenario-docker](65z-ci-scenario-docker.md) — optional OCI design work after
  one direct-Nix job completes validation.
