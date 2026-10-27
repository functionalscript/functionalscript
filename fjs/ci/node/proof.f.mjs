import { installNode, platformNodeSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { actions, node } from '../config/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

const steps = toSteps(platformNodeSteps())

const runs = steps.flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    steps: () => {
        assertStructurallySame(
            steps.map(s => s.uses ?? s.run),
            [
                `actions/setup-node@${actions['actions/setup-node']}`,
                `actions/checkout@${actions['actions/checkout']}`,
                'npm start test',
            ])
        assertEq(steps[0]?.with?.['node-version'], node)
    },
    // No `npm ci`. There is nothing to install: `package.json` declares no
    // runtime dependency, and its one `devDependency` is types. A step that
    // installed a directory nothing opens is a minute of six runners.
    noDependencyInstall: () => assert(
        !runs.some(run => run.startsWith('npm ci')),
        `unexpected dependency install: ${runs.join(' | ')}`),
    noGlobalInstall: () => assert(
        !runs.some(run => run.startsWith('npm install -g')),
        'platform tests must use the checkout'),
    // Extra `setup-node` inputs ride along with the pinned Node, and none of
    // them replaces it.
    installNodeInputs: () => assertStructurallySame(
        installNode({
            'registry-url': 'https://registry.example/',
            'node-version': '22.x',
        }).with,
        { 'registry-url': 'https://registry.example/', 'node-version': node }),
}
