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
import { install, npmGlobalInstall, test, ubuntuArm, uses } from '../common/module.f.mjs'
import { environmentSteps, environmentVersionStep } from '../environment/module.f.mjs'
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

const fjsGlobalInstall = npmGlobalInstall('functionalscript')

/**
 * @type {() => MetaStep}
 */
export const nodeVersionStep = () =>
    environmentVersionStep('node --version', `v${node}`)


const tscVersionStep = environmentVersionStep(
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
 * @type {(consumer: PackageConsumer | undefined) => readonly MetaStep[]}
 */
const nodeSteps = consumer => [
    nodeVersionStep(),
    tscVersionStep,
    ...environmentSteps(['npm ci', 'tsc', 'npm start compile', 'npm run cov']),
    test({ run: `mkdir ${consumerDirectory}` }),
    ...environmentSteps([`npm pack --pack-destination ${consumerDirectory}`, 'npm run gen']),
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
