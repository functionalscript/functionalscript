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
 * @import { Result } from '../types/result/types.ts'
 * @import { IoChannel } from '../effects/node/types.ts'
 */

import { resultStep } from '../effects/module.f.mjs'
import { access, exitStep, readUtf8File, writeUtf8File } from '../effects/node/module.f.mjs'
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
import { parse as jsonParse } from '../media/json/module.f.mjs'
import { packageCheckJob, packageCheckJobId } from './package/module.f.mjs'
import { bunSteps } from './bun/module.f.mjs'
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
 * Three canonical jobs are absent from it. `bun` and `wasm` wait on Nixpkgs, for
 * unrelated reasons — `./todo/bun-nix-blocked-on-nixpkgs.md` and
 * `./todo/wasm-nix-blocked-on-rust-targets.md` — and `package-check` runs with no
 * checkout, so there is no file tree for a flake to be in. `./todo/65z-ci-nix.md`
 * keeps the three reasons together, and `./proof.f.mjs`'s `nixCoverage` keeps the
 * list from growing by accident.
 *
 * @type {readonly NixJob[]}
 */
export const nixJobs = [...nodeNixJobs, denoNixJob]

/** @type {(rust: boolean, pin: string | undefined) => Jobs} */
const canonicalJobs = (rust, pin) => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps),
    bun: ubuntuArm(bunSteps),
    ...nodeVersionJobs(),
    ...(pin === undefined ? {} : { [packageCheckJobId]: packageCheckJob(pin) }),
})

/** @type {(s: string) => boolean} */
const digits = s => s !== '' && [...s].every(c => c >= '0' && c <= '9')

/**
 * `=MAJOR.MINOR.PATCH` and nothing else.
 *
 * Anything npm reads as a *range* — `^7.0.0`, `=7.x`, `=7.0`, `=7.0.2 || 8.x` —
 * lets a later registry release change this check's verdict with no change
 * here, which is the one thing running it without a checkout is meant to
 * prevent. A leading `=` is not enough on its own: it can prefix a range. So
 * the whole value is validated rather than its first character.
 *
 * A prerelease pin is rejected too. That is stricter than npm needs, and the
 * cost of being wrong is the job disappearing from `ci.yml` — a visible diff in
 * review — rather than a check that silently stops meaning anything.
 *
 * @type {(pin: string) => boolean}
 */
const exact = pin => {
    if (!pin.startsWith('=')) { return false }
    const parts = pin.slice(1).split('.')
    return parts.length === 3 && parts.every(digits)
}

/**
 * The compiler the packed-package check installs, read out of the project's own
 * `package.json` rather than restated anywhere. A second copy could disagree
 * with this one silently, and a check running a compiler the package does not
 * pin is a green result about the wrong thing.
 *
 * `undefined` when there is no package.json or no pin: the check cannot be run
 * deterministically then, so it is not generated at all rather than run against
 * a compiler nobody chose.
 *
 * @type {(text: Result<string, IoChannel>) => string | undefined}
 */
const compilerPin = text => {
    if (text[0] !== 'ok') { return undefined }
    const json = jsonParse(text[1])
    if (json[0] !== 'ok') { return undefined }
    const root = json[1]
    if (typeof root !== 'object' || root === null || root instanceof Array) { return undefined }
    const dev = root.devDependencies
    if (typeof dev !== 'object' || dev === null || dev instanceof Array) { return undefined }
    const pin = dev.typescript
    return typeof pin === 'string' && exact(pin) ? pin : undefined
}

/** @type {(setup: Setup) => Effect<NodeOp, 0, number>} */
export const ci = ({ nodeExtra }) => resultStep(
    readUtf8File('package.json'),
    packageJson => resultStep(
    access('Cargo.toml'),
    result => {
        const rust = result[0] === 'ok'
        const pin = compilerPin(packageJson)
        /** @type {Jobs} */
        const jobs = {
            ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
            ...canonicalJobs(rust, pin),
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
    }))

export const main = () => ci({ nodeExtra: () => [] })
