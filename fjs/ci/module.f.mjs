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
import { rustPlatformSteps, rustWasmSteps, wasmNixJob } from './rust/module.f.mjs'
import { nodeMainSteps, nodeNixJobs, nodeVersionJobs } from './node/module.f.mjs'
import { nixFlakes } from './nix/module.f.mjs'
import { packageCheckJob, packageCheckJobId } from './package/module.f.mjs'
import { bunNixJob, bunSteps } from './bun/module.f.mjs'
import { devNixJob, devSteps } from './dev/module.f.mjs'
import { denoNixJob, denoSteps } from './deno/module.f.mjs'

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
 * Every generated flake, across all job families that own one. Each family
 * declares its own environment beside the steps that enter it; this is the list
 * the generator writes out, and the only place the whole set is visible.
 *
 * `wasm` is here only conditionally in spirit: its flake is generated whether or
 * not the project has a `Cargo.toml`, because the generator writes flakes from
 * this list rather than from the jobs it emitted. A project without Rust gets a
 * `nix/wasm` directory it never enters — the same trade `./todo/ci-generator-audience.md`
 * describes for every other job this generator writes unconditionally.
 *
 * One canonical job is absent: `package-check` runs with no checkout, so there
 * is no file tree for a flake to be in. `./todo/65z-ci-nix.md` says why, and
 * `./proof.f.mjs`'s `nixCoverage` keeps the list from growing by accident.
 *
 * `dev` is the one entry that is not a runtime under test. It is the developer
 * environment, and it is here rather than hand-written so that it cannot drift
 * from the jobs it is the union of — and so that the drift check covers it.
 *
 * @type {readonly NixJob[]}
 */
export const nixJobs = [
    ...nodeNixJobs,
    denoNixJob,
    wasmNixJob,
    bunNixJob,
    devNixJob,
]

/**
 * Every job that is not the platform matrix.
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
    dev: ubuntuArm(devSteps),
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
            JSON.stringify(gha, null, '  '))
        const flakesWritten = ioStep(workflowWritten, () => nixFlakes(nixJobs))
        return exitStep(flakesWritten)
    })

export const main = () => ci({ nodeExtra: () => [] })
