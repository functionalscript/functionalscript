/**
 * @import { MetaStep, Step } from './types.ts'
 */

import { actions, images, jobTimeout } from '../config/module.f.js'
import { install, parseGitHubAction, test, toSteps, ubuntu, ubuntuArm, uses } from './module.f.mjs'
import { assertEq, assertError, assertOk } from '../../asserts/module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

const json = stringify(sort)

/** @type {Step} */
const setup = { run: 'setup' }

/** @type {Step} */
const check = { run: 'check' }

const checkout = uses('actions/checkout')

export const proof = {
    uses: {
        /** The action is pinned to the version `../config` holds for it. */
        bare: () => {
            assertEq(json(checkout), json({ uses: `actions/checkout@${actions['actions/checkout']}` }))
        },
        /** `with` is emitted only when given. */
        with: () => {
            assertEq(
                json(uses('actions/checkout', { a: 'b' })),
                json({ uses: checkout.uses, with: { a: 'b' } }),
            )
        },
    },
    toSteps: {
        /** Installs come first, then the checkout, then the tests. */
        order: () => {
            assertEq(
                json(toSteps([test(check), install(setup)])),
                json([setup, checkout, check]),
            )
        },
        /** A `rust` step adds the toolchain, once, ahead of everything. */
        rust: () => {
            /** @type {readonly MetaStep[]} */
            const m = [test(check), { type: 'rust' }, { type: 'rust' }]
            assertEq(
                json(toSteps(m)),
                json([uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy' }), checkout, check]),
            )
        },
        /** The targets of every `rust` step are joined into one toolchain. */
        targets: () => {
            /** @type {readonly MetaStep[]} */
            const m = [{ type: 'rust', target: 'a' }, { type: 'rust' }, { type: 'rust', target: 'b' }]
            assertEq(
                json(toSteps(m)),
                json([uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy', targets: 'a,b' }), checkout]),
            )
        },
    },
    /** Each runner image takes the job's steps and the shared timeout. */
    jobs: () => {
        for (const [f, image] of /** @type {const} */ ([[ubuntu, images.ubuntu.intel], [ubuntuArm, images.ubuntu.arm]])) {
            assertEq(
                json(f([test(check)])),
                json({ 'runs-on': image, 'timeout-minutes': jobTimeout, steps: [checkout, check] }),
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
            assertEq(json(action.jobs.check ?? null), json(job))
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
