## Move TypeScript from npm devDependencies to the CI toolchain

**Priority:** P3
**Status:** open

### Problem

TypeScript is currently installed through the root `package.json` `devDependencies`, so every `npm ci` installs it even in CI jobs that do not run `tsc`.

TypeScript is a development/CI tool rather than a runtime package dependency. CI already has infrastructure for pinning and provisioning tool versions, so TypeScript should be owned there instead of by npm package metadata.

This task is intentionally limited to TypeScript. Keep `@types/node` in `devDependencies`.

### Goal

Provision a pinned TypeScript version through the CI tool environment and remove `typescript` from the root `package.json` `devDependencies`.

Only jobs that actually run TypeScript need the tool. In particular, Node 22, Node 24, Deno, and Bun jobs should not install TypeScript just because they install npm dependencies.

Local development must continue to support `tsc`, `npm test`, and `npm pack`: outside an environment that provides the compiler, developers install the pinned TypeScript globally so `tsc` is available on `PATH`.

### Tasks

- [ ] Add a pinned TypeScript version to the CI tool configuration.
- [ ] Provision that TypeScript version only in the canonical CI job that runs `tsc` (currently Node 26).
- [ ] Run `tsc` from `PATH` instead of relying on `npx tsc` / `node_modules/.bin/tsc`.
- [ ] Remove `typescript` from the root `package.json` `devDependencies` and update `package-lock.json`.
- [ ] Keep `@types/node` as a devDependency.
- [ ] Update `CONTRIBUTING.md` to list TypeScript as a developer tool, document installing the pinned version globally for local development, and replace `npx tsc` instructions with `tsc`.
- [ ] Update the Docker and OpenAI Codex development setup so their documented `npm test` / `tsc` checks have the pinned TypeScript on `PATH` without relying on the root devDependency.
- [ ] Verify Node 22, Node 24, Deno, and Bun no longer install TypeScript unnecessarily.
- [ ] Verify `tsc`, `npm test`, and `npm pack` work in every documented development environment.
