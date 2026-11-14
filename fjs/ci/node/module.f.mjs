/**
 * CI step builders for Node.js: installation, source checks, coverage and
 * the separate packed-package consumer.
 *
 * @module
 *
 * @import { Job, Jobs, MetaStep, Step } from '../common/types.ts'
 * @import { PackageConsumer } from '../types.ts'
 */

import { images, jobTimeout, node, typescript } from '../config/module.f.js'
import { install, test, ubuntuArm, uses } from '../common/module.f.js'
import { environmentCommand, environmentSteps, environmentVersionStep } from '../environment/module.f.js'
import { consumerDirectory, packageCheckSteps } from '../package/module.f.mjs'

/**
 * The isolated consumer job, after the source job uploads its tarball.
 */
export const packageJobId = /** @type {const} */ ('package')

/** One artifact shared by the producer and the consumer in the same run. */
const packageArtifact = /** @type {const} */ ('package-tarball')

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

/** Only the repository's permitted CI runs publish module successes. @type {string} */
export const coverageSyncFlag = "${{ github.actor != 'dependabot[bot]' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && '--sync' || '' }}"

/** Isolated coverage, optionally synchronizing successful manifests. @type {(synchronize?: boolean) => Job} */
export const coverageJob = (synchronize = false) => ({
    ...ubuntuArm([
        nodeVersionStep(),
        ...environmentSteps(['npm ci']),
        test({
            run: environmentCommand(synchronize ? `npm start -- cov node ${coverageSyncFlag}` : 'npm start cov node'),
            ...(synchronize ? { env: {
                GIT_AUTHOR_NAME: 'github-actions[bot]',
                GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
                GIT_COMMITTER_NAME: 'github-actions[bot]',
                GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
            } } : {}),
        }),
    ]),
    ...(synchronize ? { permissions: { contents: 'write' } } : {}),
})

/**
 * @type {readonly MetaStep[]}
 */
const nodeSteps = [
    nodeVersionStep(),
    tscVersionStep,
    ...environmentSteps(['npm ci', 'tsc']),
    // Temporary until every authored file forms a generic AST (module-dependency-graph-command.md).
    test({ run: environmentCommand('npm start deps'), 'continue-on-error': true }),
    ...environmentSteps(['npm start compile', 'npm start t']),
    test({ run: `mkdir ${consumerDirectory}` }),
    ...environmentSteps([`npm pack --pack-destination ${consumerDirectory}`, 'npm run gen']),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    test(uses('actions/upload-artifact', {
        name: packageArtifact,
        path: '${{ runner.temp }}/consumer/*.tgz',
        'if-no-files-found': 'error',
    })),
]

/** @type {() => Jobs} */
export const nodeVersionJobs = () => ({
    node: ubuntuArm(nodeSteps),
})

/**
 * Tests the producer's exact tarball with consumer tooling on a fresh runner.
 * No checkout, mise or successful-check cache can supply missing package files.
 * @type {(consumer: PackageConsumer | undefined) => Job}
 */
export const packageJob = consumer => ({
    'runs-on': images.ubuntu.arm,
    'timeout-minutes': jobTimeout,
    needs: ['node'],
    steps: [
        installNode({ 'package-manager-cache': 'false' }),
        uses('actions/download-artifact', {
            name: packageArtifact,
            path: '${{ runner.temp }}/consumer',
        }),
        ...packageCheckSteps(consumer),
    ],
})
