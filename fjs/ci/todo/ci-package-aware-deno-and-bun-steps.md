## CI: Package-Aware Deno and Bun Steps

**Priority:** P3
**Status:** open

The CI generator should opt in to Deno and Bun steps based on what the package actually
uses, rather than always including or excluding them.

This task is independent from browser testing. Playwright job selection belongs to the
browser-testing design and is not inferred from a repository `@playwright/test`
dependency.

### Rules

- **Deno steps** — include only if `deno.lock` exists in the repository root.
- **Bun steps** — include only if `bun.lock` exists in the repository root.

### Plan

- [ ] In `fjs/ci/module.f.ts`, read the repository root for `deno.lock` and `bun.lock`
      through `access`, and pass the results to the job builder, analogous to how
      `Cargo.toml` controls Rust steps.
- [ ] Skip `denoSteps` when `deno.lock` is absent.
- [ ] Skip `bunSteps` when `bun.lock` is absent.
- [ ] Update `fjs/ci/proof.f.ts` to cover the Deno and Bun conditional logic.
