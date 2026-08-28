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
    // **The page must stay alive while a suite runs.** Leaves resolve through
    // microtasks, and a microtask drain never returns to the event loop, so
    // without a yield the whole suite is one task: no paint, no timer, no
    // click, for as long as it takes. This posts a message before the run and
    // asks whether it was delivered while the run was still going — under a
    // single-task run it cannot be, because nothing else gets a turn until the
    // run is over.
    theThreadIsGivenBackDuringARun: async () => {
        // Well over the frame budget, so the second leaf finds it spent.
        const burn = () => {
            const end = performance.now() + 25
            while (performance.now() < end) { /* hold the thread */ }
        }
        let deliveredDuringRun = false
        let finished = false
        const { port1, port2 } = new MessageChannel()
        port1.onmessage = () => { deliveredDuringRun = !finished }
        port2.postMessage(undefined)
        // Its own runner, so the slice starts here: the first leaf runs inline
        // and the second finds the budget spent, which is the moment the thread
        // has to come back.
        const r = okValue(await browserRun({})(all(sandbox(burn), sandbox(burn), sandbox(burn))))
        finished = true
        port1.close()
        port2.close()
        assertEq(r.length, 3)
        assert(deliveredDuringRun)
    },
    // **Every operation is charged, not only the leaf.** A page whose proofs are
    // trivial and whose reporting paints a row spends its time in the operation
    // it added, so a budget that watched `sandbox` alone would let a hundred
    // cheap leaves start in one slice and then drain a hundred paints.
    //
    // Asserted by ordering rather than by observing a turn: a macrotask cannot
    // run until every pending microtask has, so racing the dispatch against a
    // long chain of microtasks says which kind of boundary it waited for, and
    // says it the same way however busy the process is. A proof that watched
    // for *a* turn instead would pass whenever anything else in the suite
    // happened to yield nearby — green with the defect present, which is worse
    // than no proof.
    everyOperationIsChargedToTheBudget: async () => {
        const run = browserRun(/** @type {any} */ ({ mark: async () => ok('marked') }))
        // Spend the slice before dispatching, so the budget is owed.
        const end = performance.now() + 25
        while (performance.now() < end) { /* hold the thread */ }
        const dispatched = run(/** @type {any} */ (do_('mark'))()).then(() => 'operation')
        const microtasks = (async () => {
            for (let i = 0; i < 200; i += 1) { await null }
            return 'microtasks'
        })()
        assertEq(await Promise.race([dispatched, microtasks]), 'microtasks')
        assertEq(okValue(await dispatched.then(() => run(/** @type {any} */ (do_('mark'))()))), 'marked')
    },
    // Enumerating `extra` runs user code too: a proxy may answer one set of
    // keys and then another. Reading it once means the map the runner builds is
    // the map the collision check approved — here the second reading's
    // `sandbox` is never seen at all, so the core handler stands rather than
    // being replaced behind the check's back.
    twoFacedExtraCannotReplaceACoreHandler: async () => {
        let reads = 0
        const extra = new Proxy({}, {
            ownKeys: () => {
                reads += 1
                return reads === 1 ? [] : ['sandbox']
            },
            getOwnPropertyDescriptor: () => ({
                value: async () => ok('replaced'),
                configurable: true,
                enumerable: true,
            }),
        })
        const r = okValue(await browserRun(/** @type {any} */ (extra))(sandbox(() => 42)))
        assertEq(reads, 1)
        assertEq(okValue(r.result), 42)
    },
    // `match` looks a handler up by own-property descriptor, so an `extra` that
    // declares one non-enumerable is still a valid operation map. Carrying the
    // handlers over by spread would have dropped it and turned a dispatch this
    // layer supports into a rejected promise.
    nonEnumerableHandlerIsDispatched: async () => {
        const extra = Object.defineProperty({}, 'quiet', {
            value: async () => ok('answered'),
            enumerable: false,
        })
        const r = await browserRun(/** @type {any} */ (extra))(
            /** @type {any} */ (do_('quiet'))())
        assertEq(okValue(r), 'answered')
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
