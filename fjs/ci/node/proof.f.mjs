import { coverageJob, coverageSyncFlag, installNode, nodeVersionJobs, packageJob, packageJobId, platformNodeSteps } from './module.f.mjs'
import { toSteps } from '../common/module.f.mjs'
import { environmentCommand } from '../environment/module.f.mjs'
import { actions, node } from '../config/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

const steps = toSteps(platformNodeSteps())

const runs = steps.flatMap(s => s.run !== undefined ? [s.run] : [])

export const proof = {
    canonicalAstCheck: () => {
        const job = nodeVersionJobs().node
        assert(job !== undefined)
        const { steps: canonicalSteps } = job
        const matching = canonicalSteps.filter(step => step.run === environmentCommand('npm start deps'))
        assertEq(matching.length, 1)
        const [check] = matching
        assert(check !== undefined)
        assertEq(check.if, undefined)
        assertEq(check['continue-on-error'], true)
        assertEq(check['working-directory'], undefined)
        for (const command of ['tsc', 'npm start compile', 'npm start t']) {
            assertEq(canonicalSteps.find(step => step.run === environmentCommand(command))?.['continue-on-error'], undefined)
        }
        const checkout = canonicalSteps.findIndex(step => step.uses?.startsWith('actions/checkout@'))
        assert(checkout >= 0 && canonicalSteps.indexOf(check) > checkout)
    },
    fullSuite: () => {
        const job = nodeVersionJobs().node
        assert(job !== undefined)
        const tests = job.steps.filter(step => step.run === environmentCommand('npm start t'))
        assertEq(tests.length, 1)
        assertEq(tests[0]?.['continue-on-error'], undefined)
        assert(!job.steps.some(step => step.run === environmentCommand('npm run cov')))
    },
    packedConsumer: () => {
        const consumer = packageJob(undefined)
        assertEq(packageJobId, 'package')
        assertStructurallySame(consumer.needs, ['node'])
        assertEq(consumer.steps[0]?.with?.['node-version'], node)
        assertEq(consumer.steps[0]?.with?.['package-manager-cache'], 'false')
        assertEq(consumer.steps[1]?.uses, `actions/download-artifact@${actions['actions/download-artifact']}`)
        assert(consumer.steps.every(step => !step.uses?.startsWith('actions/checkout@') && !step.uses?.startsWith('jdx/mise-action@')))
        assert(consumer.steps.some(step => step.run === 'npx tsc'))
    },
    coverage: () => {
        assertStructurallySame(coverageJob().steps.flatMap(step => step.run === undefined ? [] : [step.run]), [
            `test "$(env node --version)" = "v${node}"`,
            environmentCommand('npm ci'),
            environmentCommand('npm start cov node'),
        ])
        const synced = coverageJob(true)
        assertStructurallySame(synced.permissions, { contents: 'write' })
        assertEq(synced.steps.at(-1)?.run, environmentCommand(`npm start -- cov node ${coverageSyncFlag}`))
        assertStructurallySame(synced.steps.at(-1)?.env, {
            GIT_AUTHOR_NAME: 'github-actions[bot]',
            GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
            GIT_COMMITTER_NAME: 'github-actions[bot]',
            GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        })
        assertEq(coverageJob(false).permissions, undefined)
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
