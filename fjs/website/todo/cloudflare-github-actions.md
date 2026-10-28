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
commit and branch metadata, and the OAuth callback behavior. During validation,
Actions previews temporarily use an `actions-` alias prefix to distinguish them
from Workers Builds; remove it after cutover. Moving hosts must
not silently remove these features.

Use a scoped Cloudflare API token held in GitHub Actions secrets, with deployment
credentials available only to trusted deployment steps. Preserve the existing
Worker bindings and encrypted app secret handling. Verify the replacement before
disabling Workers Builds so the transition does not leave competing deployments.

### Build job

The `website` job runs on repository branch pushes, fork pull requests and
merge-group entries. Same-repository pull-request runs skip this job to avoid
duplicating their branch's push build. It runs independently of the platform matrix and test jobs,
reuses workflow concurrency, and builds outside the successful-check
cache. Build steps receive no deployment credentials. The generator receives
the checked-out SHA and source branch through the existing `WORKERS_CI_*`
metadata variables.

Every non-`main` repository branch push uploads a preview with Wrangler 4.74.0
and `versions upload --preview-alias` after its own successful website build.
Pull requests and merge-group entries never upload. No enable-switch variables
are used. Production uploads are omitted from the workflow until debugging is
complete and Workers Builds is disabled. The API token is scoped to the upload
step. The account ID is committed in `wrangler.jsonc`; its `keep_vars` setting
and Wrangler's secret inheritance reuse existing Worker bindings. Actions needs
only the API-token secret and sends no empty OAuth overrides. The legacy
Workers Builds helper keeps its explicit bindings during the transition.

Workers Builds stays active until live verification and cutover. Setup,
branch-alias rules, cutover and rollback are documented in
[GitHub Actions deployment](../README.md#github-actions-deployment).

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
- [ ] After debugging previews and disabling Workers Builds, add production
      deployment on `main` in a follow-up PR. Keep it absent until then.
- [ ] Validate generated-workflow consistency and build output, then verify a
      branch preview and production deployment with the configured credentials.
      Check assets, Rust documentation, demos and GitHub sign-in.
- [ ] Remove the temporary `actions-` preview-alias prefix after cutover.
- [ ] Document the GitHub Actions setup and cutover/rollback procedure, reconcile
      the old Cloudflare-only build script and Node pin with their remaining
      consumers, update related documentation, and disable Workers Builds after
      the replacement is verified. Delete this TODO when the migration ships.

### Related

- [Run `cargo doc` in the site build](./cargo-doc-build-host.md): the existing
  Rust documentation build must move with the site; its remaining Deno
  documentation work stays tracked there.

