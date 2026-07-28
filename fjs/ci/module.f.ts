/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * `ci` writes both generated files — `.github/workflows/ci.yml` and
 * `docker/Dockerfile` — from the pins in `./config/module.f.ts`. Their
 * directories are created first, so the command also works in a project that
 * has neither yet, and a failed write becomes a non-zero exit code instead of
 * a silently missing file.
 *
 * @module
 */
import { history, historyStep, mapStep, okStep, step, type Effect } from '../effects/module.f.ts'
import { access, mkdir, writeUtf8File, type IoResult, type NodeOp } from '../effects/node/module.f.ts'
import { join } from '../path/module.f.ts'
import { functionalscript, images } from './config/module.f.ts'
import {
    type Architecture,
    type GitHubAction,
    type Job,
    type Jobs,
    type MetaStep,
    type Os,
    architecture,
    os,
    toSteps,
    ubuntuArm
} from './common/module.f.ts'
import { dockerfile, dockerJobs } from './docker/module.f.ts'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersionJobs } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

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

const canonicalJobs = (rust: boolean): Jobs => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps(functionalscript)),
    bun: ubuntuArm(bunSteps(functionalscript)),
    ...nodeVersionJobs(functionalscript),
    playwright: playwrightJob,
    // Both architectures build the image the same generator writes, so a
    // change to it fails CI rather than a contributor's machine.
    ...dockerJobs(rust),
})

/**
 * Writes one generated file, creating its directory first: `writeFile` fails
 * with `ENOENT` in a project that does not have `dir` yet.
 */
const writeGenerated = (dir: string, name: string, content: string): Effect<NodeOp, IoResult<void>> =>
    step(mkdir(dir, { recursive: true }), okStep(() => writeUtf8File(join(dir, name), content)))

/** `1` when a generated file could not be written, `0` otherwise. */
const exitCode = ([tag]: IoResult<void>): number => tag === 'error' ? 1 : 0

/** The workflow a project gets, with Rust jobs only when it has a crate. */
const workflowOf = (nodeExtra: Setup['nodeExtra'], rust: boolean): GitHubAction => ({
    name: 'CI',
    on: {
        pull_request: {},
        merge_group: {},
    },
    permissions: {
        contents: 'read',
    },
    jobs: {
        ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
        ...canonicalJobs(rust),
    },
})

export const ci = ({ nodeExtra }: Setup): Effect<NodeOp, number> => {
    // Rust support is whether the project has a crate at all.
    const rust = mapStep(access('Cargo.toml'), ([tag]) => tag === 'ok')
    const workflow = historyStep(history(rust), r =>
        writeGenerated('.github/workflows', 'ci.yml', JSON.stringify(workflowOf(nodeExtra, r), null, '  ')))
    // The container image installs the same pinned versions the workflow does,
    // so both generated files are written by the same command. `historyStep`
    // keeps `rust` reachable here without nesting this write inside the one
    // above.
    const docker = step(workflow, ([written, r]) =>
        okStep(() => writeGenerated('docker', 'Dockerfile', dockerfile(r)))(written))
    return mapStep(docker, exitCode)
}

export const main = () => ci({ nodeExtra: () => [] })
