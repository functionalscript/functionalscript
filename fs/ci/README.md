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
- `config/module.f.ts` — runner image matrix (OS × architecture → GitHub-hosted image name).
- `node/module.f.ts` — Node.js job steps: `setup-node`, `npm ci`, basic test commands,
  per-version job matrix, and the TypeScript native preview (`tsgo`) step.
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

The generated Node CI jobs run these basic checks after `npm ci`:

- `npx tsc`
- `npm test` (`npm t` is npm's built-in alias)
- `node --test`
- `npm run cov`

The commands that must be provided by `package.json` are `test` and `cov`.
A typical FunctionalScript project can define them like this:

```json
{
  "scripts": {
    "test": "tsc && fjs t",
    "cov": "node --test --experimental-test-coverage --test-coverage-include=**/module.f.ts"
  }
}
```

Use `test` for the fast local correctness loop: TypeScript type-checking plus
FunctionalScript proofs. Use `cov` for Node's built-in test runner with coverage
enabled. Keep `npx tsc` passing independently because the generated CI runs it as
its own step before `npm test`.

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

## Customisation

`ci` accepts a `Setup` record to inject extra steps per runtime:

```ts
export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[]
    readonly denoExtra: readonly MetaStep[]
    readonly bunExtra: readonly MetaStep[]
}
```

`nodeExtra` receives the target OS so callers can conditionally add OS-specific steps.
Rust steps are included automatically when `Cargo.toml` is present; no flag is needed.
