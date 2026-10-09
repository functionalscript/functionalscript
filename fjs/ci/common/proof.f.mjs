/**
 * @import { MetaStep, Step } from './types.ts'
 */

import { actions, images, jobTimeout } from '../config/module.f.js'
import { install, parseGitHubAction, test, toSteps, ubuntu, ubuntuArm, uses } from './module.f.mjs'
import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {Step} */
const setup = { run: 'setup' }

/** @type {Step} */
const check = { run: 'check' }

const checkout = uses('actions/checkout')

export const proof = {
    uses: {
        /** The action is pinned to the version `../config` holds for it. */
        bare: () => {
            assertStructurallySame(checkout, { uses: `actions/checkout@${actions['actions/checkout']}` })
        },
        /** `with` is emitted only when given. */
        with: () => {
            assertStructurallySame(uses('actions/checkout', { a: 'b' }), { uses: checkout.uses, with: { a: 'b' } })
        },
    },
    toSteps: {
        /** Installs come first, then the checkout, then the tests. */
        order: () => {
            assertStructurallySame(
                toSteps([test(check), install(setup)]),
                [setup, checkout, check],
            )
        },
        /** A `rust` step adds the toolchain, once, ahead of everything. */
        rust: () => {
            /** @type {readonly MetaStep[]} */
            const m = [test(check), { type: 'rust' }, { type: 'rust' }]
            assertStructurallySame(
                toSteps(m),
                [uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy' }), checkout, check],
            )
        },
        /** The targets of every `rust` step are joined into one toolchain. */
        targets: () => {
            /** @type {readonly MetaStep[]} */
            const m = [{ type: 'rust', target: 'a' }, { type: 'rust' }, { type: 'rust', target: 'b' }]
            assertStructurallySame(
                toSteps(m),
                [uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy', targets: 'a,b' }), checkout],
            )
        },
    },
    /** Each runner image takes the job's steps and the shared timeout. */
    jobs: () => {
        for (const [f, image] of /** @type {const} */ ([[ubuntu, images.ubuntu.intel], [ubuntuArm, images.ubuntu.arm]])) {
            assertStructurallySame(
                f([test(check)]),
                { 'runs-on': image, 'timeout-minutes': jobTimeout, steps: [checkout, check] },
            )
        }
    },
    parseGitHubAction: {
        /** A workflow the generator could have written is read back. */
        ok: () => {
            const job = ubuntu([test(check)])
            const action = assertOk(parseGitHubAction({
                name: 'test',
                on: {},
                permissions: { contents: 'read' },
                jobs: { check: job },
            }))
            assertStructurallySame(action.jobs.check, job)
        },
        /** A manually selected maintenance ref uses the same workflow schema. */
        manualRelease: () => {
            const action = assertOk(parseGitHubAction({
                name: 'release',
                on: { workflow_dispatch: {} },
                permissions: { contents: 'read', 'id-token': 'write' },
                jobs: { publish: ubuntu([test(check)]) },
            }))
            assertStructurallySame(action.on.workflow_dispatch, {})
            assertEq(action.on.push, undefined)
        },
        /** A job without a timeout is refused. */
        error: () => {
            assertError(parseGitHubAction({
                name: 'test',
                on: {},
                permissions: { contents: 'read' },
                jobs: { check: { 'runs-on': images.ubuntu.intel, steps: [check] } },
            }))
        },
    },
}
