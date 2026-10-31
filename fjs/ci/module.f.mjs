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
 * @import { Effect, IoChannel } from '../effects/types.ts'
 */

import { step } from '../effects/module.f.mjs'
import { exists, exitStep, writeFiles } from '../effects/node/module.f.mjs'
import { images, node } from './config/module.f.js'
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
import { environmentCommand, environmentSteps } from './environment/module.f.mjs'
import { bunSteps } from './bun/module.f.mjs'
import { denoSteps } from './deno/module.f.mjs'
import { shellSpiderMonkeyCommands, shellSpiderMonkeyVersionSteps } from './spidermonkey/module.f.mjs'
import { npmPublishPath, npmPublishWorkflow } from './publish/module.f.mjs'
import { miseJobs } from './mise/module.f.mjs'
import { smartJobs } from './smart/module.f.mjs'

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
 * @type {(rust: boolean, o: Os, a: Architecture) => readonly MetaStep[]}
 */
const shellPlatformSteps = (rust, o, a) => [
    nodeVersionStep(),
    ...(rust ? shellRustVersionSteps(o, a) : []),
    ...shellSpiderMonkeyVersionSteps(o, a),
    ...environmentSteps([
        'npm ci',
        ...(rust ? shellRustCommands(o, a) : []),
        'node --test ./fjs/emergent_testing/js-only.mjs',
        ...shellSpiderMonkeyCommands(o, a),
    ]),
]

/**
 * @type {(rust: boolean) => readonly MetaStep[]}
 */
const intelMacSteps = rust => [
    install(installNode()),
    test({ run: `test "$(node --version)" = "v${node}"` }),
    test({ run: 'npm ci' }),
    ...(rust ? rustPlatformSteps('macos', 'intel') : []),
    test({ run: 'node --test ./fjs/emergent_testing/js-only.mjs' }),
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
 * Carry injected shell scripts through the environment without quoting their text.
 * @type {(step: MetaStep) => MetaStep}
 */
const inShell = step =>
    step.type !== 'rust' && step.step.run !== undefined
        ? test({
            ...step.step,
            run: environmentCommand(`${injectedShell} "$${injectedRun}"`),
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
            ...platformNodeSteps(),
            ...nodeExtra.map(inShell),
        ]
        : o === 'macos' && a === 'intel'
            ? [...intelMacSteps(rust), ...nodeExtra.map(inShell)]
            : [...shellPlatformSteps(rust, o, a), ...nodeExtra.map(inShell)]
    return [id, job(image, mergeQueueOnly ? mergeQueue : undefined)(result)]
}

/**
 * @type {(packageConsumer: PackageConsumer | undefined) => Jobs}
 */
const canonicalJobs = packageConsumer => ({
    deno: ubuntuArm(denoSteps),
    bun: ubuntuArm(bunSteps),
    ...nodeVersionJobs(packageConsumer),
})

/** Jobs shared by workflow generation and successful-check initialization.
 * @type {(setup: Setup) => (rust: boolean) => Jobs}
 */
export const ciJobs = ({ nodeExtra, packageConsumer, mergeQueueOnly = [] }) => rust => miseJobs({
    ...Object.fromEntries(os.flatMap(o =>
        architecture.map(a => platformJob(rust, nodeExtra(o, a), mergeQueueOnly.includes(o))(o)(a)))),
    ...canonicalJobs(packageConsumer),
}, rust)

/**
 * The CI workflow for `setup`, given whether the project has Rust.
 * Exported so repository-owned policy can extend the same workflow.
 * @type {(setup: Setup) => (rust: boolean) => GitHubAction}
 */
export const ciWorkflow = setup => rust => {
    const selectedJobs = ciJobs(setup)(rust)
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
        jobs: { ...(setup.smart ? smartJobs(selectedJobs) : selectedJobs), ...setup.extraJobs },
    }
    return gha
}

/**
 * The CI and publishing workflows, written.
 *
 * @type {(workflow: GitHubAction) => Effect<NodeOp, void, IoChannel>}
 */
const writeWorkflows = workflow => writeFiles([
    [ciPath, workflowText(workflow)],
    [npmPublishPath, workflowText(npmPublishWorkflow)],
])

/** Write CI and publishing workflows through the shared generator.
 * @type {(workflow: GitHubAction) => Effect<NodeOp, 0, number>}
 */
export const writeCi = workflow => exitStep(writeWorkflows(workflow))

/**
 * Writes {@link ciWorkflow}, once `Cargo.toml` has said whether the project has
 * Rust. A `Cargo.toml` that is there but cannot be read about, a permission
 * error among others, fails the command rather than leaving the Rust jobs out.
 *
 * @type {(setup: Setup) => Effect<NodeOp, 0, number>}
 */
export const ci = setup => exitStep(step(
    exists('Cargo.toml'),
    hasRust => writeWorkflows(ciWorkflow(setup)(hasRust))))

/**
 * The built-in `fjs ci`, the generator any project gets: no extra platform
 * steps and no packed-package consumer, since this command cannot know what
 * another package publishes, and the packed-package check without a consumer
 * is the declaration check every project had. A project with a module to offer
 * builds its workflow with one, as this repository does in `./self/module.f.mjs`,
 * which is what its `npm run gen` runs.
 *
 * @type {() => Effect<NodeOp, 0, number>}
 */
export const main = () => ci({ nodeExtra: () => [] })
