import { platformNodeSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { actions, node } from '../config/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

const version = /** @type {const} */ ('9.9.9')

const steps = toSteps(platformNodeSteps(version))

const runs = steps.flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    // The six platform jobs, whole: the pinned Node, a published CLI, and the
    // suite run by it. `actions/checkout` lands between the installs and the
    // commands, which is `toSteps`' doing rather than this builder's.
    steps: () => {
        assertStructurallySame(
            steps.map(s => s.uses ?? s.run),
            [
                `actions/setup-node@${actions['actions/setup-node']}`,
                `npm install -g functionalscript@${version}`,
                `actions/checkout@${actions['actions/checkout']}`,
                'fjs test',
            ])
        // The Node these jobs install is the configured one, not the version
        // under test — that argument names the *package* to install globally.
        assertEq(steps[0]?.with?.['node-version'], node.default)
    },
    // No `npm ci`. There is nothing to install: `package.json` declares no
    // runtime dependency, and its one `devDependency` is types. A step that
    // installed a directory nothing opens is a minute of six runners.
    noDependencyInstall: () => assert(
        !runs.some(run => run.startsWith('npm ci')),
        `unexpected dependency install: ${runs.join(' | ')}`),
    // The published CLI is the point of these jobs, and the only place it is
    // exercised. It must be a version rather than a range, so a job that goes
    // red names a release someone can install.
    publishedCli: () => {
        assert(
            runs.includes(`npm install -g functionalscript@${version}`),
            'expected the published CLI installed globally')
        assert(runs.includes('fjs test'), 'expected the suite run by that CLI')
    },
}
