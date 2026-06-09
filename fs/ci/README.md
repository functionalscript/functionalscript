# Continuous integration workflow generator

This directory contains the FunctionalScript source that defines the GitHub Actions
workflow for this repository. Running the generator writes `.github/workflows/ci.yml`
with the latest matrix of jobs and steps.

## Files

- `module.f.ts` — the top-level pipeline definition. Exports `ci(setup: Setup)` which
  returns an `Effect<NodeOp, number>` that writes the workflow file. Rust support is
  detected automatically by checking for `Cargo.toml` at the repository root via the
  `access` effect.
- `proof.f.ts` — property-based proofs for the CI generator (Rust/no-Rust job presence,
  per-OS extra steps).
- `common/module.f.ts` — shared RTTI schemas and types (`Step`, `Job`, `Jobs`,
  `GitHubAction`, `MetaStep`, `Os`, `Architecture`), and step-builder helpers
  (`test`, `install`, `uses`, `clean`).
- `config/module.f.ts` — runner image matrix (OS × architecture → GitHub-hosted image name) and pinned tool/package versions, including the FunctionalScript package version used by generated smoke tests.
- `node/module.f.ts` — Node.js job steps: platform smoke tests, canonical
  per-version jobs, the TypeScript native preview (`tsgo`) step, coverage, and
  package checks.
- `rust/module.f.ts` — Rust toolchain setup and `cargo` build/test steps.
- `deno/module.f.ts` — Deno runtime steps.
- `bun/module.f.ts` — Bun runtime steps.
- `playwright/module.f.ts` — Playwright browser-test job.

## Usage

1. Ensure dependencies are installed with `npm ci`.
2. Regenerate the workflow definition:
   ```
   fjs ci
   ```
3. Commit the updated `.github/workflows/ci.yml` if it has changed.

The generator is idempotent — rerunning it without modifying the source produces the
same workflow file.

### Expected package scripts

The generated platform jobs run `npm ci`, install the pinned FunctionalScript
package globally, and run `fjs t`. Canonical Node jobs run on Ubuntu ARM and are
split by Node version:

- Node 22 runs `npm ci`, installs the pinned FunctionalScript package globally,
  and runs `fjs t`.
- Node 24 runs `npm ci` and `node --test`.
- Node 26 runs `npm ci`, `npx tsc`, `tsgo`, `npm run cov`, and `npm pack`.
- Playwright is also Node-based, so it runs `npm ci` before browser setup.

The command that must be provided by `package.json` for generated CI is `cov`.
A typical FunctionalScript project can define it like this:

```json
{
  "scripts": {
    "test": "tsc && fjs t",
    "cov": "node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts"
  }
}
```

Keep `npx tsc` passing independently because the generated CI runs it as its own
step before `tsgo`, coverage, and package creation. Keep `test` as the fast local
correctness loop even though generated CI no longer calls `npm test` directly.

For `node --test` and `npm run cov` to execute FunctionalScript proofs, the
repository must include a Node test entry file, conventionally `all.test.ts`:

```ts
import 'functionalscript/fs/emergent_testing/all.test.js'
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
