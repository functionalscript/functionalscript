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
import { functionalscript, images, node } from './config/module.f.mjs'
import {
    architecture,
    os,
    toSteps,
    ubuntuArm
} from './common/module.f.mjs'
import {
    i686Commands,
    i686JobId,
    i686NixJob,
    i686Target,
    rustPlatformCommands,
    rustPlatformSteps,
    rustWasmSteps,
} from './rust/module.f.mjs'
import { nodeMainSteps, nodeNixJobs, nodeVersionJobs } from './node/module.f.mjs'
import { nixFlakes, nixInstall, nixShell, nixSteps, nixVersionStep } from './nix/module.f.mjs'
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

/**
 * Which generated shell a platform job enters, or `undefined` for the runner's
 * own toolchain.
 *
 * One thing keeps a job off Nix entirely: **Windows**, where Nix does not run
 * natively. Everything else enters a shell, and the only question is which.
 *
 * A **32-bit target** takes one to its own. `gcc_multi` — the multilib gcc and
 * `glibc_multi` a 32-bit link needs — exists on `x86_64-linux` alone, and the
 * shared shell builds four systems from one `packages` list, so it cannot carry
 * a package that means nothing on three of them. `../rust/module.f.mjs`'s
 * `i686NixJob` is that shell. The split is conditional on the project having
 * Rust: with no `Cargo.toml` there are no 32-bit checks, and the job shares
 * like the rest.
 *
 * @type {(rust: boolean, o: Os, a: Architecture) => string | undefined}
 */
const platformShell = (rust, o, a) => {
    if (o === 'windows') { return undefined }
    return rust && i686Target(o, a) !== undefined ? i686JobId : nixShell
}

/**
 * A platform job on a generated shell: every command through `nix develop`, and
 * the runtime asserted first.
 *
 * It runs this commit's suite rather than installing a published
 * FunctionalScript and running that. `npm install -g` writes to the read-only
 * store from inside the shell, so keeping the old shape would mean an
 * `NPM_CONFIG_PREFIX` in a flake developers also enter — and the check was the
 * one `deno` and `bun` already dropped, for the reason
 * `./todo/built-package-checks.md` records: it tests a shipped release rather
 * than the commit under review. The two Windows jobs still run it.
 *
 * No `npm ci` either, for the reason the platform jobs already had none: the
 * tree declares no runtime dependency and one `devDependency` that is types, so
 * `node --test` runs the whole suite with no `node_modules` present at all.
 * `npm ci` stays in the three Node jobs, which type-check and pack.
 *
 * The version check is worth more here than in any other job. These are the
 * only places a shell is built for a system other than `aarch64-linux`, so this
 * is what turns four shells that were pinned as text into four that are known
 * to work.
 *
 * @type {(rust: boolean, shell: string, o: Os, a: Architecture) => readonly MetaStep[]}
 */
const shellPlatformSteps = (rust, shell, o, a) => [
    nixInstall,
    nixVersionStep(shell, 'node --version', `v${node.default}`),
    ...nixSteps(shell)([
        ...(rust ? [...rustPlatformCommands, ...i686Commands(o, a)] : []),
        'node --test',
    ]),
]

/** @type {(rust: boolean, nodeExtra: readonly MetaStep[]) => (o: Os) => (a: Architecture) => readonly [string, Job]} */
const job = (rust, nodeExtra) => o => a => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const shell = platformShell(rust, o, a)
    const result = [
        ...(shell === undefined
            ? [
                ...(rust ? rustPlatformSteps(o, a) : []),
                ...nodeMainSteps(functionalscript),
            ]
            : shellPlatformSteps(rust, shell, o, a)),
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
    i686NixJob,
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
