/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * See `./types.ts` for the `Setup` type-level API.
 *
 * @module
 *
 * @import { NodeOp } from '../effects/node/types.ts'
 * @import { Architecture, GitHubAction, Job, Jobs, MetaStep, Os } from './common/types.ts'
 * @import { NixJob } from './nix/types.ts'
 * @import { Setup } from './types.ts'
 * @import { Effect } from '../effects/types.ts'
 */

import { resultStep } from '../effects/module.f.mjs'
import { access, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'
import { step as ioStep } from '../effects/module.f.mjs'
import { functionalscript, images } from './config/module.f.mjs'
import {
    architecture,
    os,
    toSteps,
    ubuntuArm
} from './common/module.f.mjs'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.mjs'
import { nodeMainSteps, nodeNixJobs, nodeVersionJobs } from './node/module.f.mjs'
import { nixFlakes } from './nix/module.f.mjs'
import { packageCheckJob, packageCheckJobId } from './package/module.f.mjs'
import { bunSteps } from './bun/module.f.mjs'
import { devNixJob } from './dev/module.f.mjs'
import { denoSteps } from './deno/module.f.mjs'
import { npmPublishPath, npmPublishWorkflow } from './publish/module.f.mjs'

/**
 * A workflow as the file the generator writes. JSON, which every YAML reader
 * accepts, so nothing here has to decide how a string is quoted or how deep a
 * block is indented.
 *
 * @type {(gha: GitHubAction) => string}
 */
const workflowText = gha => JSON.stringify(gha, null, '  ')

/** @type {(rust: boolean, nodeExtra: readonly MetaStep[]) => (o: Os) => (a: Architecture) => readonly [string, Job]} */
const job = (rust, nodeExtra) => o => a => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustPlatformSteps(o, a) : []),
        ...nodeMainSteps(functionalscript),
        ...nodeExtra,
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

/**
 * Every generated flake. Three, for eight jobs.
 *
 * `dev` is the shell all but two of them enter, and the one a developer enters
 * — see `./dev/module.f.mjs` for why sharing is safe where a command names its
 * runtime, and `./node/module.f.mjs` for the two jobs where it is not. Node 22
 * and Node 24 are those two.
 *
 * The list is not a function of the project, so `dev` is written whole whether
 * or not the project has a `Cargo.toml`: a project without Rust gets a shell
 * carrying a toolchain no job of its uses, and no job checking the two WASM
 * runtimes in it. That is the same trade `./todo/ci-generator-audience.md`
 * describes for every job this generator writes unconditionally.
 *
 * One canonical job is absent: `package-check` runs with no checkout, so there
 * is no file tree for a flake to be in. `./todo/65z-ci-nix.md` says why, and
 * `./proof.f.mjs`'s `nixCoverage` keeps the list from growing by accident.
 *
 * @type {readonly NixJob[]}
 */
export const nixJobs = [
    ...nodeNixJobs,
    devNixJob,
]

/**
 * Every job that is not the platform matrix.
 *
 * There is no `dev` job any more. It existed because nothing else entered the
 * developer shell, so that flake would have rotted unnoticed; now every job
 * below but Node 22 and Node 24 enters it, and each asserts the versions it
 * depends on before running anything — `node` and `tsc` from Node 26, `deno`
 * from `deno`, `bun` from `bun`, both WASM runtimes from `wasm`. A separate job
 * could only repeat those six.
 *
 * All of them are generated for every project, `wasm` excepted — which is a
 * change `package-check` brings. It used to appear only when the project's
 * `package.json` pinned an exact TypeScript, so a project with no compiler of
 * its own got no packed-package check; the compiler is the CI configuration's
 * now, so there is nothing left to be absent. What the job checks is the
 * declarations the tarball ships, and a package shipping none fails it with
 * `TS18003` — see `./todo/ci-generator-audience.md`, which owns the general
 * shape of this trade.
 *
 * @type {(rust: boolean) => Jobs}
 */
const canonicalJobs = rust => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps),
    bun: ubuntuArm(bunSteps),
    ...nodeVersionJobs(),
    [packageCheckJobId]: packageCheckJob,
})

/** @type {(setup: Setup) => Effect<NodeOp, 0, number>} */
export const ci = ({ nodeExtra }) => resultStep(
    access('Cargo.toml'),
    result => {
        const rust = result[0] === 'ok'
        /** @type {Jobs} */
        const jobs = {
            ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
            ...canonicalJobs(rust),
        }
        /** @type {GitHubAction} */
        const gha = {
            name: 'CI',
            on: {
                pull_request: {},
                merge_group: {},
            },
            permissions: {
                contents: 'read',
            },
            jobs,
        }
        const workflowWritten = writeUtf8File(
            '.github/workflows/ci.yml',
            workflowText(gha))
        // The publish workflow is a function of the configuration alone — no
        // job of it varies with the project's Rust, its compiler pin, or the
        // caller's `Setup` — so it is written rather than built here.
        const publishWritten = ioStep(
            workflowWritten,
            () => writeUtf8File(npmPublishPath, workflowText(npmPublishWorkflow)))
        const flakesWritten = ioStep(publishWritten, () => nixFlakes(nixJobs))
        return exitStep(flakesWritten)
    })

export const main = () => ci({ nodeExtra: () => [] })
