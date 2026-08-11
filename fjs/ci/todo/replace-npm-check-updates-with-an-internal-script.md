## Replace npm-check-updates with an Internal Script

**Priority:** P3
**Status:** open

The `update` script used to call `npx npm-check-updates -u` to bump dependency versions; that third-party dependency was dropped, so `package.json` devDependency bumps are manual for now. Replace the manual step with an internal FunctionalScript script so version bumps are automated again without a runtime dependency on an external tool.

### Idea: `ci-lock.json`

Introduce a `ci-lock.json` file in each repo root that pins all CI tool versions (Node, Deno, Bun, TSGO, Wasmtime, Wasmer, runner images, GitHub Action versions). This replaces the hardcoded `fjs/ci/config/module.f.mjs` inside the FunctionalScript package, giving every repo that uses `fjs ci` its own updatable lock file for CI tooling — analogous to `package-lock.json` for npm deps.

The internal update script would:
1. Fetch latest versions of npm devDependencies from the registry → write `package.json` + `package-lock.json`.
2. Fetch latest versions of CI tools (Deno, Bun, Node LTS, TSGO, etc.) from their respective registries/APIs → write `ci-lock.json`.
3. Run `deno install`, `bun install`, `npm run ci-update` to propagate everything.

### Plan

- [ ] Define the `ci-lock.json` schema (tool versions + runner images + action versions).
- [ ] Implement `fjs update` (or `fjs u`) subcommand that updates `package.json` deps and `ci-lock.json` tool versions.
- [ ] Update `fjs/ci/module.f.mjs` to read `ci-lock.json` instead of importing `fjs/ci/config/module.f.mjs`.
- [ ] Bootstrap: generate a default `ci-lock.json` from the current `fjs/ci/config/module.f.mjs` values.
- [ ] Wire `fjs u` (or equivalent) into the `update` script so dependency bumps are automated again.
