/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs.
 *
 * @module
 *
 * @import { Job, Jobs, MetaStep, Step } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { node, typescript } from '../config/module.f.mjs'
import { install, test, ubuntuArm, uses } from '../common/module.f.mjs'
import { nixInstall, nixShell, nixSteps, nixSystems, nixVersionStep } from '../nix/module.f.mjs'

/**
 * Name of the CI artifact carrying the `npm pack` tarball. The producing step
 * is below; a consuming job downloads it by this name.
 */
export const packageArtifact = /** @type {const} */ ('package-tarball')

/** @type {(v: string) => string} */
export const major = v => v.split('.')[0]

/** @type {(version: string) => string} */
const jobId = version => `node${major(version)}`

/**
 * The job that packs the tarball and uploads it. A consuming job names this in
 * `needs` rather than repeating the id.
 */
export const packageJobId = jobId(node.default)

/** @type {(v: string) => Step} */
const installNode = v =>
    uses('actions/setup-node', { 'node-version': v })

/** @type {(version: string) => MetaStep} */
const fjsGlobalInstall = version =>
    install({ run: `npm install -g functionalscript@${version}` })

/**
 * Asserts the Node a job is about to run on, through the shared check.
 *
 * `node --version` prints a leading `v` the configured version does not carry,
 * so the expected string restores it. Every canonical Node job runs this, and
 * none needs a `setup-node` spelling any more. The other jobs that install Node
 * get no check: the platform matrix, whose Windows jobs run `run` steps under
 * PowerShell where this POSIX command would not survive, and `package-check`,
 * which has no checkout to enter a flake from.
 *
 * It takes the shell to enter, because the three canonical jobs no longer enter
 * the same one — see {@link nodeNixJobs}.
 *
 * @type {(shell: string, version: string) => MetaStep}
 */
const nodeVersionStep = (shell, version) =>
    nixVersionStep(shell, 'node --version', `v${version}`)

/**
 * Asserts the compiler this job's flake provides.
 *
 * `tsc` here is `typescript-go`'s, and the attribute names no version, so this
 * is the only tie between `../config/module.f.mjs` and what the shell hands
 * `npm ci`'s successors. It matters more than most: `tsc` is not run as `tsc`
 * alone but through `npm pack`, whose `prepack` script emits the declarations
 * the package ships — a compiler nobody confirmed would put its own idea of a
 * `.d.ts` in the tarball.
 *
 * `tsc --version` prints `Version <v>` and nothing else, which is why the
 * expectation carries that word.
 */
const tscVersionStep = nixVersionStep(
    nixShell, 'tsc --version', `Version ${typescript.version}`)

/**
 * The platform matrix's Node half: install the pinned Node, install a published
 * FunctionalScript globally, run the suite with it.
 *
 * No `npm ci`. These six jobs exercise the *published* CLI against this working
 * tree, and the tree has no runtime dependency to install — `package.json`
 * declares none, and its one `devDependency` is `@types/node`, which is types
 * and so is never loaded by anything running here. The step used to bring the
 * compiler too; that moved to the flakes, and what was left installed a
 * directory nothing opens.
 *
 * The Node jobs still run `npm ci`, inside their shells, because they are the
 * ones that type-check, pack and publish — and because `npm ci` is itself worth
 * exercising once against the lockfile. Six more copies of it on six runner
 * images were not adding a seventh thing to that.
 *
 * @type {(version: string) => readonly MetaStep[]}
 */
export const platformNodeSteps = version => [
    install(installNode(node.default)),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

/**
 * A Node job that runs the suite and nothing else: install Nix, check the
 * runtime its flake provides, install dependencies, run the proofs. Node 22 and
 * Node 24 differ only in the version they name, so they share this.
 *
 * The check precedes `npm ci`, which runs `preinstall`/`install`/`postinstall`
 * hooks from the project and its dependencies — code that would otherwise
 * execute on a runtime nothing has confirmed. Every command after it enters the
 * shell again, one step each (root `AGENTS.md` §7).
 *
 * @type {(version: string) => readonly MetaStep[]}
 */
const suiteNixSteps = version => [
    nixInstall,
    nodeVersionStep(jobId(version), version),
    ...nixSteps(jobId(version))(['npm ci', 'node --test']),
]

/**
 * The generated-file job, migrated. Its commands run on the pinned Node like
 * Node 24's, with two differences that come from what this job does rather than
 * from Nix.
 *
 * `npm run gen` and the drift check it feeds run **last**, after every
 * other command. The check compares the working tree against what the generator
 * produces, so putting it at the end makes it the last word: any file an earlier
 * step wrote is in the comparison. Nothing those steps leave behind is tracked:
 * `npm pack`'s tarball and the declarations its `prepack` emits are ignored, and
 * `--no-update-lock-file` means Nix leaves nothing at all.
 *
 * The drift check itself is not a Nix command. `git` is the runner's tool, and a
 * step names the flake only when it needs something the flake pins.
 *
 * @type {readonly MetaStep[]}
 */
const node26NixSteps = [
    nixInstall,
    nodeVersionStep(nixShell, node.default),
    tscVersionStep,
    ...nixSteps(nixShell)(
        ['npm ci', 'tsc', 'npm run cov', 'npm pack', 'npm run gen']),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    // Hands the tarball to a job that has no checkout, which is the only place
    // the package can be checked as a consumer sees it. `if-no-files-found`
    // must be `error`: the default warns and uploads nothing, so a consuming
    // job would fail later on a missing artifact rather than here on the real
    // cause.
    test(uses('actions/upload-artifact', {
        name: packageArtifact,
        path: '*.tgz',
        'if-no-files-found': 'error',
    })),
]

/** @type {(steps: readonly MetaStep[]) => Job} */
const nodeJob = steps => ubuntuArm(steps)

/** @type {() => Jobs} */
export const nodeVersionJobs = () => ({
    [jobId(node.node22)]: nodeJob(suiteNixSteps(node.node22)),
    [jobId(node.node24)]: nodeJob(suiteNixSteps(node.node24)),
    [jobId(node.default)]: nodeJob(node26NixSteps),
})

/** @type {(version: string) => NixJob} */
const nixJob = version => ({
    id: jobId(version),
    systems: nixSystems,
    packages: [`nodejs_${major(version)}`],
})

/**
 * The Node versions that need a flake of their own, and the whole of why any
 * job still does.
 *
 * `npm ci` and `node --test` name no runtime: they run whichever `node` reaches
 * `PATH` first. That is the one thing a shared shell cannot serve, because one
 * shell has one `node` — so these two get a flake each, carrying the single
 * release each exists to prove this code runs on.
 *
 * Node 26 is absent, and not because it needs less. Its `node` *is* the shared
 * shell's, and the compiler it also needs is there too, so it enters that shell
 * like every other job whose runtime is named rather than resolved.
 *
 * @type {readonly NixJob[]}
 */
export const nodeNixJobs = [
    nixJob(node.node22),
    nixJob(node.node24),
]

export const nodeMainSteps = platformNodeSteps
