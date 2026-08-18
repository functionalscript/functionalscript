/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * See `./types.ts` for the `Setup` type-level API.
 *
 * @module
 *
 * @import { RawEffect } from '../effects/types.ts'
 * @import { NodeOp } from '../effects/node/types.ts'
 * @import { Architecture, GitHubAction, Job, Jobs, MetaStep, Os } from './common/types.ts'
 * @import { NixJob } from './nix/types.ts'
 * @import { Setup } from './types.ts'
 * @import { Effect } from '../effects/io/types.ts'
 */

import { resultStep } from '../effects/io/module.f.mjs'
import { access, exitStep, writeUtf8File } from '../effects/node/module.f.mjs'
import { step as ioStep } from '../effects/io/module.f.mjs'
import { functionalscript, images } from './config/module.f.mjs'
import {
    architecture,
    os,
    toSteps,
    ubuntuArm
} from './common/module.f.mjs'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.mjs'
import { nodeMainSteps, nodeNixJobs, nodeNixVersionSteps, nodeVersionJobs } from './node/module.f.mjs'
import { nixFlakes, nixInstall } from './nix/module.f.mjs'
import { bunSteps } from './bun/module.f.mjs'
import { denoSteps } from './deno/module.f.mjs'

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

// Every generated flake, across all job families that own one.
/** @type {readonly NixJob[]} */
const nixJobs = nodeNixJobs

// Temporary: proves the not-yet-migrated flakes still evaluate. Removed once
// the canonical Node jobs check their own flake by running through it.
/** @type {Job} */
const nixFlakeJob = ubuntuArm([nixInstall, ...nodeNixVersionSteps])

/** @type {(rust: boolean) => Jobs} */
const canonicalJobs = rust => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps(functionalscript)),
    bun: ubuntuArm(bunSteps(functionalscript)),
    ...nodeVersionJobs(functionalscript),
    'nix-flakes': nixFlakeJob,
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
