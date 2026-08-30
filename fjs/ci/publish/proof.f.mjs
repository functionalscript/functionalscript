import {
    npmPublishJob,
    npmPublishJobId,
    npmPublishPath,
    npmPublishWorkflow,
    publishBranch,
} from './module.f.mjs'
import { images, node } from '../config/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { definedValues } from '../../types/object/module.f.mjs'

const steps = npmPublishJob.steps

/** @type {(fragment: string) => boolean} */
const has = fragment => steps.some(step => step.run?.includes(fragment) === true)

/** @type {(prefix: string) => number} */
const usesIndex = prefix => steps.findIndex(step => step.uses?.startsWith(prefix) === true)

/** @type {(command: string) => number} */
const runIndex = command => steps.findIndex(step => step.run === command)

export const proof = {
    // A publish is not a gate, and the distinction is the whole of this
    // workflow's trigger. `pull_request` would hand a fork's branch the
    // registry's trust, and `merge_group` would publish a merge that has not
    // landed.
    onlyPushesToTheBranch: () => {
        assertEq(npmPublishPath, '.github/workflows/npm-publish.yml')
        assertEq(npmPublishWorkflow.name, 'npm publish')
        assertStructurallySame(npmPublishWorkflow.on.push?.branches, [publishBranch])
        assertEq(publishBranch, 'main')
        assertEq(npmPublishWorkflow.on.pull_request, undefined)
        assertEq(npmPublishWorkflow.on.merge_group, undefined)
    },
    // The token that is not there. `id-token: write` is what trusted publishing
    // exchanges for the registry credential, so the workflow carries no secret
    // — and it is the one permission beyond reading the tree, because a publish
    // writes nowhere in the repository.
    provenanceWithoutASecret: () => {
        assertEq(npmPublishWorkflow.permissions.contents, 'read')
        assertEq(npmPublishWorkflow.permissions['id-token'], 'write')
        assertEq(Object.keys(npmPublishWorkflow.permissions).length, 2)
        assert(has('npm publish --provenance'), 'expected a provenance publish')
        // Dropping `--provenance` would leave `id-token: write` granted and
        // unspent, and the package would publish unattested with nothing red —
        // so it is every publish that has to carry the flag, not merely one.
        assert(
            steps.every(step =>
                step.run?.startsWith('npm publish') !== true
                || step.run === 'npm publish --provenance'),
            'expected every publish attested')
    },
    // The registry named where the job configures npm, not left to whatever the
    // runner or `publishConfig` defaults to.
    configuresTheRegistry: () => {
        const setup = steps[usesIndex('actions/setup-node@')]
        assertEq(setup?.with?.['registry-url'], 'https://registry.npmjs.org/')
        assertEq(setup?.with?.['node-version'], node.default)
    },
    // Order, which is the job. The tool comes first, then the tree, then the
    // install `prepack` reads TypeScript from, and only then the publish.
    stepOrder: () => {
        assertEq(npmPublishJobId, 'publish-npm')
        assertEq(npmPublishJob['runs-on'], images.ubuntu.arm)
        assertEq(definedValues(npmPublishWorkflow.jobs).length, 1)
        // Unlike `package-check`, this job reads the repository: the tarball is
        // built from the checkout rather than downloaded.
        const checkout = usesIndex('actions/checkout@')
        assert(checkout !== -1, 'expected a checkout')
        const install = runIndex('npm ci')
        const publish = runIndex('npm publish --provenance')
        assert(checkout < install, 'expected the checkout before the install')
        assert(install < publish, 'expected the install before the publish')
        // One job, so nothing to wait for — and an ordering edge here would
        // point at a job in the other workflow, which is not a thing GitHub
        // resolves.
        assertEq(npmPublishJob.needs, undefined)
    },
    // Most pushes to the branch do not move the version, and npm answers a
    // republish with a 403. That outcome is expected, so the publish tolerates
    // failure — and nothing else in the workflow may, because for every other
    // step a failure is the report.
    onlyThePublishToleratesFailure: () => {
        assertStructurallySame(
            steps.flatMap(step =>
                step['continue-on-error'] === undefined ? [] : [step.run]),
            ['npm publish --provenance'])
    },
}
