## 65Z-ci-nix-job-script. Generate readable command scripts for Nix jobs

**Priority:** P3
**Status:** open

### Problem

A migrated Nix job currently passes its whole command sequence through one generated
workflow line:

```sh
nix develop ./nix/generated/playwright --command bash -euo pipefail -c 'command-1 && command-2 && ...'
```

`nixDevelopAll` joins the commands with `&&` and then embeds the result inside nested
YAML and shell quoting. The Playwright sequence already makes the generated
`.github/workflows/ci.yml` line difficult to read, review, copy, and debug. Adding more
checks or test commands will make that representation worse, even though the sequence
is simple when written as an ordinary script.

### Goal

Generate a Bash script next to the job's generated `flake.nix`, and make direct
`nix develop` execution invoke that file:

```text
nix/generated/playwright/
├── flake.nix
└── run.sh
```

The workflow command should become equivalent to:

```sh
nix develop ./nix/generated/playwright \
  --command bash ./nix/generated/playwright/run.sh
```

This task covers only direct `nix develop` execution. Do not add Docker, OCI-image, or
container invocation support here.

### Generated script

For the current Playwright job, generate a readable file with this shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

test "$(node --version)" = "v26.5.1"
npm ci
test "$(npx playwright --version)" = "Version 1.59.1"
npx playwright test --browser=chromium
npx playwright test --browser=firefox
npx playwright test --browser=webkit
```

Use a `.sh` filename because it is the conventional script extension, but explicitly
invoke it with `bash`. The shebang documents the interpreter for local use; invoking
`bash` from the workflow avoids making correctness depend on the executable file bit.

The script must:

- be generated from the same structured command list that defines the CI job;
- start with `#!/usr/bin/env bash` and `set -euo pipefail`;
- preserve each declared command as readable script text rather than joining commands
  with `&&`;
- end with a newline;
- remain a committed generated artifact, like `flake.nix`, so generator drift is caught
  by `npm run ci-update` and the existing generated-file check.

### Generator design

Extend the generated Nix-job declaration with an optional command sequence for jobs
that have migrated to direct Nix. The smallest expected shape is:

```ts
type NixJob = {
    readonly id: string
    readonly system: string
    readonly packages: readonly string[]
    readonly env?: StringMap<string, EnvValue>
    readonly shellHook?: string
    readonly commands?: readonly string[]
}
```

`nixFlakes` should continue generating `flake.nix` for every declared job and should
also generate `run.sh` when `commands` is present. Jobs that currently use their flakes
only for version checks do not need a script yet.

Move the Playwright command list into `playwrightNixJob.commands`, then replace the
current `nixDevelopAll(id, commands)` API with a helper that points `nix develop` at the
generated script. Keep the command sequence declared once; do not separately construct
script contents and workflow commands.

Name and exact helper signatures may change during implementation, but preserve these
boundaries:

- the job declaration owns its command sequence;
- the Nix generator owns both generated files;
- the workflow references the generated script by path;
- command quoting is handled by normal script serialization, not by embedding the whole
  sequence in one shell argument.

### Validation

Add proofs for:

- serialization of the Bash header and command sequence;
- the generated `run.sh` path;
- jobs without `commands` generating only `flake.nix`;
- the `nix develop` workflow command referencing `run.sh` without an inline `bash -c`
  command sequence;
- commands containing ordinary single and double quotes remaining unchanged in the
  generated script.

Regenerate the committed files and verify the Playwright job still passes all three
browser suites through direct `nix develop`.

### Out of scope

- Docker or OCI execution of the generated script;
- publishing or caching scripts, Nix closures, or images;
- migrating additional Node jobs to direct Nix;
- designing a general-purpose shell-language AST or escaping arbitrary untrusted shell
  fragments;
- changing the Playwright command sequence itself.

### Tasks

- [ ] Add an optional command sequence to the generated Nix-job declaration.
- [ ] Generate `nix/generated/<id>/run.sh` for jobs that declare commands.
- [ ] Add the Bash header, strict-mode line, readable commands, and final newline.
- [ ] Make the Playwright Nix job own its existing command sequence.
- [ ] Replace the inline `bash -euo pipefail -c '…'` workflow command with invocation of
      the generated script through `nix develop`.
- [ ] Remove the no-longer-needed whole-sequence `&&` joining and single-argument shell
      quoting helpers.
- [ ] Add generator and workflow proofs for the script behavior and quoting cases.
- [ ] Regenerate committed CI files and confirm `npm run ci-update`, TypeScript checks,
      and the Playwright CI job pass.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — generated per-job Nix architecture and update flow.
- [65Z-ci-nix-playwright](65z-ci-nix-playwright.md) — the first direct-Nix job and the
  current inline command sequence this task replaces.
