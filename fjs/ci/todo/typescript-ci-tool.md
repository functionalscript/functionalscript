## Move TypeScript from npm devDependencies to the CI toolchain

**Priority:** P3
**Status:** open

### Problem

TypeScript is a development/CI tool, but its version is currently owned by the root `package.json` `devDependencies`. As a result, every npm install gets the compiler, including runtime-compatibility jobs that do not type-check.

### Decision

The CI tool configuration owns the TypeScript version. Environments that need TypeScript install that version through their normal tool manager: Nix in Nix environments and npm otherwise. Do not reproduce TypeScript's dependency resolution or platform-package selection in FunctionalScript CI code.

Only environments that use TypeScript should install it. This includes the canonical type-checking environment, packed-package validation, npm publishing because `prepack` runs `tsc`, and documented developer environments. Node 22/24, Deno, and Bun runtime jobs should not install TypeScript merely because they install npm dependencies.

Repository checks must use the CI-configured TypeScript version rather than an unrelated ambient compiler. The implementation may choose how to expose or validate `tsc`; that mechanism is not part of this design.

Keep `@types/node` in `devDependencies`. Preserve the checkout-free isolation of `package-check`.

### Tasks

- [ ] Move the TypeScript version pin to the CI tool configuration and make TypeScript-using jobs derive from it, including `package-check`.
- [ ] Provision TypeScript through Nix/npm in the environments that need it, including Node 26, `package-check`, and npm publishing; preserve `package-check` isolation.
- [ ] Remove `typescript` from the root `devDependencies` and run `npm run update` so npm, Deno, Bun, and generated CI state remain consistent.
- [ ] Update developer documentation and required commands: Nix environments provide TypeScript; non-Nix developers install the CI-pinned version globally with npm; required checks use the environment-provided compiler rather than `npx tsc`.
- [ ] Verify TypeScript is absent from runtime-only jobs and that type-check, pack/package validation, and publish paths use the configured version.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — Node CI Nix migration.
- [668-ci-npm-publish-workflow](668-ci-npm-publish-workflow.md) — npm publishing workflow generation.
