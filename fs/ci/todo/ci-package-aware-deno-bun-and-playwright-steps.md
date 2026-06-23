## CI: Package-Aware Deno, Bun, and Playwright Steps

**Priority:** P3
**Status:** open

The CI generator should opt in to Deno, Bun, and Playwright steps based on what the package actually uses, rather than always including or excluding them.

### Rules

- **Deno steps** — include only if `deno.lock` exists in the repo root.
- **Bun steps** — include only if `bun.lock` exists in the repo root.
- **Playwright steps** — include if `@playwright/test` is listed in `devDependencies` (already partially done via `playwrightJob`; make it conditional on presence in `package.json`).

### Plan

- [ ] In `fs/ci/module.f.ts`, read the repo root for `deno.lock` and `bun.lock` (via `access`) and pass the results to the job builder, analogous to how `Cargo.toml` controls Rust steps.
- [ ] Skip `denoSteps` when `deno.lock` is absent; skip `bunSteps` when `bun.lock` is absent.
- [ ] Make `playwrightJob` conditional on `@playwright/test` appearing in `devDependencies` of `package.json`.
- [ ] Update `fs/ci/proof.f.ts` to cover the new conditional logic.
