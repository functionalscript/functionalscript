/**
 * CI step builders for Node.js: setup-node installation, common npm
 * install/test sequences, per-version job matrices, and the main TSGO step.
 *
 * @module
 */
import { node, tsgo } from '../config/module.f.ts'
import { type Jobs, type MetaStep, type Os, clean, findTgz, install, test, ubuntu } from '../common/module.f.ts'

export const major = (v: string): string => v.split('.')[0]

const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v6', with: { 'node-version': version } })

export const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    install(installNode(version)),
    test({ run: 'npm ci' }),
    ...extra,
])

export const nodeTests = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    test({ run: 'npm test' }),
    test({ run: 'npm run fst' }),
    ...extra,
])

const nodeSteps = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
    test({ run: 'npm t'}),
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
