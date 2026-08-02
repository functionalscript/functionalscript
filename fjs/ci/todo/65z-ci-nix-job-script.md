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

The current sequence also mixes two responsibilities:

- validating packages and values supplied by the generated Nix environment;
- installing repository dependencies, validating repository-local tooling, and running
  the Playwright test suite.

The Nix validation script must not depend on repository state such as `node_modules`.
In particular, invoking `npx playwright` before `npm ci` may download an unrelated
package into the npm cache instead of using the pinned `@playwright/test` dependency.
The Playwright version assertion therefore belongs to the reusable CI script after
dependency installation, while `check.sh` validates only the generated environment.

Keeping these concerns separate also allows an image or cache workflow to build or
validate the environment without installing repository dependencies or running tests.

### Goal

Generate the scripts next to the generated Playwright flake:

```text
nix/generated/playwright/
├── flake.nix
├── check.sh
└── ci.sh
```

- `check.sh` validates every package, path, and environment value required from the
  generated Playwright Nix environment, without reading or installing repository
  dependencies.
- `ci.sh` installs repository dependencies, validates the repository-local Playwright
  package, and runs the reusable Playwright workload.

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

Generate `nix/generated/playwright/ci.sh` with this shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

npm ci
test "$(npx playwright --version)" = "Version 1.59.1"
npx playwright test --browser=chromium
npx playwright test --browser=firefox
npx playwright test --browser=webkit
```

The Playwright version assertion intentionally runs after `npm ci`. At that point,
`npx playwright` resolves the repository's pinned `@playwright/test` package instead of
fetching an unrelated package from the network.

The reusable script must:

- be generated from a structured command list owned by the Playwright CI job;
- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve each command as readable script text instead of joining commands with `&&`;
- install dependencies before invoking repository-local tools;
- validate the configured Playwright version after dependency installation;
- end with a newline;
- remain a committed generated artifact so generator drift is caught by
  `npm run ci-update` and the existing generated-file check.

Changing only the pinned Node or Nixpkgs version must not change `ci.sh`. Changing the
pinned Playwright dependency should update its version assertion together with the
repository lockfiles.

### Nix validation script

Generate `nix/generated/playwright/check.sh` for checks that depend only on the
generated Playwright Nix environment:

```bash
#!/usr/bin/env bash
set -euo pipefail

test "$(node --version)" = "v26.5.1"
test -d "$PLAYWRIGHT_BROWSERS_PATH"
test "$PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD" = "1"
test "$PLAYWRIGHT_HOST_PLATFORM_OVERRIDE" = "ubuntu-24.04"
```

`check.sh` must not invoke `npm`, `npx`, or any package installed from the repository.
It validates the exact Node version supplied on `PATH`, the existence of the
Nix-provided browser bundle, and every Playwright environment value required by the
workload:

- `PLAYWRIGHT_BROWSERS_PATH` points to an existing Nix-provided browser directory;
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` prevents `npm ci` from downloading a duplicate
  browser bundle;
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu-24.04` makes Playwright select the
  Nix-provided WebKit build.

The expected Node version and Playwright environment values are generated from the same
configuration that generates `nix/generated/playwright/flake.nix`. Do not restate those
values in an independent source of truth. Changing any required Nix-provided value must
update both the flake and `check.sh`.

The separation makes these operations independently selectable:

```text
build or realize the Playwright Nix environment
validate it with nix/generated/playwright/check.sh
install dependencies and run the workload with nix/generated/playwright/ci.sh
```

Building or realizing the flake must not implicitly run either script. The Playwright CI
job should explicitly invoke both. A future image or cache workflow can build or
validate the same environment without installing dependencies or running tests.

### Generator design

Treat `nix/generated/<id>/` as the generated bundle for one CI environment. For the
Playwright job, the bundle contains its flake, environment-validation script, and
reusable workload script.

Keep the command sources separate:

- the reusable CI command list belongs to the Playwright job behavior and may reference
  repository configuration such as the pinned Playwright version;
- the validation command list is derived only from the Playwright Nix environment
  configuration, including all required environment values;
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

- the CI job owns dependency installation, repository-local checks, and its reusable
  test sequence;
- the Nix job owns the execution environment and expectations for Nix-provided
  packages, paths, and values;
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
- `ci.sh` running `npm ci` before its exact Playwright version assertion;
- `ci.sh` containing the Playwright version assertion and excluding the Node version
  assertion;
- `check.sh` containing the exact Node assertion, browser-directory check,
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, and
  `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu-24.04`;
- `check.sh` not invoking `npm`, `npx`, or repository-local tools;
- deleting or changing any required Playwright environment declaration causing the
  generated `check.sh` proof or runtime validation to fail;
- the `nix develop` workflow commands referencing the generated scripts without inline
  multi-command `bash -c` sequences;
- a Node- or Nixpkgs-only configuration change updating `flake.nix` and, when relevant,
  `check.sh` without changing `ci.sh`;
- a Playwright dependency change updating the `ci.sh` assertion;
- building or realizing the flake not executing either script.

Regenerate the committed files and verify:

- `npm run ci-update` produces no uncommitted generated changes;
- TypeScript checks pass;
- `check.sh` passes in a clean checkout before `npm ci` and fails when any required
  Playwright environment value is absent or incorrect;
- `ci.sh` installs dependencies, validates the pinned Playwright package, and passes all
  three browser suites through direct `nix develop`;
- `ci.sh` can be invoked directly in a compatible developer environment.

### Out of scope

- Docker or OCI execution of the generated scripts;
- publishing or caching scripts, Nix closures, or images;
- deciding how future image or cache workflows distribute the environment;
- renaming `nix/generated/` to `ci/` or making the output root configurable;
- migrating additional jobs to direct Nix;
- designing a general-purpose shell-language AST or escaping arbitrary untrusted shell
  fragments;
- changing the Playwright test sequence itself.

### Tasks

- [ ] Add an environment-independent reusable CI-script declaration.
- [ ] Generate `nix/generated/playwright/ci.sh` from the reusable command sequence.
- [ ] Generate `nix/generated/playwright/check.sh` from complete Nix-only validation
      commands.
- [ ] Add the Bash header, strict-mode line, readable commands, and final newline to both
      scripts.
- [ ] Move `npm ci`, the exact Playwright version assertion, and the browser tests into
      `ci.sh`, preserving that order.
- [ ] Validate the exact Node version, browser path, browser-download suppression, and
      host-platform override in `check.sh`.
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

- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and the
  current inline command sequence this task replaces.
