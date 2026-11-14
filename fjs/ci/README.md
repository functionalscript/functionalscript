# Continuous integration workflow generator

`fjs ci` writes `.github/workflows/gen.ci.yml` and
`.github/workflows/gen.npm-publish.yml`. Jobs use the checkout's committed
mise manifest and lock for source checks; callers must provide those files. The
package consumer uses direct Node and TypeScript installation. This replaces the
previous generated environment API. `Setup.environment` is removed because
this branch has one environment manager.

The twelve test jobs cover Linux, macOS and Windows on x64 and ARM64, canonical
Node, Deno, Bun and SpiderMonkey checks, dedicated Node coverage and the npm
package consumer. Native Rust debug/release
tests and Clippy, i686 Linux/Windows checks, Linux ARM formatting and four WASM
targets, SpiderMonkey compilation/tests, TypeScript, compilation, coverage and
packed-package checks remain separate steps. Host compiler/SDK prerequisites
still apply.

`node` always builds the tarball with `npm pack` and uploads the
`package-tarball` artifact. The `package` job waits for `node`, downloads that
artifact into `runner.temp/consumer`, installs pinned Node with `setup-node`
and pinned TypeScript through npm, then runs the declaration, runtime-import
and negative type checks. It has no checkout or mise setup. The producer and
consumer run without whole-check caching: a cached success cannot supply a
tarball, and a successful pack alone cannot certify consumer validation.
`node` also keeps `npm ci` and the compiler version check uncached because
`npm pack` invokes the declaration-producing `prepack` hook.

The three ARM platform jobs run Node's JS-only entry
(`node --test ./fjs/emergent_testing/js-only.mjs`). The Deno and Bun jobs run
`fjs-only.mjs` through their native runners without coverage. Bun allows 30 seconds per
test because parser stress proofs can exceed its default five seconds. `node`
runs the full authored FJS suite via `npm start t`, using the built-in reporter
without coverage and the successful-check cache's `suite` entry. The dedicated
`cov` job runs `npm start cov node`, checking each module directory's own proofs
in a fresh Node coverage process with 100% line, branch
and function thresholds. The command reuses exact successful dependency
manifests from the local `build-cache` branch. Same-repository runs outside
Dependabot pass `--sync`, saving successful manifests and publishing one batch
after all modules finish; forks and Dependabot keep local batch recording only.
The full test suite retains proofs outside measured module directories.
Each measured file in the isolated run prints `...Ok`, `...Cached`,
or `...Failed`; native output streams live through the quiet reporter. SpiderMonkey
compilation and FJS tests run in the dedicated `spidermonkey` job on ARM Linux.
The canonical Node job runs `npm start deps` after type checking and before
compilation and the full test suite. It checks generic AST formation for every
authored `.f.js` and `.f.mjs` file, including proofs, demos and helpers. While generic AST
coverage is incomplete, this step temporarily uses `continue-on-error: true`: it
reports parsing failures without failing the job. It runs uncached even when
other checks hit build-cache. Restore failure gating once all authored files parse
([dependency graph follow-up](../todo/module-dependency-graph-command.md)).
Intel platform jobs retain native Rust checks but do not run fjs tests.
Host-JS proofs run without suite-wide coverage across all three ARM platforms; Deno
and Bun host-JS runs remain part of the later six-job allocation.

Suite cache keys retain the conservative `js` input rung. The selected command
and `package.json` participate in the key, so old coverage results cannot certify
the `npm start t` run. Narrowing the inputs requires a separate dependency audit.
The dedicated isolated coverage
job uses the command's
[per-target dependency manifests](../emergent_testing/README.md#testing-and-covering-one-module), not
these whole-check gates. Unsupported dependency analysis remains uncached.

## Files

- `config/module.f.js`: exact accepted tool versions and runner/action pins.
- `environment/module.f.js`: manager-independent command assembly.
- `mise/module.f.mjs`: locked setup and command execution, including supplements.
- `rust`, `node`, `bun`, `deno`, `spidermonkey`: check builders.
- `package`: isolated declaration and runtime consumer steps.
- `smart`: successful-check caching; `cache`: input classification and keys.
- `self`: this repository's consumer and additional steps.

The test workflow runs twelve jobs on pull requests and merge-group entries.
Source checks retain their successful-check caching.
The `cov` command always starts, then checks its own per-target manifests.
The new job supplies cache-publication identity and contents-write permission;
its `--sync` flag is restricted to permitted runs. Existing job permissions
remain unchanged.
There are no website jobs, push triggers, or deployment gates in `gen.ci.yml`.

Add `cov` and `package` to GitHub's required status checks when they are ready
to gate merging.
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
runs in its own job, under `runner.temp`, with its own `setup-node`.

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
also enables end-of-run batch synchronization on permitted CI runs.

Optional `extraJobs` adds fully assembled project jobs after the platform setup
and check-cache transformations. Callers provide their environment setup and
use distinct job IDs; the built-in generator adds none. This keeps this
repository's website build out of other projects' workflows.

Publishing retains its separate `setup-node` workflow and npm provenance.
See [platform setup](../../doc/mise-trial/README.md) and
[CI details](../../doc/mise-trial/CI.md).
