# Continuous integration workflow generator

This directory contains the FunctionalScript source that defines the GitHub Actions
workflow for this repository. Running the generator writes `.github/workflows/ci.yml`
with the latest matrix of jobs and steps, plus one Nix development environment per
canonical Node job under `nix/generated/`.

## Files

- `module.f.ts` — the top-level pipeline definition. Exports `ci(setup: Setup)` which
  returns an `Effect<NodeOp, number>` that writes the workflow file. Rust support is
  detected automatically by checking for `Cargo.toml` at the repository root via the
  `access` effect.
- `proof.f.ts` — property-based proofs for the CI generator (Rust/no-Rust job presence,
  per-OS extra steps).
- `common/module.f.ts` — shared RTTI schemas and types (`Step`, `Job`, `Jobs`,
  `GitHubAction`, `MetaStep`, `Os`, `Architecture`), and step-builder helpers
  (`test`, `install`, `uses`).
- `config/module.f.ts` — runner image matrix (OS × architecture → GitHub-hosted image name) and pinned tool/package versions, including the FunctionalScript package version used by generated smoke tests and the exact Nixpkgs commit the generated flakes pin.
- `nix/module.f.ts` — writes one self-contained `nix/generated/<job>/flake.nix`
  per declared job, using the Nix eDSL in `fjs/media/nix`.
- `node/module.f.ts` — Node.js job steps: platform smoke tests, canonical
  per-version jobs, coverage, package checks, and the Node flake declarations.
- `rust/module.f.ts` — Rust toolchain setup and `cargo` build/test steps.
- `deno/module.f.ts` — Deno runtime steps.
- `bun/module.f.ts` — Bun runtime steps.
- `playwright/module.f.ts` — Playwright browser-test job.

## Usage

1. Ensure dependencies are installed with `npm ci`.
2. Regenerate the workflow definition and the Nix environments:
   ```
   fjs ci
   ```
3. Commit the updated `.github/workflows/ci.yml` and `nix/generated/**/flake.nix`
   files if they have changed.

The generator is idempotent — rerunning it without modifying the source produces the
same files. It never runs Nix itself, so it stays Windows-compatible: the flakes are
plain text built from the pinned commit in `config/module.f.ts`.

### Generated Nix environments

Each canonical Node job declares a system and its Nixpkgs package attribute in
`node/module.f.ts` (`nodeNixJobs`), and `nix/module.f.ts` writes it out as one
static `flake.nix` exposing `devShells.<system>.default`. Node 22 also declares a
job-local `shellHook` that points `npm install -g` at `$HOME/.npm-global`, so the
installed `fjs` stays on `PATH` for the rest of the same `nix develop` invocation.
See [nix/README.md](../../nix/README.md) for how the generated files are meant to be
consumed.

Every runtime uses the same Node versions. `config/module.f.ts` records the versions
the pinned Nixpkgs snapshot provides — not the latest nodejs.org release, which the
snapshot usually trails — and those feed both `setup-node` on the GitHub-hosted
runners and the flakes' package attributes. Each generated flake then asserts the
version it actually gets:

```nix
assert pkgs.nodejs_24.version == "24.18.0";
```

so a snapshot whose Node moved fails evaluation instead of quietly giving a Nix job a
different runtime from the Windows and macOS jobs. Bumping a Node version therefore
means moving the Nixpkgs commit first and copying the versions it offers.

The temporary `nix-flakes` job installs Nix through a pinned action and checks each
generated flake with
`test "$(nix develop <flake> --command node --version)" = v<version>`, so both a
flake that stops evaluating and a shell that provides the wrong Node fail CI. It is
deliberately separate from `node22`/`node24`/`node26`, which keep their `setup-node`
runtime until they are migrated one at a time; delete the job once they all run
through `nix develop`.

### Expected package scripts

The generated platform jobs run `npm ci`, install the pinned FunctionalScript
package globally, and run `fjs t`. Canonical Node jobs run on Ubuntu ARM and are
split by Node version:

- Node 22 runs `npm ci`, installs the pinned FunctionalScript package globally,
  and runs `fjs t`.
- Node 24 runs `npm ci` and `node --test`.
- Node 26 runs `npm ci`, `npm run ci-update`, `git add -A && git diff --cached --exit-code`,
  `npx tsc`, `npm run cov`, and `npm pack`.
- Playwright is also Node-based, so it runs `npm ci` before browser setup.

The commands that must be provided by `package.json` for generated CI are `cov`
and `ci-update`. A typical FunctionalScript project can define them like this:

```json
{
  "scripts": {
    "test": "tsc && fjs t",
    "cov": "node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts",
    "ci-update": "fjs ci"
  }
}
```

`ci-update` must regenerate every generated file the project keeps in Git —
today `.github/workflows/ci.yml`, with more (e.g. generated Rust sources)
planned. The Node 26 job runs it right after `npm ci` and fails via
`git add -A && git diff --cached --exit-code` when the committed tree no longer
matches the generator's output, so forgetting to regenerate after changing a
generator breaks the build instead of silently using stale files. Staging with
`git add -A` before diffing makes the check cover newly created and deleted
generated files, not just modified ones — a plain `git diff` never reports
untracked files. Because the job runs `npm ci` first, `fjs ci` resolves the
project's own `functionalscript` devDependency; this repository instead uses
its checked-in sources (`node ./fjs/module.ts ci`), so the check always reflects
the generator being reviewed, not the pinned published release.

Keep `npx tsc` passing independently because the generated CI runs it as its own
step before coverage and package creation. Keep `test` as the fast local
correctness loop even though generated CI no longer calls `npm test` directly.

For `node --test` and `npm run cov` to execute FunctionalScript proofs, the
repository must include a Node test entry file, conventionally `all.test.ts`:

```ts
import 'functionalscript/fjs/emergent_testing/all.test.js'
```

Without that file, third-party test runners discover no FunctionalScript proofs
and will report zero tests. `fjs t` is the exception: it discovers proof modules
directly and does not need `all.test.ts`.

**Note,** `npm run ci-update` in this repository runs the same built-in command through the
checked-in Node entry point, which avoids relying on the package bin before the
package has been installed. Custom projects that need different runtime setup steps
should use `fjs r <custom-ci-module>` and call `ci(setup)` directly instead of
modifying the built-in command.

The built-in command does not read `package.json` to customize generated steps.
The FunctionalScript package version used by generated Node, Deno, and Bun smoke
tests is pinned in `config/module.f.ts`, not read from `package.json`.

## Customisation

`ci` accepts a `Setup` record to inject extra steps per runtime:

```ts
export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[]
}
```

`nodeExtra` receives the target OS so callers can conditionally add OS-specific steps.
Rust steps are included automatically when `Cargo.toml` is present; no flag is needed.
