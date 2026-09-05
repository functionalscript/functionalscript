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
    test,
    toSteps,
    ubuntu,
    ubuntuArm
} from './common/module.f.mjs'
import {
    i686JobId,
    i686Steps,
    rustPlatformCommands,
    rustPlatformSteps,
    rustWasmSteps,
} from './rust/module.f.mjs'
import { nodeMainSteps, nodeNixJobs, nodeVersionJobs } from './node/module.f.mjs'
import {
    nixDevelop,
    nixFlakes,
    nixInstall,
    nixShell,
    nixSteps,
    nixVersionStep,
} from './nix/module.f.mjs'
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
 * A platform job on the shared shell: every command through `nix develop`, and
 * the runtime asserted first.
 *
 * All four non-Windows platform jobs enter the same shell, so the matrix
 * differs by platform and by nothing else. Windows is the only exception left,
 * because Nix does not run there natively; 32-bit Linux is a job of its own,
 * `../rust/module.f.mjs`'s `ubuntu-intel32`, and enters this same shell — on
 * Intel Linux it carries the target and the linker that job needs.
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
 * this is what turns four shells that were pinned as text into four that are
 * known to work.
 *
 * @type {(rust: boolean) => readonly MetaStep[]}
 */
const shellPlatformSteps = rust => [
    nixInstall,
    nixVersionStep(nixShell, 'node --version', `v${node.default}`),
    ...nixSteps(nixShell)([
        'npm ci',
        ...(rust ? rustPlatformCommands : []),
        'node --test',
    ]),
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
            run: nixDevelop(nixShell, `${injectedShell} "$${injectedRun}"`),
            env: { ...step.step.env, [injectedRun]: step.step.run },
        })
        : step

/** @type {(rust: boolean, nodeExtra: readonly MetaStep[]) => (o: Os) => (a: Architecture) => readonly [string, Job]} */
const job = (rust, nodeExtra) => o => a => {
    const id = `${o}-${a}`
    const image = images[o][a]
    // Windows is the one platform with no shell to enter, so it keeps the
    // runner's toolchain — and its injected steps keep the runner too.
    const result = o === 'windows'
        ? [
            ...(rust ? rustPlatformSteps(o, a) : []),
            ...nodeMainSteps(functionalscript),
            ...nodeExtra,
        ]
        : [...shellPlatformSteps(rust), ...nodeExtra.map(inShell)]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

/**
 * Every generated flake. Three, for the fourteen jobs `./proof.f.mjs`'s
 * `matrixShape` counts.
 *
 * `dev` is the one a developer enters and the one **nine** of those jobs
 * enter — see `./dev/module.f.mjs` for why sharing is safe where a command
 * names its runtime, and `./node/module.f.mjs` for the two jobs where it is
 * not. **Two** have a flake to themselves: Node 22 and Node 24, whose `node`
 * is the thing under test. **Three** enter none: the two Windows jobs, where
 * Nix does not run, and `package-check`, which has no checkout for a flake to
 * be in.
 *
 * `ubuntu-intel32` was a fourth flake until its shell became a platform of this
 * one. What it needs — a 32-bit `rust-std` and the linker for it — exists on
 * `x86_64-linux` and nowhere else, which is a reason for that *system* to carry
 * more, not for the job to have an environment of its own. See
 * `./dev/module.f.mjs`.
 *
 * `./proof.f.mjs`'s `nixCoverage` reads that split off the generated workflow
 * rather than off this comment, so a job changing sides fails there.
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
    ...(rust
        ? {
            wasm: ubuntuArm(rustWasmSteps),
            // Intel, because that is where a 32-bit x86 target can be built.
            [i686JobId]: ubuntu(i686Steps),
        }
        : {}),
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
