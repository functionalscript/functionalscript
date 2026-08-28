/**
 * Proofs for the browser interpreter.
 *
 * It is a `.mjs` because the interpreter is: these run its real `try`/`catch`,
 * its real clock and its real `Promise.all`, which is the whole of what it is.
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { browserRun } from './module.mjs'
import { all, catch_, sandbox } from '../node/module.f.mjs'
import { do_ } from '../module.f.mjs'

/** @type {(effect: unknown) => Promise<any>} */
const run = browserRun(/** @type {any} */ ({}))

export const proof = {
    // A leaf that throws is an answer, not a failure of the run — the same
    // bargain `effects/node`'s `sandbox` makes.
    sandboxReportsAThrow: async () => {
        const r = await run(sandbox(() => { throw 'boom' }))
        assertEq(r[0], 'ok')
        assertEq(r[1].result[0], 'error')
        assertEq(r[1].result[1], 'boom')
        assert(r[1].duration >= 0)
    },
    // An asynchronous leaf is timed by what it did, not by how quickly it
    // handed back a promise.
    sandboxAwaitsAPromise: async () => {
        const r = await run(sandbox(() => Promise.resolve(1)))
        assertEq(r[1].result[1], 1)
    },
    catchAnswersTheThrownValue: async () => {
        const r = await run(catch_(() => { throw 'thrown' }))
        assertEq(r[0], 'ok')
        assertEq(r[1][0], 'error')
        assertEq(r[1][1], 'thrown')
    },
    // `all` answers in argument order however its children interleave, which is
    // what lets the shared traversal report in structural order.
    allAnswersInArgumentOrder: async () => {
        const slow = sandbox(() => new Promise(resolve => setTimeout(() => resolve('first'), 10)))
        const fast = sandbox(() => 'second')
        const r = await run(all(slow, fast))
        assertEq(r[1][0][1].result[1], 'first')
        assertEq(r[1][1][1].result[1], 'second')
    },
    // A command no handler claims is a panic, not a `NotImplemented` answer:
    // this runner dispatches by exact match, which is why `browserRun` asks for
    // a complete map of the operations it is given. A host that wants a hole to
    // be an ordinary outcome builds on `partialMatch` instead.
    missingOperationRejects: async () => {
        let thrown = false
        // Side effect: `try`/`catch` is not allowed in FunctionalScript, which
        // is why this proof is not one.
        try {
            await run(/** @type {any} */ (do_('missing'))())
        } catch {
            thrown = true
        }
        assert(thrown)
    },
}
