# Continuous integration workflow generator

`fjs ci` writes `.github/workflows/gen.ci.yml` and
`.github/workflows/gen.npm-publish.yml`. Jobs use the checkout's committed
mise manifest and lock; callers must provide those files. This replaces the
previous generated environment API. `Setup.environment` is removed because
this branch has one environment manager.

The nine test jobs cover Linux, macOS and Windows on x64 and ARM64, plus canonical
Node, Deno and Bun suites. Native Rust debug/release tests and Clippy, i686
Linux/Windows checks, Linux ARM formatting and four WASM targets, SpiderMonkey
compilation/tests, TypeScript, compilation, coverage and packed-package checks
remain separate steps. Host compiler/SDK prerequisites still apply.

The six platform jobs run Node's JS-only entry
(`node --test ./fjs/emergent_testing/js-only.mjs`). The Deno and Bun jobs run
`fjs-only.mjs` through their native runners without coverage. Bun allows 30 seconds per
test because parser stress proofs can exceed its default five seconds. `node26` runs
FJS-only Node coverage via `npm run cov`, retaining the 100% thresholds;
SpiderMonkey compilation and FJS tests remain on `ubuntu-arm`.
Host-JS proofs currently have Node coverage across all six platforms; Deno
and Bun host-JS runs remain part of the later six-job allocation.

Suite and coverage cache keys retain the conservative `js` input rung.
The selected command and `package.json` participate in the key, so old
combined-suite results cannot certify the new selective runs. Narrowing the
inputs requires a separate dependency audit.

## Files

- `config/module.f.js`: exact accepted tool versions and runner/action pins.
- `environment/module.f.mjs`: manager-independent command assembly.
- `mise/module.f.mjs`: locked setup and command execution, including supplements.
- `rust`, `node`, `bun`, `deno`, `spidermonkey`: check builders.
- `package`: isolated packed-package declaration and runtime consumer.
- `smart`: successful-check caching; `cache`: input classification and keys.
- `self`: this repository's consumer and additional steps.

The repository keeps its original test workflow: nine jobs on pull requests
and merge-group entries, with the existing successful-check cache. There are
no website jobs, push triggers, or deployment gates in `gen.ci.yml`.

The separate generated `gen.website.yml` workflow contains the `website` job.
It runs on pull requests, including drafts and forks, and pushes to `main`.
It builds the WASM demos, styled Rust documentation and website using the mise
lock. Same-repository PRs upload previews and update a bot comment with the
actual URL; forks build without uploading. Main pushes deploy production.
Other branch pushes do not create previews. The website is not a required
merge-queue check, so its workflow does not run on merge-group events.

Website concurrency cancels superseded PR runs and serializes main uploads
without cancelling an active deployment. Build steps receive no upload secrets;
the Cloudflare token and automatic Actions token are confined to the upload
steps that need them. Both Rustdoc and website generation receive the same
commit and branch metadata. No additional settings or third-party actions are
required; see [deployment](../website/README.md#github-actions-deployment).

## Usage

Run `./dev.sh npm run gen` after changing a generator or input. Commit generated
workflows with their source changes. Regeneration only needs Node; tool lock
refreshes are separate. The cleaner deletes every `gen.*` output before writing
it again, so retired generated assets become deletions.

`ci(setup)` accepts `nodeExtra(os, architecture)`, optional `packageConsumer`,
`smart`, and `mergeQueueOnly`. Injected shell scripts pass unchanged through
`FJS_CI_RUN` to `bash -e -c` inside the selected environment. The packed consumer
runs outside that environment, under `runner.temp`, with its own `setup-node`.

Successful-check caching (`smart: true`) is supported only for FunctionalScript's
own repository. `fjs ci init` selects `GITHUB_JOB` from the configuration in
`fjs/ci/self`; it does not receive the caller's `Setup`. Other projects should
leave `smart` unset so their checks run normally. An unknown job ID makes cache
initialization fail, and the generated workflow falls back to running the checks.

`ciWorkflow(setup)(rust)` builds the test workflow and `writeCi(workflow)`
writes CI and npm publishing files. The repository-owned `self` module also
writes the independent website workflow. The generic `fjs ci` command keeps
its pull-request and merge-group triggers.

Optional `extraJobs` adds fully assembled project jobs after the platform setup
and check-cache transformations. Callers provide their environment setup and
use distinct job IDs; the built-in generator adds none. This keeps this
repository's website build out of other projects' workflows.

Publishing retains its separate `setup-node` workflow and npm provenance.
See [platform setup](../../doc/mise-trial/README.md) and
[CI details](../../doc/mise-trial/CI.md).
