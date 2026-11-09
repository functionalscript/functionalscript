import { coverageJob, installNode, nodeVersionJobs, packageJobId, platformNodeSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { environmentCommand } from '../environment/module.f.mjs'
import { actions, node } from '../config/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

const steps = toSteps(platformNodeSteps())

const runs = steps.flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    canonicalAstCheck: () => {
        const job = nodeVersionJobs(undefined)[packageJobId]
        assert(job !== undefined)
        const { steps: canonicalSteps } = job
        const matching = canonicalSteps.filter(step => step.run === environmentCommand('npm start deps'))
        assertEq(matching.length, 1)
        const [check] = matching
        assert(check !== undefined)
        assertEq(check.if, undefined)
        assertEq(check['continue-on-error'], true)
        assertEq(check['working-directory'], undefined)
        for (const command of ['tsc', 'npm start compile', 'npm run cov']) {
            assertEq(canonicalSteps.find(step => step.run === environmentCommand(command))?.['continue-on-error'], undefined)
        }
        const checkout = canonicalSteps.findIndex(step => step.uses?.startsWith('actions/checkout@'))
        assert(checkout >= 0 && canonicalSteps.indexOf(check) > checkout)
    },
    coverage: () => {
        assertEq(coverageJob.steps.at(-1)?.['continue-on-error'], true)
        assertStructurallySame(coverageJob.steps.flatMap(step => step.run === undefined ? [] : [step.run]), [
            `test "$(env node --version)" = "v${node}"`,
            environmentCommand('npm ci'),
            environmentCommand('npm start cov node'),
        ])
    },
    steps: () => {
        assertStructurallySame(
            steps.map(s => s.uses ?? s.run),
            [
                `actions/setup-node@${actions['actions/setup-node']}`,
                `actions/checkout@${actions['actions/checkout']}`,
                'node --test ./fjs/emergent_testing/js-only.mjs',
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
