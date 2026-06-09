/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs, and the main TSGO step.
 *
 * @module
 */
import { node, tsgo } from '../config/module.f.ts'
import { type Job, type Jobs, type MetaStep, type Os, clean, install, test, ubuntuArm, uses } from '../common/module.f.ts'

export const major = (v: string): string => v.split('.')[0]

const installNode = (version: string) =>
    uses('actions/setup-node', { 'node-version': version })

const nodeInstall = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

export const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    ...nodeInstall(version),
    ...extra,
])

const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

export const platformNodeSteps = (version: string): readonly MetaStep[] => [
    install(installNode(node.default)),
    fjsGlobalInstall(version),
    test({ run: 'fjs t' }),
]

const node22Steps = (version: string): readonly MetaStep[] => clean([
    install(installNode(node.node22)),
    fjsGlobalInstall(version),
    test({ run: 'fjs t' }),
])

const node24Steps: readonly MetaStep[] = clean([
    ...nodeInstall(node.node24),
    test({ run: 'node --test' }),
])

const node26Steps: readonly MetaStep[] = clean([
    ...nodeInstall(node.default),
    install({ run: `npm install -g @typescript/native-preview@${tsgo}`}),
    test({ run: 'npx tsc' }),
    test({ run: 'tsgo' }),
    test({ run: 'npm run cov' }),
    test({ run: 'npm pack' }),
])

const nodeJob = (steps: readonly MetaStep[]): Job => ubuntuArm(steps)

export const nodeVersionJobs = (version: string): Jobs => ({
    [`node${major(node.node22)}`]: nodeJob(node22Steps(version)),
    [`node${major(node.node24)}`]: nodeJob(node24Steps),
    [`node${major(node.default)}`]: nodeJob(node26Steps),
})

export const nodeMainSteps = platformNodeSteps
