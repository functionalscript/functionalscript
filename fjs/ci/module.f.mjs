/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * See `./types.ts` for the `Setup` type-level API.
 *
 * @module
 *
 * @import { NodeOp } from '../effects/node/types.ts'
 * @import { Architecture, GitHubAction, Job, Jobs, MetaStep, Os } from './common/types.ts'
 * @import { PackageConsumer, Setup } from './types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { resultStep } from '../effects/module.f.mjs'
import { access, exitStep, writeFiles } from '../effects/node/module.f.mjs'
import { functionalscript, images, node } from './config/module.f.js'
import {
    _workflowsDirectory,
    architecture,
    install,
    job,
    os,
    test,
    ubuntuArm
} from './common/module.f.mjs'
import {
    rustPlatformSteps,
    shellRustCommands,
    shellRustVersionSteps,
} from './rust/module.f.mjs'
import {
    installNode,
    nodeVersionJobs,
    nodeVersionStep,
    platformNodeSteps,
} from './node/module.f.mjs'
import {
    _nixFlakeFiles,
    nixDevelop,
    nixInstall,
    nixSteps,
} from './nix/module.f.mjs'
import { bunSteps } from './bun/module.f.mjs'
import { devNixJob } from './dev/module.f.mjs'
import { denoSteps } from './deno/module.f.mjs'
import { npmPublishPath, npmPublishWorkflow } from './publish/module.f.mjs'

/**
 * Where the pipeline writes the CI workflow. GitHub reads any `.yml` in
 * {@link _workflowsDirectory}, so the file takes the `gen.` name every generated
 * file has ([CONTRIBUTING.md](../../CONTRIBUTING.md#naming-generated-files)).
 */
export const ciPath = /** @type {const} */ (`${_workflowsDirectory}/gen.ci.yml`)

/**
 * A workflow as the file the generator writes. JSON, which every YAML reader
 * accepts, so nothing here has to decide how a string is quoted or how deep a
 * block is indented.
 *
 * @type {(gha: GitHubAction) => string}
 */
const workflowText = gha => JSON.stringify(gha, null, '  ')

/**
 * A platform job on the shared shell: every command through `nix develop`, and
 * the runtime asserted first.
 *
 * The three Nix platform jobs enter the same shell, and differ in one
 * thing: Intel Linux also checks the 32-bit target, because that is the one
 * system whose shell can carry it. Intel macOS installs only Node and native
 * Rust directly; Windows also installs its tools directly.
 *
 * It runs this commit's suite rather than installing a published
 * FunctionalScript and running that. `npm install -g` writes to the read-only
 * store from inside the shell, so keeping the old shape would mean an
 * `NPM_CONFIG_PREFIX` in a flake developers also enter — and the check was the
 * one `deno` and `bun` already dropped, for the reason
 * `./todo/built-package-checks.md` records: it tests a shipped release rather
 * than the commit under review. The two Windows jobs still run it.
 *
 * It does run `npm ci`, and that is a change from the shape these jobs had. The
 * old one installed a published FunctionalScript globally and ran `fjs test`,
 * which discovers proof modules by walking the tree and so needs nothing
 * resolved. `node --test` is not that: it runs a project's test entry, and
 * `../README.md` tells a consumer to write that entry as
 * `import 'functionalscript/fjs/emergent_testing/all.test.mjs'` — a bare
 * specifier, which resolves through `node_modules` or not at all. This
 * repository would not have noticed, having no such file: its proofs live under
 * `fjs/`, where `node --test` reaches them by path. A consumer's job would have
 * failed on `ERR_MODULE_NOT_FOUND`.
 *
 * It adds no requirement a consumer did not already have — every canonical Node
 * job runs `npm ci`, so a lockfile is table stakes for this generator — and it
 * costs this repository one install of one `devDependency` that is types.
 *
 * The version check is worth more here than in any other job. These are the
 * only places the shell is built for a system other than `aarch64-linux`, so
 * this is what turns three shells that were pinned as text into three that are
 * known to work.
 *
 * The platform reaches the `cargo` commands because two of the three run more
 * of them: Intel Linux checks the 32-bit target its shell carries, and ARM
 * Linux checks formatting and every WASM target, asserting both WASM runtimes
 * first. Each was a job of its own — `ubuntu-intel32` until that shell had the
 * target, `wasm` until it was one more runner doing this job's setup again.
 * `../rust/module.f.mjs` decides which platforms those are; everything else
 * about these jobs is still identical across the three.
 *
 * @type {(rust: boolean, o: Os, a: Architecture) => readonly MetaStep[]}
 */
const shellPlatformSteps = (rust, o, a) => [
    nixInstall,
    nodeVersionStep(),
    ...(rust ? shellRustVersionSteps(o, a) : []),
    ...nixSteps([
        'npm ci',
        ...(rust ? shellRustCommands(o, a) : []),
        'node --test',
    ]),
]

/**
 * Intel macOS installs only the tools its working-checkout checks use.
 *
 * The shared Node and Rust installers use the same pins as the Nix jobs.
 * This keeps `npm ci` and `node --test`, with each native Rust check reported
 * separately. No compiler or WASM tools are needed by this job.
 *
 * @type {(rust: boolean) => readonly MetaStep[]}
 */
const intelMacSteps = rust => [
    install(installNode()),
    test({ run: `test "$(node --version)" = "v${node}"` }),
    test({ run: 'npm ci' }),
    ...(rust ? rustPlatformSteps('macos', 'intel') : []),
    test({ run: 'node --test' }),
]

/**
 * The interpreter an injected command is handed to, and the flags that make it
 * the one it was written for.
 *
 * GitHub runs a `run:` step as `bash -e {0}` — that spelling, from this
 * repository's own job logs. Both halves matter. **`bash`**, because `sh` is
 * `dash` on the Ubuntu images, where `[[ … ]]` is not a command; and **`-e`**,
 * because without it `false; echo done` exits 0 and the step is green while the
 * work in it failed.
 *
 * Not `-o pipefail`: that belongs to an explicit `shell: bash`, and these steps
 * declare no `shell`, so the default is what they get. Matching the default is
 * the point — an injected command should behave the same whether the job it
 * lands in has a shell or not.
 */
const injectedShell = /** @type {const} */ ('bash -e -c')

/**
 * The variable an injected command travels in, rather than being quoted into
 * the command line that runs it.
 *
 * Quoting cannot be made correct here, and not for want of a better escape.
 * GitHub substitutes `${{ … }}` into a step's `run` text *before* any shell
 * reads it, so a substituted value lands inside whatever quotes the generator
 * wrote: `echo "${{ matrix.name }}"` with a value of `O'Reilly` closes a
 * single-quoted argument its author never opened. No escape applied at
 * generation time can reach a value that does not exist yet.
 *
 * What this buys is exact, and worth stating exactly. `"$FJS_CI_RUN"` is a
 * shell expansion, so the command arrives at {@link injectedShell} as one
 * argument holding exactly the text of the `env` value — one word, whatever it
 * contains, newlines and quotes of either kind included. **The generator's own
 * quoting layer is gone**, rather than tightened.
 *
 * What it does not buy, since the sentence is easy to write and wrong: GitHub
 * substitutes `${{ … }}` into an `env` value too, and `bash` then executes the
 * result. A `${{ … }}` a consumer writes into their own command is theirs to
 * get right, exactly as it would be in a hand-written `run:`. The layer this
 * generator used to add on top of that is what is removed.
 */
const injectedRun = /** @type {const} */ ('FJS_CI_RUN')

/**
 * An injected step, moved into the shared shell where the job's own commands
 * run.
 *
 * Without this a `nodeExtra` step would keep running on the runner, and the
 * runner no longer has what it used to: these jobs stopped installing Node with
 * `setup-node`, so an injected `node tool.mjs` would find whatever the image
 * ships rather than the release every other step in the job asserts.
 *
 * **Through a shell, and that is not decoration.** The `run` script ends in
 * `--command "$@"`, which is an argv rather than a script — right for this
 * generator's own commands, which are one program and its arguments by
 * construction (root `AGENTS.md` §7), and wrong for anything a consumer writes.
 * A bare prefix would make `NODE_OPTIONS=x node tool.mjs` try to execute a
 * program named `NODE_OPTIONS=x`, and would split `cd dir && node tool.mjs` at
 * the `&&`, running the first half in the shell and the second on the runner
 * with nothing said about it. A GitHub `run:` is a shell script, so it is
 * handed to {@link injectedShell} — and reaches it through {@link injectedRun}
 * rather than through quotes, so this generator adds no quoting for a
 * substituted value to break out of.
 *
 * **Position moves with it.** `toSteps` puts an `install` step before
 * `actions/checkout`, and the flake lives in that checkout, so a step there
 * cannot enter the shell at all — and, since these jobs dropped `setup-node`,
 * cannot count on a pinned Node either. An injected command is therefore a
 * command in the shell whichever type it was declared as; the alternative was
 * to leave it in the one position where its runtime is guaranteed wrong.
 *
 * A step naming an action keeps both its position and its shape. There is no
 * command to wrap, and `actions/cache` and its like want to run early.
 *
 * @type {(step: MetaStep) => MetaStep}
 */
const inShell = step =>
    step.type !== 'rust' && step.step.run !== undefined
        ? test({
            ...step.step,
            run: nixDevelop(`${injectedShell} "$${injectedRun}"`),
            env: { ...step.step.env, [injectedRun]: step.step.run },
        })
        : step

/**
 * The condition of a job that runs in the merge queue only. On a pull request
 * the job is skipped, which a required status check reads as passed.
 */
const mergeQueue = /** @type {const} */ (`github.event_name == 'merge_group'`)

/** @type {(rust: boolean, nodeExtra: readonly MetaStep[], mergeQueueOnly: boolean) => (o: Os) => (a: Architecture) => readonly [string, Job]} */
const platformJob = (rust, nodeExtra, mergeQueueOnly) => o => a => {
    const id = `${o}-${a}`
    const image = images[o][a]
    // Direct-install jobs keep injected steps on the runner too.
    const result = o === 'windows'
        ? [
            ...(rust ? rustPlatformSteps(o, a) : []),
            ...platformNodeSteps(functionalscript),
            ...nodeExtra,
        ]
        : o === 'macos' && a === 'intel'
            ? [...intelMacSteps(rust), ...nodeExtra]
            : [...shellPlatformSteps(rust, o, a), ...nodeExtra.map(inShell)]
    return [id, job(image, mergeQueueOnly ? mergeQueue : undefined)(result)]
}

/**
 * Every job that is not the platform matrix.
 *
 * There is no `dev` job any more. It existed because nothing else entered the
 * developer shell, so that flake would have rotted unnoticed; now every job
 * below enters it, and each asserts the versions it
 * depends on before running anything — `node` and `tsc` from Node 26, `deno`
 * from `deno`, `bun` from `bun`, and both WASM runtimes from the `ubuntu-arm`
 * platform job. A separate job could only repeat those six.
 *
 * All of them are generated for every project — and so is the
 * packed-package check closing Node 26's job. It used to appear only when the
 * project's `package.json` pinned an exact TypeScript, so a project with no
 * compiler of its own got no packed-package check; the compiler is the CI
 * configuration's now, so there is nothing left to be absent. What the check
 * reads is the declarations the tarball ships, and a package shipping none
 * fails it with `TS18003` — see `./todo/ci-generator-audience.md`, which owns
 * the general shape of this trade.
 *
 * @type {(packageConsumer: PackageConsumer | undefined) => Jobs}
 */
const canonicalJobs = packageConsumer => ({
    deno: ubuntuArm(denoSteps),
    bun: ubuntuArm(bunSteps),
    ...nodeVersionJobs(packageConsumer),
})

/**
 * Every file `fjs ci` writes for `setup`, in order, given whether the project
 * has Rust: the CI workflow, the publish workflow, and the shared shell.
 *
 * @type {(setup: Setup) => (rust: boolean) => readonly (readonly [path: string, text: string])[]}
 */
const ciFiles = ({ nodeExtra, packageConsumer, mergeQueueOnly = [] }) => rust => {
    /** @type {Jobs} */
    const jobs = {
        ...Object.fromEntries(os.flatMap(o =>
            architecture.map(platformJob(rust, nodeExtra(o), mergeQueueOnly.includes(o))(o)))),
        ...canonicalJobs(packageConsumer),
    }
    /** @type {GitHubAction} */
    const gha = {
        name: 'CI',
        on: {
            pull_request: {},
            merge_group: {},
        },
        // One run per pull request: a push cancels the run of the commit
        // it supersedes, which would otherwise hold runners for a result
        // nobody reads. The group is the ref — a pull request's,
        // `refs/pull/<n>/merge`, is the same for every push to it, while
        // a merge-queue entry's names its own commit, so no entry cancels
        // another. The workflow name keeps the group apart from any a
        // project's own workflows key on the ref.
        concurrency: {
            group: '${{ github.workflow }}-${{ github.ref }}',
            'cancel-in-progress': true,
        },
        permissions: {
            contents: 'read',
        },
        jobs,
    }
    return [
        [ciPath, workflowText(gha)],
        // The publish workflow is a function of the configuration alone — no
        // job of it varies with the project's Rust, its compiler pin, or the
        // caller's `Setup` — so it is written rather than built here.
        [npmPublishPath, workflowText(npmPublishWorkflow)],
        // The shared environment is independent of the project's Rust: even
        // a project without Cargo.toml gets the complete selected toolset.
        // Six of the nine jobs enter it; Intel macOS, the two Windows jobs
        // and the packed-consumer steps use tools installed outside Nix.
        ..._nixFlakeFiles(devNixJob),
    ]
}

/**
 * Writes {@link ciFiles}, once `Cargo.toml` has said whether the project has
 * Rust.
 *
 * @type {(setup: Setup) => Effect<NodeOp, 0, number>}
 */
export const ci = setup => resultStep(
    access('Cargo.toml'),
    result => exitStep(writeFiles(ciFiles(setup)(result[0] === 'ok'))))

/**
 * The built-in `fjs ci`, the generator any project gets: no extra platform
 * steps and no packed-package consumer, since this command cannot know what
 * another package publishes, and the packed-package check without a consumer
 * is the declaration check every project had. A project with a module to offer
 * calls `ci` with one, as this repository does in `./self/module.f.mjs`,
 * which is what its `npm run gen` runs.
 *
 * @type {() => Effect<NodeOp, 0, number>}
 */
export const main = () => ci({ nodeExtra: () => [] })
