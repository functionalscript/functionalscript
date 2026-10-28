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

Production runs in the separate generated `gen.website.yml` workflow on pushes
to `main`, after required checks and review through the merge queue. PR-only
CI retains previews for same-repository PRs, including drafts; forks and merge
groups build without uploading. The dedicated website job is independent of
the platform matrix. Both workflows use the pinned mise build steps and scope
the sole `CLOUDFLARE_API_TOKEN` secret to uploads. Existing Worker bindings are
preserved. Preview aliases retain `actions-` while Workers Builds is active, preventing
competing uploads from sharing preview aliases. Remove the prefix only in a
separate cleanup PR after the production cutover is verified.

Keep Workers Builds enabled during review. Disable it immediately before
merging the production workflow PR, then verify the first main deployment.
The legacy build script remains for rollback. See
[the cutover procedure](../README.md#github-actions-deployment).

### Tasks

- [x] Settle the job's triggers, dependencies on required checks, preview policy,
      concurrency and permissions. Confirm the Wrangler invocation and pin under
      [the external-tool policy](../../../AGENTS.md#6-external-tools).
- [x] Add the dedicated job to the CI generator and its proofs, regenerate the
      workflows, and build WASM demos, styled Rust documentation and the website
      using the pinned development environment.
- [x] Add automatic trusted-branch preview uploads, preserving
      aliases, build metadata and GitHub sign-in bindings. Document required
      GitHub secrets and variables, including the Cloudflare account and token.
- [x] Prepare a separate production deployment workflow for `main`; disable
      Workers Builds immediately before merging it.
- [ ] Validate generated-workflow consistency and build output, then verify a
      branch preview and production deployment with the configured credentials.
      Check assets, Rust documentation, demos and GitHub sign-in.
- [ ] Remove the temporary `actions-` preview-alias prefix after verified cutover.
- [ ] Document the GitHub Actions setup and cutover/rollback procedure, reconcile
      the old Cloudflare-only build script and Node pin with their remaining
      consumers, update related documentation, and disable Workers Builds after
      the replacement is verified. Delete this TODO when the migration ships.

### Related

- [Run `cargo doc` in the site build](./cargo-doc-build-host.md): the existing
  Rust documentation build must move with the site; its remaining Deno
  documentation work stays tracked there.

