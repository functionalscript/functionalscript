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

`nixDevelopAll` joins the commands with `&&` and embeds the result inside nested YAML
and shell quoting. The generated `.github/workflows/ci.yml` line is difficult to read,
review, copy, and debug, and it will become worse as the job grows.

The sequence also mixes two responsibilities:

- validating packages, paths, executables, and values supplied by the generated Nix
  environment;
- installing repository dependencies and running the reusable repository workload.

The prerequisite task removes the repository `@playwright/test` dependency and defines
the stable Playwright workload:

- FunctionalScript proofs run through the self-hosted runner used by `fjs t`;
- Nix owns the Playwright launcher and matching Chromium, Firefox, and WebKit bundle;
- browser validation launches each Nix-provided browser without `npx` or a repository
  Playwright package.

This task must serialize that established workload. Do not reintroduce a local
Playwright version assertion or package-resolution workaround here.

Keeping environment validation separate from the repository workload also allows a
future image or cache workflow to build or validate the environment without installing
repository dependencies or running tests.

### Goal

Generate the scripts next to the generated Playwright flake:

```text
nix/generated/playwright/
├── flake.nix
├── check.sh
└── ci.sh
```

- `check.sh` validates every package, path, executable, and environment value required
  from the generated Playwright Nix environment, without reading or installing
  repository dependencies.
- `ci.sh` installs repository dependencies and runs the stable workload established by
  the prerequisite task.

The direct-Nix workflow should explicitly run both scripts inside the Playwright
development shell:

```sh
nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/check.sh

nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/ci.sh
```

A developer with a compatible environment should also be able to run the reusable
script directly:

```sh
bash ./nix/generated/playwright/ci.sh
```

Keep all generated files under `nix/generated/` for this task. A later task may rename
or parameterize the output root, for example from `./nix/generated/` to `./ci/`, because
`fjs ci` can generate CI files for repositories other than FunctionalScript. Do not mix
that output-root migration into this task.

This task covers direct `nix develop` execution only. Do not add Docker, OCI-image,
cache, or publication support here.

### Reusable CI script

Generate `nix/generated/playwright/ci.sh` from the final reusable command list produced
by the prerequisite task. Its logical sequence is:

1. `npm ci`;
2. run FunctionalScript proofs with the self-hosted runner used by `fjs t`;
3. launch and close Chromium through the Nix-owned Playwright environment;
4. launch and close Firefox through the Nix-owned Playwright environment;
5. launch and close WebKit through the Nix-owned Playwright environment.

The exact Nix-owned browser command or wrapper name is established by the prerequisite
task. This task serializes that command list without duplicating or reconstructing it.

The generated script must:

- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve each command as readable script text instead of joining commands with `&&`;
- install dependencies before running repository tests;
- use the self-hosted FunctionalScript runner rather than Playwright Test registration;
- use only the Nix-owned browser launcher for Chromium, Firefox, and WebKit validation;
- contain no `npx playwright`, `@playwright/test` import, repository-local Playwright
  command, or hard-coded Playwright version assertion;
- end with a newline;
- remain a committed generated artifact so generator drift is caught by
  `npm run ci-update` and the existing generated-file check.

Changing only the pinned Node, Nixpkgs, Playwright package, or browser-bundle version
must not change `ci.sh` unless the stable command shape itself changes.

### Nix validation script

Generate `nix/generated/playwright/check.sh` for checks that depend only on the
generated Playwright Nix environment.

It must validate every requirement established by the prerequisite task, including:

- the exact Node version supplied on `PATH`;
- the presence of the Nix-owned Playwright browser-launch executable or wrapper;
- the existence of the Nix-provided browser bundle path;
- every environment value still required by the Nix-owned launcher, such as the
  host-platform override when retained;
- the absence of assumptions about repository `node_modules`.

Do not retain checks for environment values removed by the prerequisite task. For
example, browser-download suppression should disappear when no npm Playwright package
is installed and no postinstall download can occur.

`check.sh` must not invoke `npm`, `npx`, `fjs t`, or any package installed from the
repository. It verifies only the generated environment. Browser launch-and-close checks
belong to `ci.sh`, because they are part of the reusable workload rather than static
environment inspection.

Every expected package, executable, path, and environment value must be derived from the
same structured Nix job configuration that generates
`nix/generated/playwright/flake.nix`. Do not restate those values in an independent
source of truth. Removing or changing a required Nix-provided value must update the
flake and `check.sh` together.

The separation makes these operations independently selectable:

```text
build or realize the Playwright Nix environment
validate it with nix/generated/playwright/check.sh
install dependencies and run the workload with nix/generated/playwright/ci.sh
```

Building or realizing the flake must not implicitly run either script. The Playwright CI
job explicitly invokes both. A future image or cache workflow can build or validate the
same environment without installing dependencies or running tests.

### Generator design

Treat `nix/generated/<id>/` as the generated bundle for one CI environment. For the
Playwright job, the bundle contains its flake, environment-validation script, and
reusable workload script.

Keep the command sources separate:

- the reusable CI command list belongs to the Playwright job behavior established by
  the prerequisite task;
- the validation command list is derived only from the Playwright Nix environment
  configuration, including every required package, executable, path, and environment
  value;
- neither script is embedded into `flake.nix` or executed while building it.

The smallest reusable-script declaration may look like:

```ts
type CiScript = {
    readonly commands: readonly string[]
}
```

The generator should:

- serialize the reusable script into `nix/generated/<id>/ci.sh`;
- serialize complete Nix-only validation into `nix/generated/<id>/check.sh`;
- continue serializing the environment into `nix/generated/<id>/flake.nix`;
- derive `check.sh` assertions from the same package and environment declarations used
  by the flake;
- provide helpers that invoke either generated script through that job's
  `nix develop` environment;
- let non-Nix execution reference the same `ci.sh` path;
- avoid separately constructing script contents and workflow command sequences.

Name and exact helper signatures may change during implementation, but preserve these
boundaries:

- the Playwright job owns dependency installation and its reusable proof and browser
  validation sequence;
- the Nix job owns the execution environment and expectations for Nix-provided
  packages, executables, paths, and values;
- the generator owns the committed bundle under `nix/generated/<id>/`;
- the workflow chooses when to validate the environment and when to run the repository
  workload;
- normal script serialization replaces whole-sequence shell quoting.

Do not hard-code FunctionalScript source paths into the public `fjs ci` model. Generated
paths are relative to the target repository's output root. Supporting a configurable or
renamed output root is follow-up work, but this design must not prevent it.

### Validation

Add proofs for:

- serialization of the Bash header and command sequence for both scripts;
- the generated `nix/generated/playwright/ci.sh` and
  `nix/generated/playwright/check.sh` paths;
- commands containing ordinary single and double quotes remaining unchanged;
- `ci.sh` running `npm ci` before the self-hosted FunctionalScript tests;
- `ci.sh` preserving the Chromium, Firefox, and WebKit launch-and-close commands from
  the prerequisite task;
- `ci.sh` containing no `npx playwright`, repository-local Playwright invocation,
  Playwright package import, or hard-coded Playwright version assertion;
- `check.sh` containing the exact Node assertion and validations for every Nix-owned
  executable, browser path, and required environment value;
- `check.sh` not invoking `npm`, `npx`, `fjs t`, or repository-local tools;
- deleting or changing any required Playwright environment declaration causing the
  generated `check.sh` proof or runtime validation to fail;
- the `nix develop` workflow commands referencing the generated scripts without inline
  multi-command `bash -c` sequences;
- a Node or environment-value change updating `flake.nix` and, when relevant,
  `check.sh` without changing `ci.sh`;
- a Playwright or browser-bundle version-only change updating the Nix environment
  without changing either stable script;
- building or realizing the flake not executing either script.

Regenerate the committed files and verify:

- `npm run ci-update` produces no uncommitted generated changes;
- TypeScript checks pass;
- `check.sh` passes in a clean checkout before `npm ci` and fails when any required
  Nix-provided package, executable, path, or environment value is absent or incorrect;
- `ci.sh` installs dependencies, runs the self-hosted FunctionalScript suite, and
  successfully validates all three Nix-provided browsers through direct
  `nix develop`;
- `ci.sh` can be invoked directly in a compatible developer environment.

### Out of scope

- removing `@playwright/test` or redesigning Playwright execution; those belong to the
  prerequisite task;
- executing FunctionalScript proofs inside browser pages;
- Docker or OCI execution of the generated scripts;
- publishing or caching scripts, Nix closures, or images;
- deciding how future image or cache workflows distribute the environment;
- renaming `nix/generated/` to `ci/` or making the output root configurable;
- migrating additional jobs to direct Nix;
- designing a general-purpose shell-language AST or escaping arbitrary untrusted shell
  fragments.

### Tasks

- [ ] Complete
      [ci-playwright-without-test-package](ci-playwright-without-test-package.md)
      and use the stable commands it defines.
- [ ] Add an environment-independent reusable CI-script declaration.
- [ ] Generate `nix/generated/playwright/ci.sh` from the reusable command sequence.
- [ ] Generate `nix/generated/playwright/check.sh` from complete Nix-only validation
      commands.
- [ ] Add the Bash header, strict-mode line, readable commands, and final newline to both
      scripts.
- [ ] Put `npm ci`, the self-hosted FunctionalScript test command, and the three
      Nix-owned browser checks into `ci.sh`, preserving that order.
- [ ] Validate the exact Node version and every required Nix-owned Playwright executable,
      browser path, and environment value in `check.sh`.
- [ ] Derive every `check.sh` assertion from the same Nix job configuration used to
      generate the flake.
- [ ] Make the Playwright direct-Nix workflow explicitly invoke `check.sh` and then
      `ci.sh`.
- [ ] Remove the no-longer-needed whole-sequence `&&` joining and single-argument shell
      quoting helpers.
- [ ] Add generator, validation, and workflow proofs for the separated behavior.
- [ ] Regenerate committed CI files and confirm update checks, TypeScript checks,
      clean-checkout Nix validation, direct script execution, and the Playwright CI job
      pass.

### Related

- [ci-playwright-without-test-package](ci-playwright-without-test-package.md) —
  prerequisite that removes the repository Playwright Test dependency and defines the
  stable proof and browser-validation workload.
- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and the
  current inline command sequence this task replaces.
