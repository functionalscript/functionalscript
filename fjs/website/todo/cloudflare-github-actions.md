## Build and deploy Cloudflare from GitHub Actions

**Priority:** P3
**Status:** wip

The owner verified GitHub sign-in on the Actions preview and disconnected
Workers Builds. Production now uses the existing website job on main pushes;
verify the first production deployment after merging this change.

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
pass, with version previews for same-repository pull requests, including drafts. Fork pull requests
run checks without deployment credentials. Preserve preview branch aliases,
commit and branch metadata, and the OAuth callback behavior. The temporary
`actions-` preview prefix is removed now that the owner disconnected Workers
Builds and authorized using the original branch aliases. Moving hosts must
not silently remove these features.

Use a scoped Cloudflare API token held in GitHub Actions secrets, with deployment
credentials available only to trusted deployment steps. Preserve the existing
Worker bindings and encrypted app secret handling. Verify the replacement before
disabling Workers Builds so the transition does not leave competing deployments.

### Build job

The `website` job runs on pull requests, including drafts and forks, and
pushes to `main`. Other branches needing a preview
open a draft PR. Test jobs run on PRs only; main pushes run only the website
job. Merge-group events skip every job, reporting required check names without
allocating runners or retesting combined changes. It runs independently of the platform matrix and test jobs,
reuses workflow concurrency, and builds outside the successful-check
cache. Build steps receive no deployment credentials. The generator receives
the checked-out SHA and source branch through the existing `WORKERS_CI_*`
metadata variables.

Every same-repository pull-request run uploads a preview with Wrangler 4.74.0
and `versions upload --preview-alias` after its own successful website build.
Fork pull requests never upload; merge-group entries skip every job. No enable-switch variables
are used. Production uploads use `wrangler deploy` only for main pushes, after changes
pass PR checks and merge through the queue. Main runs do not cancel an active upload. The API token is scoped to the upload
step. The account ID is committed in `wrangler.jsonc`; its `keep_vars` setting
and Wrangler's secret inheritance reuse existing Worker bindings. Actions needs
only the API-token secret and sends no empty OAuth overrides. The legacy
Workers Builds helper keeps its explicit bindings during the transition.

Workers Builds is disconnected after the owner verified preview login. Setup,
branch-alias rules, cutover and rollback are documented in
[GitHub Actions deployment](../README.md#github-actions-deployment).

### Preview links

The existing CI website job creates or updates one bot-owned PR comment after
each successful preview upload. It uses the alias URL reported by Wrangler
and the automatic Actions token with pull-request write permission. Drafts
are included; fork PRs stay build-only and merge groups skip every job. No extra settings are
needed, and failed uploads never publish a preview comment.

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
- [x] Enable production deployment on `main` in the existing website job,
      after preview verification and disconnecting Workers Builds.
- [ ] Validate generated-workflow consistency and build output, then verify a
      branch preview and production deployment with the configured credentials.
      Check assets, Rust documentation, demos and GitHub sign-in.
- [x] Remove the temporary `actions-` preview-alias prefix after disconnecting
      Workers Builds.
- [ ] Document the GitHub Actions setup and cutover/rollback procedure, reconcile
      the old Cloudflare-only build script and Node pin with their remaining
      consumers, update related documentation, and disable Workers Builds after
      the replacement is verified. Delete this TODO when the migration ships.

### Related

- [Run `cargo doc` in the site build](./cargo-doc-build-host.md): the existing
  Rust documentation build must move with the site; its remaining Deno
  documentation work stays tracked there.

