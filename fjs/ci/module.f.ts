/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { mapStep, step, type Effect } from '../effects/module.f.ts'
import { access, writeUtf8File, type NodeOp } from '../effects/node/module.f.ts'
import { functionalscript, images } from './config/module.f.mjs'
import {
    architecture,
    os,
    toSteps,
    ubuntuArm
} from './common/module.f.mjs'
import type {
    Architecture,
    GitHubAction,
    Job,
    Jobs,
    MetaStep,
    Os,
} from './common/types.ts'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeNixJobs, nodeNixVersionSteps, nodeVersionJobs } from './node/module.f.ts'
import { nixFlakes, nixInstall, type NixJob } from './nix/module.f.ts'
import { bunSteps } from './bun/module.f.mjs'
import { denoSteps } from './deno/module.f.mjs'

const job = (
    rust: boolean,
    nodeExtra: readonly MetaStep[],
) => (o: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustPlatformSteps(o, a) : []),
        ...nodeMainSteps(functionalscript),
        ...nodeExtra,
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
}

// Every generated flake, across all job families that own one.
const nixJobs: readonly NixJob[] = nodeNixJobs

// Temporary: proves the not-yet-migrated flakes still evaluate. Removed once
// the canonical Node jobs check their own flake by running through it.
const nixFlakeJob: Job = ubuntuArm([nixInstall, ...nodeNixVersionSteps])

const canonicalJobs = (rust: boolean): Jobs => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps(functionalscript)),
    bun: ubuntuArm(bunSteps(functionalscript)),
    ...nodeVersionJobs(functionalscript),
    'nix-flakes': nixFlakeJob,
})

export const ci = ({ nodeExtra }: Setup): Effect<NodeOp, number> => step(
    access('Cargo.toml'),
    result => {
        const rust = result[0] === 'ok'
        const jobs: Jobs = {
            ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
            ...canonicalJobs(rust),
        }
        const gha: GitHubAction = {
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
        const flakesWritten = step(workflowWritten, () => nixFlakes(nixJobs))
        return mapStep(flakesWritten, () => 0)
    })

export const main = () => ci({ nodeExtra: () => [] })
