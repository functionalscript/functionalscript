## CI: Package-Aware Deno and Bun Jobs

**Priority:** P3
**Status:** open

The CI generator should include Deno and Bun jobs only when the package uses those
runtimes.

This task is independent from browser testing. Playwright job selection belongs to the
browser-testing design and is not inferred from a repository `@playwright/test`
dependency.

### Rules

- **Deno job** — include the complete job entry only when `deno.lock` exists in the
  repository root.
- **Bun job** — include the complete job entry only when `bun.lock` exists in the
  repository root.

When a lockfile is absent, omit the corresponding key from the generated workflow's
`jobs` object. Do not create a checkout-only placeholder by passing an empty step list to
`ubuntu`, `ubuntuArm`, or another job builder.

When a lockfile is present, preserve the existing runtime setup, frozen installation,
test commands, runner image, and generated job identifier.

### Plan

- [ ] In `fjs/ci/module.f.mjs`, read the repository root for `deno.lock` and `bun.lock`
      through `access`, analogous to how `Cargo.toml` controls Rust jobs.
- [ ] Construct the canonical job map so the complete Deno entry is conditionally added
      only when `deno.lock` exists.
- [ ] Construct the canonical job map so the complete Bun entry is conditionally added
      only when `bun.lock` exists.
- [ ] Do not call a job builder with `[]` for an absent runtime.
- [ ] Update `fjs/ci/proof.f.mjs` to assert that each job key is absent without its
      lockfile and present with its lockfile.
- [ ] Verify the present-job proofs still cover the existing Deno and Bun steps and
      commands.
