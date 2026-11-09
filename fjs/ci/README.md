# Continuous integration workflow generator

`fjs ci` writes `.github/workflows/gen.ci.yml` and
`.github/workflows/gen.npm-publish.yml`. Jobs use the checkout's committed
mise manifest and lock; callers must provide those files. This replaces the
previous generated environment API. `Setup.environment` is removed because
this branch has one environment manager.

The ten test jobs cover Linux, macOS and Windows on x64 and ARM64, canonical
Node, Deno and Bun checks, and dedicated Node coverage. Native Rust debug/release
tests and Clippy, i686 Linux/Windows checks, Linux ARM formatting and four WASM
targets, SpiderMonkey compilation/tests, TypeScript, compilation, coverage and
packed-package checks remain separate steps. Host compiler/SDK prerequisites
still apply.

The six platform jobs run Node's JS-only entry
(`node --test ./fjs/emergent_testing/js-only.mjs`). The Deno and Bun jobs run
`fjs-only.mjs` through their native runners without coverage. Bun allows 30 seconds per
test because parser stress proofs can exceed its default five seconds. `node26`
retains FJS-only Node coverage via `npm run cov` and its existing successful-check
cache. The additional `cov` job runs `npm start cov node`, checking each module
directory's own proofs in a fresh Node coverage process with 100% line, branch
and function thresholds. The command reuses exact successful dependency
manifests from the local `build-cache` branch. Same-repository runs outside
Dependabot pass `--sync`, recording and publishing each successful manifest
immediately; forks and Dependabot keep local caching only. The existing combined
suite retains proofs outside measured module directories and contributes no
coverage to the isolated runs. SpiderMonkey compilation and FJS tests remain on `ubuntu-arm`.
The canonical Node job runs `npm start deps` after type checking and before
compilation and combined coverage. It checks generic AST formation for every authored
`.f.js` and `.f.mjs` file, including proofs, demos and helpers. While generic AST
coverage is incomplete, this step temporarily uses `continue-on-error: true`: it
reports parsing failures without failing the job. It runs uncached even when
other checks hit build-cache. Restore failure gating once all authored files parse
([dependency graph follow-up](../todo/module-dependency-graph-command.md)).
Host-JS proofs currently have Node coverage across all six platforms; Deno
and Bun host-JS runs remain part of the later six-job allocation.

Suite and combined coverage cache keys retain the conservative `js` input rung.
The selected command and `package.json` participate in the key, so old
combined-suite results cannot certify the new selective runs. Narrowing the
inputs requires a separate dependency audit. The additional isolated coverage
job uses the command's
[per-target dependency manifests](../emergent_testing/README.md#testing-and-covering-one-module), not
these whole-check gates. Unsupported dependency analysis remains uncached.

## Files

- `config/module.f.js`: exact accepted tool versions and runner/action pins.
- `environment/module.f.mjs`: manager-independent command assembly.
- `mise/module.f.mjs`: locked setup and command execution, including supplements.
- `rust`, `node`, `bun`, `deno`, `spidermonkey`: check builders.
- `package`: isolated packed-package declaration and runtime consumer.
- `smart`: successful-check caching; `cache`: input classification and keys.
- `self`: this repository's consumer and additional steps.

The test workflow runs ten jobs on pull requests and merge-group entries.
The nine existing jobs retain their checks and successful-check caching.
The `cov` command always starts, then checks its own per-target manifests.
The new job supplies cache-publication identity and contents-write permission;
its `--sync` flag is restricted to permitted runs. Existing job permissions
remain unchanged.
There are no website jobs, push triggers, or deployment gates in `gen.ci.yml`.

Add `cov` to GitHub's required status checks when it is ready to gate merging.
The workflow does not update the repository's branch rules.

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

The generated `gen.personal-notes.yml` workflow approves a pull request that
changes only its author's personal notes, the files under
`doc/<author's login>/`, when the author has write access
([`personal-notes`](./personal-notes/module.f.js)). It runs on
`pull_request_target`, also when a pull request is edited, since a new base
branch changes its files. The workflow and the code it runs are the base
branch's, so a pull request cannot change what approves it, and the pull
request itself is read through the API, never checked out. Once a file outside
the notes changes, it dismisses the approval it gave. It needs two repository
settings: "Allow GitHub Actions to create and approve pull requests", and an
Actions policy that lets `pull_request_target` run, since GitHub's default
policy for public repositories can block that event. Without the second, the
workflow never starts and every pull request waits for a person.

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
its pull-request and merge-group triggers. Both generic and repository
workflows include the `cov` job, assembled after the check-cache
transformation. Generic workflows use local coverage caching; this repository
also enables per-manifest synchronization on permitted CI runs.

Optional `extraJobs` adds fully assembled project jobs after the platform setup
and check-cache transformations. Callers provide their environment setup and
use distinct job IDs; the built-in generator adds none. This keeps this
repository's website build out of other projects' workflows.

Publishing retains its separate `setup-node` workflow and npm provenance.
See [platform setup](../../doc/mise-trial/README.md) and
[CI details](../../doc/mise-trial/CI.md).
