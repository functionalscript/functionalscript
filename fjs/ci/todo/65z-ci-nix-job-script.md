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

The test sequence should not belong to the Nix environment declaration. A Node or
Playwright version bump should update the flake and its validation, while leaving the
same test script to run against the new tools. Keeping those concerns separate also
allows a future image or cache job to build the environment without running tests.

### Goal

Generate a committed, reusable Bash script for each CI job that needs a multi-command
sequence. The script describes the repository work, independently of how its execution
environment is provided.

For Playwright, use a path equivalent to:

```text
fjs/ci/generated/playwright.sh
```

The direct-Nix workflow should enter the generated development shell and point Bash at
that script:

```sh
nix develop ./nix/generated/playwright \
  --command bash ./fjs/ci/generated/playwright.sh
```

A developer with a compatible environment should also be able to run the same script
directly:

```sh
bash ./fjs/ci/generated/playwright.sh
```

This task covers direct `nix develop` execution only. Do not add Docker, OCI-image,
cache, or publication support here.

### Reusable job script

For the current Playwright job, generate a readable script with this shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

npm ci
npx playwright test --browser=chromium
npx playwright test --browser=firefox
npx playwright test --browser=webkit
```

The script intentionally does not contain exact Node or Playwright version assertions.
Those assertions validate the generated Nix environment and belong to separate Nix
validation.

Use a `.sh` filename because it is the conventional script extension, but explicitly
invoke it with `bash`. The shebang documents the interpreter for direct developer use;
invoking `bash` from the workflow avoids making correctness depend on the executable
file bit.

The script must:

- be generated from a structured command list owned by the CI job, not by `NixJob`;
- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve each command as readable script text instead of joining commands with `&&`;
- end with a newline;
- contain only the job's reusable work, not provider-specific environment validation;
- remain a committed generated artifact so generator drift is caught by
  `npm run ci-update` and the existing generated-file check.

### Separate Nix validation

Keep the Nix environment declaration focused on packages, environment variables, and
other environment construction. Do not add the Playwright test commands to `NixJob`.

The exact Node and Playwright version checks must remain available as separate Nix
validation. They may be represented by a small generated validation script or by a
short dedicated workflow command, but they must not be duplicated in the reusable job
script.

The separation should make these operations independently selectable:

```text
build or realize Nix environment
validate Nix environment
run reusable CI job script inside Nix environment
```

Building or realizing the flake must not implicitly run either validation or tests.
The Playwright CI job should explicitly validate the environment and run the reusable
script. A future image or cache workflow can build the same environment without running
the test script.

### Generator design

Introduce a script declaration independent of `NixJob`. The smallest expected shape is
similar to:

```ts
type CiScript = {
    readonly id: string
    readonly commands: readonly string[]
}
```

The existing Playwright command list should become the source of
`fjs/ci/generated/playwright.sh`. Its exact Node and Playwright version assertions stay
with Nix validation rather than moving into this list.

The generator should:

- serialize the reusable script into `fjs/ci/generated/<id>.sh`;
- keep `NixJob` independent of the test command sequence;
- provide a helper that invokes a generated script through `nix develop`;
- let non-Nix execution reference the same generated script path;
- avoid separately constructing script contents and workflow test commands.

Name and exact helper signatures may change during implementation, but preserve these
boundaries:

- the CI job owns its reusable command sequence;
- the script generator owns the committed Bash file;
- the Nix job owns only the execution environment and its validation;
- the workflow chooses when to validate and when to run the script;
- normal script serialization replaces whole-sequence shell quoting.

### Validation

Add proofs for:

- serialization of the Bash header and command sequence;
- the generated reusable-script path;
- commands containing ordinary single and double quotes remaining unchanged;
- the Playwright script excluding Node and Playwright version assertions;
- the Nix validation retaining both exact version checks;
- the `nix develop` workflow command referencing the generated script without an inline
  multi-command `bash -c` sequence;
- a version-only configuration change not changing the reusable test script.

Regenerate the committed files and verify:

- `npm run ci-update` produces no uncommitted generated changes;
- TypeScript checks pass;
- the Nix environment validation passes;
- the Playwright script still passes all three browser suites through direct
  `nix develop`;
- the generated Playwright script can be invoked directly in a compatible developer
  environment.

### Out of scope

- Docker or OCI execution of the generated script;
- publishing or caching scripts, Nix closures, or images;
- deciding how future image or cache workflows distribute the environment;
- migrating additional Node jobs to direct Nix;
- designing a general-purpose shell-language AST or escaping arbitrary untrusted shell
  fragments;
- changing the Playwright test sequence itself.

### Tasks

- [ ] Add an environment-independent CI-script declaration.
- [ ] Generate `fjs/ci/generated/<id>.sh` from each declared command sequence.
- [ ] Add the Bash header, strict-mode line, readable commands, and final newline.
- [ ] Move the Playwright install-and-test sequence into its reusable script declaration.
- [ ] Keep exact Node and Playwright version checks in separate Nix validation.
- [ ] Make the Playwright direct-Nix workflow explicitly validate the environment and
      then invoke the generated reusable script.
- [ ] Remove the no-longer-needed whole-sequence `&&` joining and single-argument shell
      quoting helpers.
- [ ] Add generator, validation, and workflow proofs for the separated behavior.
- [ ] Regenerate committed CI files and confirm update checks, TypeScript checks, Nix
      validation, direct script execution, and the Playwright CI job pass.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and the
  current inline command sequence this task replaces.
