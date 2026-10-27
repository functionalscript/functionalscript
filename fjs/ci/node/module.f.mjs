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

/**
 * @type {() => MetaStep}
 */
export const nodeVersionStep = () =>
    environmentVersionStep('node --version', `v${node}`)


const tscVersionStep = environmentVersionStep(
    'tsc --version', `Version ${typescript.version}`)

/**
 * The Windows platform jobs run host-JS proofs from the checked-out source.
 * No global CLI or runtime dependencies are needed; Node supplies the host.
 *
 * @type {() => readonly MetaStep[]}
 */
export const platformNodeSteps = () => [
    install(installNode()),
    test({ run: 'node --test ./fjs/emergent_testing/js-only.mjs' }),
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
