## Move TypeScript from npm devDependencies to the CI toolchain

**Priority:** P3
**Status:** open

### Problem

TypeScript is currently installed through the root `package.json` `devDependencies`, so every `npm ci` installs it even in CI jobs that do not run `tsc`.

TypeScript is a development/CI tool rather than a runtime package dependency. CI already has infrastructure for pinning and provisioning tool versions, so TypeScript should be owned there instead of by npm package metadata.

This task is intentionally limited to TypeScript. Keep `@types/node` in `devDependencies`.

### Goal

Provision a pinned TypeScript version through the CI tool environment and remove `typescript` from the root `package.json` `devDependencies`.

Only environments that actually need TypeScript should receive the tool. In particular, Node 22, Node 24, Deno, and Bun jobs should not install TypeScript just because they install npm dependencies. The canonical type-checking job, its generated Node 26 Nix environment, packed-package check, and package publishing path do need the pinned compiler because they invoke `tsc` directly, provide the canonical development toolchain, install it for declaration validation, or invoke it through npm lifecycle scripts such as `prepack`.

Prefer migrating an environment to Nix before adding an npm/global-install or manual `PATH` workaround. The direct-Nix migration is tracked by [65Z-ci-nix](65z-ci-nix.md) and its concrete Node-job implementation [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md). A Nix migration must preserve the environment's existing isolation guarantees; in particular, `package-check` must remain a checkout-free packed-package consumer rather than gaining access to repository sources or `tsconfig.json` merely so it can reach a relative flake. If Nix cannot provide the compiler while preserving that isolation, keep explicit pinned `PATH` provisioning for that job instead.

Local development must continue to support `tsc`, `npm test`, and `npm pack`: outside an environment that provides the compiler, developers install the pinned TypeScript globally so `tsc` is available on `PATH`.

### Tasks

- [ ] Add a pinned TypeScript version to the CI tool configuration.
- [ ] Make the packed-package check read its compiler pin from that CI configuration instead of `package.json` so removing `devDependencies.typescript` does not remove `package-check`; update the related proofs for the new pin source.
- [ ] Preserve `package-check` isolation. Prefer Nix only if the pinned compiler can be supplied without checking out the repository or exposing repository `tsconfig.json`, sources, or `node_modules` to the packed-package consumer (for example, through an isolated Nix environment available independently of the checkout). Otherwise provision the pinned TypeScript explicitly on `PATH` and change the check from `npx tsc` to `tsc`; verify it cannot fall back to an unrelated ambient compiler.
- [ ] Provision that TypeScript version in the canonical CI job that runs `tsc` (currently Node 26).
- [ ] Add the pinned TypeScript package to the generated Node 26 Nix environment (`nodeNixJobs`) so the canonical development shell provides `tsc`; update its proofs/generated-flake expectations. This extends the Node 26 migration tracked by [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md).
- [ ] Prefer moving npm publishing to Nix first and provide the pinned TypeScript there so `prepack` uses the intended compiler during `npm publish`. Coordinate this with [668-ci-npm-publish-workflow](668-ci-npm-publish-workflow.md), which owns generation of the publish workflow. Only add a separate compiler-install step if publishing remains outside Nix.
- [ ] Run `tsc` from `PATH` instead of relying on `npx tsc` / `node_modules/.bin/tsc`.
- [ ] Remove `typescript` from the root `package.json` `devDependencies`, then run `npm run update` so `package-lock.json`, `deno.lock`, `bun.lock`, and generated CI files are all regenerated consistently.
- [ ] Keep `@types/node` as a devDependency.
- [ ] Update repository-owned developer/check documentation, including `CONTRIBUTING.md`, `AGENTS.md`, `fjs/AGENTS.md`, and `fjs/ci/README.md`: list TypeScript as a developer tool where appropriate, document installing the pinned version globally for local development, and replace required `npx tsc` instructions with `tsc`.
- [ ] Update the Docker and OpenAI Codex development setup so their documented `npm test` / `tsc` checks have the pinned TypeScript on `PATH` without relying on the root devDependency.
- [ ] Verify Node 22, Node 24, Deno, and Bun no longer install TypeScript unnecessarily and their frozen-lock installs still succeed.
- [ ] Verify the generated Node 26 Nix shell provides the pinned `tsc` and can run the canonical type-check/package commands without a local TypeScript devDependency.
- [ ] Verify `package-check` remains checkout-free and validates only the packed declarations with the CI-configured compiler pin and intended `tsc` on `PATH`.
- [ ] Verify `tsc`, `npm test`, `npm pack`, and the npm publish path work in every environment that is documented or responsible for those checks.

### Related

- [65Z-ci-nix](65z-ci-nix.md) — declarative per-job Nix architecture and direct CI execution.
- [66B-dockerfile-nix-integration](66b-dockerfile-nix-integration.md) — concrete Node 22/24/26 Nix migration, including the generated Node 26 environment this task extends.
- [668-ci-npm-publish-workflow](668-ci-npm-publish-workflow.md) — generation of the npm publishing workflow; relevant if publishing moves to Nix before the TypeScript dependency is removed.
