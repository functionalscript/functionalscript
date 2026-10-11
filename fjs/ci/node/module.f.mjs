/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * the selected-version canonical job.
 *
 * @module
 *
 * @import { Jobs, MetaStep, Step } from '../common/types.ts'
 * @import { PackageConsumer } from '../types.ts'
 */

import { node, typescript } from '../config/module.f.js'
import { install, test, ubuntuArm, uses } from '../common/module.f.mjs'
import { nixInstall, nixSteps, nixVersionStep } from '../nix/module.f.mjs'
import { consumerDirectory, packageCheckSteps } from '../package/module.f.mjs'

/** @type {(v: string) => string} */
export const major = v => v.split('.')[0]

/** @type {(version: string) => string} */
const jobId = version => `node${major(version)}`

/**
 * The job that packs the tarball and checks it as a consumer would. Named
 * here so a proof reading the workflow need not repeat the id.
 */
export const packageJobId = jobId(node)

/**
 * Installs the pinned Node through `setup-node`. Every job that installs Node
 * this way installs the selected release; `inputs` are any further
 * `setup-node` inputs the job needs, such as the publish job's `registry-url`.
 * The pin is written last, so an input cannot replace it.
 *
 * @type {(inputs?: Record<string, string>) => Step}
 */
export const installNode = inputs =>
    uses('actions/setup-node', { ...inputs, 'node-version': node })

/** @type {(version: string) => MetaStep} */
const fjsGlobalInstall = version =>
    install({ run: `npm install -g functionalscript@${version}` })

/**
 * Asserts the Node a job is about to run on, through the shared check.
 *
 * `node --version` prints a leading `v` the configured version does not carry,
 * so the expected string restores it. The canonical Node job and the shell
 * platform jobs run this. The steps that install Node through `setup-node` get
 * no check: the Windows platform jobs, which run `run` steps under PowerShell
 * where this POSIX command would not survive, and the packed-package check
 * closing Node 26's job, which takes its Node as a consumer would and enters
 * no flake to check one from.
 *
 * @type {() => MetaStep}
 */
export const nodeVersionStep = () =>
    nixVersionStep('node --version', `v${node}`)

/**
 * Asserts the compiler this job's flake provides.
 *
 * `tsc` here is `typescript-go`'s, and the attribute names no version, so this
 * is the only tie between `../config/module.f.js` and what the shell hands
 * `npm ci`'s successors. It matters more than most: `tsc` is not run as `tsc`
 * alone but through `npm pack`, whose `prepack` script emits the declarations
 * the package ships — a compiler nobody confirmed would put its own idea of a
 * `.d.ts` in the tarball.
 *
 * `tsc --version` prints `Version <v>` and nothing else, which is why the
 * expectation carries that word.
 */
const tscVersionStep = nixVersionStep(
    'tsc --version', `Version ${typescript.version}`)

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
    install(installNode()),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

/**
 * The selected Node job: check the shared shell's runtime and compiler, then
 * check source, generated files and the packed package.
 *
 * `npm start compile` — `npm start` is this tree's `node ./fjs/module.mjs`,
 * as the other `npm` steps here are this tree's scripts — with no arguments is
 * the check that every authored `.f.js` still compiles
 * ([`fjs/compiler`](../../compiler/module.f.mjs)). It runs this working tree's
 * compiler, not a published one, since the promise an `.f.js` makes is about
 * the compiler of the same revision; and it runs once, here, because the
 * answer does not depend on the runtime.
 *
 * `npm pack` writes the tarball outside the checkout, into the consumer
 * directory the packed-package check runs in (`../package/module.f.mjs`). A
 * plain `mkdir` makes that directory first: it is not a Nix command, and
 * without `-p` it fails when the directory already exists, so the check starts
 * from a directory holding nothing but the tarball.
 *
 * `npm run gen` and the drift check it feeds run after every command that
 * touches the checkout. The check compares the working tree against what the
 * generator produces, so that position makes it the last word on the tree: any
 * file an earlier step wrote is in the comparison. Nothing those steps leave
 * behind is tracked: the declarations `npm pack`'s `prepack` emits are
 * ignored, the tarball lands outside the tree, and `--no-update-lock-file`
 * means Nix leaves nothing at all.
 *
 * The drift check itself is not a Nix command. `git` is the runner's tool, and a
 * step names the flake only when it needs something the flake pins.
 *
 * The packed-package check comes after it, and last, behind the `setup-node`
 * that gives it a consumer's Node. Its steps start in the consumer directory,
 * so nothing they write can reach the comparison; and `setup-node` changes
 * `PATH` only for steps after every Nix step.
 *
 * @type {(consumer: PackageConsumer | undefined) => readonly MetaStep[]}
 */
const nodeSteps = consumer => [
    nixInstall,
    nodeVersionStep(),
    tscVersionStep,
    ...nixSteps(['npm ci', 'tsc', 'npm start compile', 'npm run cov']),
    test({ run: `mkdir ${consumerDirectory}` }),
    ...nixSteps([`npm pack --pack-destination ${consumerDirectory}`, 'npm run gen']),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    // The consumer's Node. `setup-node` reads the checkout's `package.json`
    // to decide whether to restore an npm cache, so caching is off: a
    // consumer's setup must not depend on the repository it consumes.
    test(installNode({ 'package-manager-cache': 'false' })),
    ...packageCheckSteps(consumer).map(test),
]

/** @type {(consumer: PackageConsumer | undefined) => Jobs} */
export const nodeVersionJobs = consumer => ({
    [packageJobId]: ubuntuArm(nodeSteps(consumer)),
})
