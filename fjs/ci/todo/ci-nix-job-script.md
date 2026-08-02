## ci-nix-job-script. Generate reusable CI job scripts

**Priority:** P3
**Status:** open
**Depends on:**
[ci-playwright-without-test-package](ci-playwright-without-test-package.md)

### Problem

The migrated Playwright job currently passes its whole command sequence through one
generated workflow line:

```sh
nix develop ./nix/generated/playwright --command bash -euo pipefail -c 'command-1 && command-2 && ...'
```

`nixDevelopAll` joins commands with `&&` and embeds the result inside nested YAML and
shell quoting. The generated workflow is difficult to read, review, copy, and debug.

The sequence also mixes two responsibilities:

- validating packages, paths, executables, and values supplied by the generated Nix
  environment;
- preparing repository code and running the browser-hosted FunctionalScript workload.

The prerequisite task removes the repository Playwright dependency and defines the
stable command surface:

```sh
playwright fjs t --browser=chromium
playwright fjs t --browser=firefox
playwright fjs t --browser=webkit
```

Each command runs FunctionalScript's own emergent test runner with proof functions
executing inside the selected browser. This task must serialize that workload without
reintroducing `npx`, repository-local Playwright packages, version comparisons, or
launch-only smoke tests.

### Goal

Generate the scripts next to the generated Playwright flake:

```text
nix/generated/playwright/
├── flake.nix
├── check.sh
└── ci.sh
```

- `check.sh` validates every package, executable, path, and environment value supplied by
  the generated Playwright Nix environment without reading repository dependencies.
- `ci.sh` installs repository dependencies, produces browser-loadable JavaScript when
  required, and runs the browser-hosted FunctionalScript suites established by the
  prerequisite task.

The direct-Nix workflow explicitly invokes both scripts:

```sh
nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/check.sh

nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/ci.sh
```

A developer with the compatible global Playwright environment should also be able to run:

```sh
bash ./nix/generated/playwright/ci.sh
```

Keep generated files under `nix/generated/` for this task. Output-root renaming or
parameterization remains separate work.

### Reusable CI script

Generate `nix/generated/playwright/ci.sh` from the final command list produced by the
prerequisite task. Its logical sequence is:

1. install repository dependencies with `npm ci`;
2. run the deterministic repository build or preparation step required to expose
   browser-loadable JavaScript;
3. run the FunctionalScript suite inside Chromium;
4. run the FunctionalScript suite inside Firefox;
5. run the FunctionalScript suite inside WebKit.

The expected browser commands are:

```sh
playwright fjs t --browser=chromium
playwright fjs t --browser=firefox
playwright fjs t --browser=webkit
```

The exact build or preparation command is established by the prerequisite task and must
come from the repository's normal build configuration. Do not duplicate the browser
runner implementation in the script generator.

The generated script must:

- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve one readable command per line rather than joining commands with `&&`;
- install dependencies before invoking repository build tools;
- prepare browser-loadable JavaScript before browser execution when required;
- run all three `playwright fjs t` commands in a stable order;
- contain no `npx playwright`, repository-local Playwright binary, Playwright package
  import, hard-coded Playwright version assertion, or launch-only smoke command;
- fail when any browser-hosted proof fails;
- end with a newline;
- remain a committed generated artifact checked by `npm run ci-update`.

Changing only Node, Nixpkgs, Playwright, or browser-bundle versions must not change
`ci.sh` unless the command shape itself changes.

### Nix validation script

Generate `nix/generated/playwright/check.sh` for validation that depends only on the
Nix environment.

It must validate:

- the exact Node version supplied on `PATH`;
- the presence of the global `playwright` wrapper;
- support for the FunctionalScript `fjs` subcommand;
- the presence of the Playwright API and matching Chromium, Firefox, and WebKit bundle;
- the existence of every required browser or store path;
- every environment value still required by the global launcher;
- the absence of assumptions about repository `node_modules`.

`check.sh` must not run `npm`, repository build commands, `playwright fjs t`, or any
repository-local tool. It validates the environment but does not execute the test suite.

Do not keep checks for values removed by the prerequisite task. Browser-download
suppression should disappear when no repository Playwright postinstall can run.

Every expected package, executable, path, and environment value must be derived from the
same structured Nix job configuration used to generate
`nix/generated/playwright/flake.nix`.

### Generator design

Treat `nix/generated/<id>/` as the generated bundle for one CI environment. Keep command
sources separate:

- the reusable CI command list belongs to the Playwright job behavior established by
  the prerequisite task;
- the validation command list derives only from the Nix environment declaration;
- neither script is embedded into or executed while building `flake.nix`.

A minimal reusable-script declaration may remain:

```ts
type CiScript = {
    readonly commands: readonly string[]
}
```

The generator should:

- serialize the reusable workload into `nix/generated/<id>/ci.sh`;
- serialize Nix-only validation into `nix/generated/<id>/check.sh`;
- continue serializing the environment into `nix/generated/<id>/flake.nix`;
- derive `check.sh` assertions from the same package and environment declarations used
  by the flake;
- provide helpers that invoke either generated script through the job's
  `nix develop` environment;
- let compatible non-Nix environments reference the same `ci.sh` path;
- avoid separately constructing script contents and workflow command sequences.

Preserve these ownership boundaries:

- the Playwright job owns repository preparation and the three browser-hosted test
  commands;
- the Nix job owns the global Playwright wrapper, API, browsers, paths, and environment;
- the generator owns the committed bundle;
- the workflow chooses when to validate the environment and when to run the workload.

### Validation

Add proofs for:

- serialization of the Bash header and command sequence for both scripts;
- the generated `nix/generated/playwright/ci.sh` and `check.sh` paths;
- commands containing ordinary single and double quotes remaining unchanged;
- `ci.sh` running `npm ci` before any repository build or preparation command;
- the preparation command running before browser-hosted tests when required;
- `ci.sh` preserving the Chromium, Firefox, and WebKit commands exactly;
- `ci.sh` containing no `npx playwright`, repository-local Playwright invocation,
  package import, version assertion, Node-only `fjs t`, or smoke-only browser launch;
- `check.sh` validating the exact Node version, global wrapper, `fjs` subcommand,
  Playwright API, browser paths, and required environment values;
- `check.sh` not invoking `npm`, repository tools, or browser-hosted test execution;
- deleting or changing a required Nix declaration causing generated validation to fail;
- workflow commands referencing the generated scripts without inline multi-command
  `bash -c` sequences;
- version-only environment changes updating the flake and relevant checks without
  changing the stable workload script;
- building or realizing the flake not executing either script.

Regenerate committed files and verify:

- `npm run ci-update` produces no uncommitted changes;
- TypeScript checks pass;
- `check.sh` passes in a clean checkout before `npm ci`;
- `ci.sh` prepares browser-loadable code and runs the FunctionalScript suite inside all
  three browsers through direct `nix develop`;
- a deliberately failing browser proof makes the corresponding command and script fail;
- `ci.sh` can run directly in a compatible developer environment with globally provided
  Playwright support.

### Out of scope

- implementing the browser-hosted runner or global Playwright wrapper; those belong to
  the prerequisite task;
- changing the browser runner's test semantics;
- Docker or OCI execution of the generated scripts;
- publication or cache design;
- output-root migration;
- migrating additional jobs;
- designing a general-purpose shell-language AST.

### Tasks

- [ ] Complete
      [ci-playwright-without-test-package](ci-playwright-without-test-package.md)
      and use the stable build and browser-test commands it defines.
- [ ] Add an environment-independent reusable CI-script declaration.
- [ ] Generate `nix/generated/playwright/ci.sh` from the reusable command sequence.
- [ ] Generate `nix/generated/playwright/check.sh` from complete Nix-only validation
      commands.
- [ ] Add the Bash header, strict mode, readable commands, and final newline to both
      scripts.
- [ ] Put `npm ci`, browser-build preparation, and the three
      `playwright fjs t --browser=...` commands into `ci.sh` in that order.
- [ ] Validate the exact Node version and every required global Playwright executable,
      capability, browser path, and environment value in `check.sh`.
- [ ] Derive all `check.sh` assertions from the same Nix job configuration used to
      generate the flake.
- [ ] Make the direct-Nix workflow explicitly invoke `check.sh` and then `ci.sh`.
- [ ] Remove whole-sequence `&&` joining and single-argument shell quoting helpers.
- [ ] Add generator, validation, workflow, and browser-command proofs.
- [ ] Regenerate committed files and confirm update checks, TypeScript checks,
      clean-checkout Nix validation, direct script execution, and the Playwright CI job
      pass.

### Related

- [ci-playwright-without-test-package](ci-playwright-without-test-package.md) — prerequisite
  that defines the global CLI and browser-hosted FunctionalScript runner.
- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and current
  inline command sequence.
