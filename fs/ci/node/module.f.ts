/**
 * CI step builders for Node.js: setup-node installation, common npm
 * install/test sequences, per-version job matrices, and the main TSGO step.
 *
 * @module
 */
import { actions, node, tsgo } from '../config/module.f.ts'
import { type Jobs, type MetaStep, type Os, clean, findTgz, install, test, ubuntu } from '../common/module.f.ts'

export const major = (v: string): string => v.split('.')[0]

const installNode = (version: string) =>
    ({ uses: `actions/setup-node@${actions['actions/setup-node']}`, with: { 'node-version': version } })

const nodeInstall = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

export const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    ...nodeInstall(version),
    ...extra,
])

const basicTests = [
    test({ run: 'npm t' }),
    test({ run: 'npm run fst' }),
]

export const nodeTests = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    ...basicTests,
    ...extra,
])

const nodeSteps = (v: string) => [
    ...nodeInstall(v),
    ...basicTests,
]

export const nodeVersions: Jobs = Object.fromEntries(node.others.map(v => [
    `node${major(v)}`,
    ubuntu(nodeSteps(v))
]))

export const nodeMainSteps = (extra: readonly MetaStep[]): readonly MetaStep[] => nodeTests(node.default)([
    // TypeScript Preview
    install({ run: `npm install -g @typescript/native-preview@${tsgo}`}),
    test({ run: 'tsgo' }),
    // extra
    ...extra,
])
