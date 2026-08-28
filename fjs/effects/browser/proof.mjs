/**
 * Proofs for the browser interpreter.
 *
 * It is a `.mjs` because the interpreter is: these run its real `try`/`catch`,
 * its real clock and its real `Promise.all`, which is the whole of what it is.
 *
 * @import { Result } from '../../types/result/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { browserRun } from './module.mjs'
import { all, catch_, sandbox } from '../node/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { do_ } from '../module.f.mjs'

// No `extra`: these proofs exercise the three operations the interpreter has
// of its own.
const run = browserRun({})

/**
 * The value a run answered. The runner answers `ok` for every one of these, so
 * an `error` here is the proof failing — asserted through the shared helper,
 * whose own branches are covered, rather than through a local `if`.
 *
 * @template T
 * @template E
 * @param {Result<T, E>} r
 * @returns {T}
 */
const okValue = r => {
    assertEq(r[0], 'ok', r)
    return /** @type {T} */ (r[1])
}

export const proof = {
    // A leaf that throws is an answer, not a failure of the run — the same
    // bargain `effects/node`'s `sandbox` makes.
    sandboxReportsAThrow: async () => {
        const { result, duration } = okValue(await run(sandbox(() => { throw 'boom' })))
        assertEq(result[0], 'error')
        assertEq(result[1], 'boom')
        assert(duration >= 0)
    },
    // An asynchronous leaf is timed by what it did, not by how quickly it
    // handed back a promise.
    sandboxAwaitsAPromise: async () => {
        assertEq(okValue(await run(sandbox(() => Promise.resolve(1)))).result[1], 1)
    },
    catchAnswersTheThrownValue: async () => {
        const r = okValue(await run(catch_(() => { throw 'thrown' })))
        assertEq(r[0], 'error')
        assertEq(r[1], 'thrown')
    },
    // `all` answers in argument order however its children interleave, which is
    // what lets the shared traversal report in structural order.
    allAnswersInArgumentOrder: async () => {
        const slow = sandbox(() => new Promise(resolve => setTimeout(() => resolve('first'), 10)))
        const fast = sandbox(() => 'second')
        const r = okValue(await run(all(slow, fast)))
        assertEq(okValue(r[0]).result[1], 'first')
        assertEq(okValue(r[1]).result[1], 'second')
    },
    // The mirror of the panic below: a program that claims an operation this
    // runner already implements is the same class of bug as one that asks for
    // an operation it lacks. Resolving it either way would be silent — the
    // answer's type would be a lie, or the caller's handler would be dropped.
    collidingOperationIsRejected: async () => {
        let message
        // Side effect: `try`/`catch` is not allowed in FunctionalScript.
        try {
            browserRun(/** @type {any} */ ({ sandbox: async () => ok('replaced') }))
        } catch (e) {
            message = e
        }
        assertEq(message, 'browserRun: sandbox already implemented')
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
