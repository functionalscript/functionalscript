/**
 * @import { MetaStep, Step } from './types.ts'
 */

import { actions, images, jobTimeout } from '../config/module.f.js'
import { architecture, install, isUbuntuArm, job, npmGlobalInstall, os, parseGitHubAction, test, toSteps, ubuntu, ubuntuArm, uses } from './module.f.mjs'
import { assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'

/** @type {Step} */
const setup = { run: 'setup' }

/** @type {Step} */
const check = { run: 'check' }

const checkout = uses('actions/checkout')

export const proof = {
    /** Of every platform, only Ubuntu on ARM is the canonical runner's. */
    isUbuntuArm: () => {
        assertStructurallySame(
            os.flatMap(v => architecture.flatMap(a => isUbuntuArm(v, a) ? [`${v}-${a}`] : [])),
            ['ubuntu-arm'],
        )
    },
    /** A pinned global npm install is an `install` step running `npm install -g`. */
    npmGlobalInstall: () => {
        assertStructurallySame(
            npmGlobalInstall('pkg')('1.2.3'),
            install({ run: 'npm install -g pkg@1.2.3' }),
        )
    },
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
    job: {
        /** Each runner image takes the job's steps and the shared timeout. */
        ubuntu: () => {
            for (const [f, image] of /** @type {const} */ ([[ubuntu, images.ubuntu.intel], [ubuntuArm, images.ubuntu.arm]])) {
                assertStructurallySame(
                    f([test(check)]),
                    { 'runs-on': image, 'timeout-minutes': jobTimeout, steps: [checkout, check] },
                )
            }
        },
        /** A condition becomes the job's `if`. */
        condition: () => {
            assertStructurallySame(
                job(images.macos.arm, 'c')([test(check)]),
                { 'runs-on': images.macos.arm, if: 'c', 'timeout-minutes': jobTimeout, steps: [checkout, check] },
            )
        },
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
