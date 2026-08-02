## 65Z-ci-nix-job-script. Generate reusable CI job scripts

**Priority:** P3
**Status:** open

### Problem

The migrated Playwright job currently passes its whole command sequence through one
generated workflow line:

```sh
nix develop ./nix/generated/playwright --command bash -euo pipefail -c 'command-1 && command-2 && ...'
```

`nixDevelopAll` joins the commands with `&&` and embeds the result inside nested YAML
and shell quoting. The generated `.github/workflows/ci.yml` line is difficult to read,
review, copy, and debug, and it will become worse as the job grows.

The current sequence also mixes two different responsibilities:

- validating that the generated Nix environment contains the pinned tool versions;
- installing repository dependencies and running the actual Playwright test suite.

The test sequence should not contain Nix-specific validation. A Node or Playwright
version bump should update the flake and its validation while leaving the same test
script to run against the new tools. Keeping those concerns separate also allows a
future image or cache job to build the environment without running tests.

### Goal

Generate two readable Bash scripts next to each generated job flake:

```text
nix/generated/playwright/
├── flake.nix
├── check.sh
└── ci.sh
```

- `check.sh` validates the generated Nix environment, including exact tool versions.
- `ci.sh` installs repository dependencies and runs the reusable CI workload.

The direct-Nix workflow should explicitly run both scripts inside the generated
development shell:

```sh
nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/check.sh

nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/ci.sh
```

A developer with a compatible environment should also be able to run the reusable CI
script directly:

```sh
bash ./nix/generated/playwright/ci.sh
```

Keep the files under `nix/generated/<job>/` for this task so every generated environment
and its entry scripts are colocated. A later task may rename or parameterize the output
root, for example from `./nix/generated/` to `./ci/`, because `fjs ci` can generate CI
files for repositories other than FunctionalScript. Do not mix that directory-layout
migration into this task.

This task covers direct `nix develop` execution only. Do not add Docker, OCI-image,
cache, or publication support here.

### Reusable CI script

For the current Playwright job, generate `nix/generated/playwright/ci.sh` with this
shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

npm ci
npx playwright test --browser=chromium
npx playwright test --browser=firefox
npx playwright test --browser=webkit
```

The script intentionally does not contain exact Node or Playwright version assertions.
Those assertions validate the generated Nix environment and belong in `check.sh`.
Consequently, changing only the pinned Node, Playwright, or Nixpkgs version must not
change `ci.sh`.

The reusable script must:

- be generated from a structured command list owned by the CI job;
- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve each command as readable script text instead of joining commands with `&&`;
- end with a newline;
- contain only the job's reusable work, not provider-specific environment validation;
- remain a committed generated artifact so generator drift is caught by
  `npm run ci-update` and the existing generated-file check.

### Nix validation script

Generate `nix/generated/playwright/check.sh` for checks specific to the generated Nix
environment:

```bash
#!/usr/bin/env bash
set -euo pipefail

test "$(node --version)" = "v26.5.1"
test "$(npx playwright --version)" = "Version 1.59.1"
```

The exact expected versions remain generated from the same configuration that generates
the flake. The validation script should change when those versions change; the reusable
CI script should not.

The separation makes these operations independently selectable:

```text
build or realize Nix environment
validate Nix environment with check.sh
run reusable workload with ci.sh
```

Building or realizing the flake must not implicitly run either script. The Playwright CI
job should explicitly invoke both. A future image or cache workflow can build the same
environment without running validation or tests.

### Generator design

Keep the scripts colocated with the generated flake, but keep their command sources
separate:

- the reusable CI command list belongs to the CI job behavior;
- the validation command list is derived from the Nix environment configuration;
- neither script is embedded into `flake.nix` or executed while building it.

The smallest reusable-script declaration may look like:

```ts
type CiScript = {
    readonly id: string
    readonly commands: readonly string[]
}
```

The generator should:

- serialize the reusable script into `nix/generated/<id>/ci.sh`;
- serialize Nix-specific validation into `nix/generated/<id>/check.sh`;
- continue serializing the environment into `nix/generated/<id>/flake.nix`;
- provide helpers that invoke either generated script through `nix develop`;
- let non-Nix execution reference the same `ci.sh` path;
- avoid separately constructing script contents and workflow command sequences.

Name and exact helper signatures may change during implementation, but preserve these
boundaries:

- the CI job owns its reusable command sequence;
- the Nix job owns the execution environment and exact-version expectations;
- the generator owns the three committed files in each job directory;
- the workflow chooses when to build, validate, and run tests;
- normal script serialization replaces whole-sequence shell quoting.

Do not hard-code FunctionalScript source paths into the public `fjs ci` model. Generated
paths are relative to the target repository's output root. Supporting a configurable or
renamed output root is follow-up work, but this design must not prevent it.

### Validation

Add proofs for:

- serialization of the Bash header and command sequence for both scripts;
- the generated `ci.sh` and `check.sh` paths beside `flake.nix`;
- commands containing ordinary single and double quotes remaining unchanged;
- `ci.sh` excluding Node and Playwright version assertions;
- `check.sh` containing both exact version assertions;
- the `nix develop` workflow commands referencing the generated scripts without inline
  multi-command `bash -c` sequences;
- a version-only configuration change updating `flake.nix` and `check.sh` without
  changing `ci.sh`;
- building or realizing the flake not executing either script.

Regenerate the committed files and verify:

- `npm run ci-update` produces no uncommitted generated changes;
- TypeScript checks pass;
- `check.sh` passes inside the generated Nix environment;
- `ci.sh` passes all three browser suites through direct `nix develop`;
- `ci.sh` can be invoked directly in a compatible developer environment.

### Out of scope

- Docker or OCI execution of the generated scripts;
- publishing or caching scripts, Nix closures, or images;
- deciding how future image or cache workflows distribute the environment;
- renaming `nix/generated/` to `ci/` or making the output root configurable;
- migrating additional Node jobs to direct Nix;
- designing a general-purpose shell-language AST or escaping arbitrary untrusted shell
  fragments;
- changing the Playwright test sequence itself.

### Tasks

- [ ] Add an environment-independent reusable CI-script declaration.
- [ ] Generate `nix/generated/<id>/ci.sh` from each declared reusable command sequence.
- [ ] Generate `nix/generated/<id>/check.sh` from Nix-specific validation commands.
- [ ] Add the Bash header, strict-mode line, readable commands, and final newline to both
      scripts.
- [ ] Move the Playwright install-and-test sequence into `ci.sh`.
- [ ] Move exact Node and Playwright version checks into `check.sh`.
- [ ] Make the Playwright direct-Nix workflow explicitly invoke `check.sh` and then
      `ci.sh`.
- [ ] Remove the no-longer-needed whole-sequence `&&` joining and single-argument shell
      quoting helpers.
- [ ] Add generator, validation, and workflow proofs for the separated behavior.
- [ ] Regenerate committed CI files and confirm update checks, TypeScript checks, Nix
      validation, direct script execution, and the Playwright CI job pass.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and the
  current inline command sequence this task replaces.
