## Move TypeScript from npm devDependencies to the CI toolchain

**Priority:** P3
**Status:** open

### Problem

TypeScript is currently owned by the root `package.json` `devDependencies`. That makes the compiler an implicit dependency of every npm install, including runtime-compatibility jobs that do not type-check, and makes npm package metadata the source of the repository's compiler version.

TypeScript is a development/CI tool rather than a runtime package dependency. CI already owns versions of development tools and should own the TypeScript pin as well. This also decouples the TypeScript version from the Node/Deno/Bun runtime matrix so CI can change or add compiler-version checks independently of npm dependencies.

This is an ownership/decoupling change, not a CI-performance optimization justified by a timing benchmark. Avoiding TypeScript installation in jobs that do not use it is a direct consequence, not the acceptance criterion. The migration must not replace the npm pin with multiple independent compiler pins: every CI/development environment that needs TypeScript should derive the same version from the CI configuration.

Provision tools through installation/package-management tools. npm environments should install the configured TypeScript package with npm; Nix environments should package/install it through Nix's standard npm/package mechanisms. FunctionalScript CI must not reproduce TypeScript's dependency resolver by enumerating, fetching, or wiring platform-specific optional packages such as `@typescript/typescript-*` itself. Platform and transitive dependencies belong to npm/Nix.

This task is intentionally limited to TypeScript. Keep `@types/node` in `devDependencies`.

### Goal

Make the CI tool configuration the single repository-owned TypeScript version pin, provision that compiler only in environments that need it through their normal installation tooling, and remove `typescript` from the root `package.json` `devDependencies`.

Only environments that actually need TypeScript should receive the tool. In particular, Node 22, Node 24, Deno, and Bun jobs should not install TypeScript just because they install npm dependencies. The canonical type-checking job, its generated Node 26 Nix environment, packed-package check, and package publishing path do need the pinned compiler because they invoke `tsc` directly, provide the canonical development toolchain, validate declarations, or invoke it through npm lifecycle scripts such as `prepack`.

The Nix package must derive from the CI TypeScript version rather than silently taking whatever TypeScript version the pinned Nixpkgs snapshot happens to expose. Use a standard Nix mechanism for packaging an npm package (for example, the appropriate Nix npm-package builder) so Nix/npm resolves and verifies the complete dependency closure, including platform-specific optional dependencies. Any Nix dependency hash or generated package metadata should be produced as part of that standard packaging flow; do not maintain a FunctionalScript-specific list of TypeScript tarballs or platform packages.

Prefer migrating an environment to Nix before adding a separate npm-global install. The direct-Nix migration is tracked by [65Z-ci-nix](65z-ci-nix.md) and its concrete Node-job implementation [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md). A Nix migration must preserve the environment's existing isolation guarantees; in particular, `package-check` must remain a checkout-free packed-package consumer rather than gaining access to repository sources or `tsconfig.json` merely so it can reach a relative flake. If Nix cannot provide the compiler while preserving that isolation, install the CI-pinned TypeScript with npm inside the isolated consumer environment instead.

Local development must continue to support `tsc`, `npm test`, and `npm pack`. Outside an environment that provides the compiler, developers install the CI-pinned TypeScript globally with npm so `tsc` is available on `PATH`. Because a global tool is shared across checkouts, repository-owned checks that depend on TypeScript must verify the available compiler version against the current checkout's CI pin before using it. On mismatch, fail fast and print the exact `npm install -g typescript@<CI version>` command; do not silently run a compiler from another checkout and do not manually install platform dependencies.

### Tasks

- [ ] Add the single exact TypeScript version pin to the CI configuration. Do not introduce another repository-owned TypeScript version pin elsewhere.
- [ ] Extend the Nix tool model/generator to install that TypeScript version through a standard Nix npm-package mechanism. Let Nix/npm resolve and verify TypeScript's complete transitive/platform dependency closure; do not fetch or wire TypeScript platform packages manually.
- [ ] Add proofs for the Nix TypeScript tool generation, including version propagation and the generated Node 26 package set.
- [ ] Make the packed-package check read its compiler version from the CI configuration instead of `package.json` so removing `devDependencies.typescript` does not remove `package-check`; update the related proofs for the new pin source.
- [ ] Preserve `package-check` isolation. Prefer Nix only if the compiler can be supplied without checking out the repository or exposing repository `tsconfig.json`, sources, or `node_modules` to the packed-package consumer. Otherwise install `typescript@<CI version>` with npm inside the isolated consumer environment and expose that installation's `tsc`; npm, not CI code, resolves platform dependencies.
- [ ] Provision the configured TypeScript version in the canonical CI job that runs `tsc` (currently Node 26).
- [ ] Add the Nix-packaged TypeScript tool to the generated Node 26 environment (`nodeNixJobs`) so the canonical development shell provides `tsc`; update its proofs/generated-flake expectations. This extends the Node 26 migration tracked by [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).
- [ ] Prefer moving npm publishing to Nix first and provide TypeScript there so `prepack` uses the intended compiler during `npm publish`. Coordinate this with [668-ci-npm-publish-workflow](668-ci-npm-publish-workflow.md), which owns generation of the publish workflow. If publishing remains outside Nix, install the CI-pinned compiler with npm rather than manually assembling its files or dependencies.
- [ ] Run `tsc` from the environment-provided installation instead of relying on an implicit root `node_modules/.bin/tsc`.
- [ ] Add one repository-owned TypeScript version check derived from the CI pin and reuse it anywhere a checkout can reach an ambient/global `tsc` (including `npm test` and `prepack`/`npm pack`). The check must reject a mismatched compiler before type-checking and tell non-Nix developers to run `npm install -g typescript@<CI version>`; it must not download or assemble platform dependencies itself.
- [ ] Remove `typescript` from the root `package.json` `devDependencies`, then run `npm run update` so `package-lock.json`, `deno.lock`, `bun.lock`, and generated CI files are all regenerated consistently.
- [ ] Keep `@types/node` as a devDependency.
- [ ] Update repository-owned developer/check documentation, including `CONTRIBUTING.md`, `AGENTS.md`, `fjs/AGENTS.md`, and `fjs/ci/README.md`: list TypeScript as a developer tool where appropriate, document `npm install -g typescript@<CI version>` for non-Nix local development, explain that repository checks verify the global compiler against the checkout's CI pin, and replace required `npx tsc` instructions with `tsc` where the environment provides it.
- [ ] Update Docker and OpenAI Codex development setup so their documented `npm test` / `tsc` checks install the CI-pinned TypeScript through Nix or npm, without relying on the root devDependency or manually installing platform dependencies.
- [ ] Verify Node 22, Node 24, Deno, and Bun no longer install TypeScript unnecessarily and their frozen-lock installs still succeed.
- [ ] Verify the generated Node 26 Nix shell provides exactly the CI-configured TypeScript version and can run the canonical type-check/package commands without a local TypeScript devDependency.
- [ ] Verify changing the CI TypeScript version does not require changing the Node version or manually updating a platform-package list.
- [ ] Verify `package-check` remains checkout-free and uses the CI-configured TypeScript installation without falling back to an unrelated ambient compiler.
- [ ] Verify switching between checkouts with different CI TypeScript pins cannot make `npm test`/`npm pack` silently use the wrong global compiler.
- [ ] Verify every environment uses the CI-configured TypeScript version rather than maintaining an independent pin.
- [ ] Verify `tsc`, `npm test`, `npm pack`, and the npm publish path work in every environment that is documented or responsible for those checks.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture and direct CI execution.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete Node 22/24/26 Nix migration, including the generated Node 26 environment this task extends.
- [668-ci-npm-publish-workflow](668-ci-npm-publish-workflow.md) — generation of the npm publishing workflow; relevant if publishing moves to Nix before the TypeScript dependency is removed.
