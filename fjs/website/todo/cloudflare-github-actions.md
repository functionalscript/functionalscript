## Build and deploy Cloudflare from GitHub Actions

**Priority:** P3
**Status:** wip

### Problem

The website is built by Cloudflare Workers Builds, outside the repository's
mise development environment. Its generated build script installs Rust before
building the WASM demos, Rust API documentation and website. GitHub Actions
already provides the repository's pinned development environment.

The owner requested moving the Cloudflare build and deployment to GitHub CI,
with a separate job, and recording the work in a TODO in the first PR.

### Proposal

Add a dedicated website build and deployment job through the workflow generator
in [`fjs/ci`](../../ci/README.md). Keep it separate from the platform test
matrix; do not repeat deployment on every platform. Use the committed mise
manifest and lock for the build tools.

Preserve the existing WASM demos, styled Rust API documentation, website assets
and GitHub sign-in behavior. The current build sequence is documented in
[the website README](../README.md#the-build-command). Keep publishing from the
repository root as configured in [`wrangler.jsonc`](../../../wrangler.jsonc).

The proposed deployment policy is production on `main` after required checks
pass, with version previews for trusted repository branches. Fork pull requests
run checks without deployment credentials. Preserve preview branch aliases,
commit and branch metadata, and the OAuth callback behavior; moving hosts must
not silently remove these features.

Use a scoped Cloudflare API token held in GitHub Actions secrets, with deployment
credentials available only to trusted deployment steps. Preserve the existing
Worker bindings and encrypted app secret handling. Verify the replacement before
disabling Workers Builds so the transition does not leave competing deployments.

### Build job

The first implementation adds a read-only `website` job to the existing CI
workflow's pull-request and merge-group events. It runs independently of the
test matrix, reuses workflow concurrency, and does not use the successful-check
cache. The build runs with no deployment credentials, including on fork pull
requests. The generator receives the checked-out SHA and source branch through
the existing `WORKERS_CI_*` metadata variables.

Deployment triggers, dependencies on required checks, preview policy and Wrangler
pinning remain the next decision before adding uploads. Workers Builds stays
active during this build-only step.

### Tasks

- [ ] Implement gated Wrangler deployment after CI checks, with production and
      trusted-branch preview uploads, pinned tooling and documented cutover.

- [ ] Settle the job's triggers, dependencies on required checks, preview policy,
      concurrency and permissions. Confirm the Wrangler invocation and pin under
      [the external-tool policy](../../../AGENTS.md#6-external-tools).
- [x] Add the dedicated job to the CI generator and its proofs, regenerate the
      workflows, and build WASM demos, styled Rust documentation and the website
      using the pinned development environment.
- [ ] Add production deployment and trusted-branch preview uploads, preserving
      aliases, build metadata and GitHub sign-in bindings. Document required
      GitHub secrets and variables, including the Cloudflare account and token.
- [ ] Validate generated-workflow consistency and build output, then verify a
      branch preview and production deployment with the configured credentials.
      Check assets, Rust documentation, demos and GitHub sign-in.
- [ ] Document the GitHub Actions setup and cutover/rollback procedure, reconcile
      the old Cloudflare-only build script and Node pin with their remaining
      consumers, update related documentation, and disable Workers Builds after
      the replacement is verified. Delete this TODO when the migration ships.

### Related

- [Run `cargo doc` in the site build](./cargo-doc-build-host.md): the existing
  Rust documentation build must move with the site; its remaining Deno
  documentation work stays tracked there.
