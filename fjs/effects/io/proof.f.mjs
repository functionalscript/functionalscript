/**
 * @import { Result } from '../../types/result/types.ts'
 * @import { Effect, Func, Operation } from '../types.ts'
 */

import { assert, assertEq, todo } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { do_, match, pure, runPure } from '../module.f.mjs'
import {
    catchStep, foldStep, forEachStep, history, historyStep, mapStep, pureError, pureOk,
    resultMapStep, resultStep, step, unwrapStep,
} from './module.f.mjs'

/**
 * A fallible operation, spelled the way stage 3 will spell every operation: the
 * `Result` is in the command's declared return type, so `do_` already builds an
 * `Effect` and the runner's handler already answers with `ok` / `error`.
 * @typedef {readonly['div', (a: number, b: number) => Result<number, string>]} _DivOp
 */

/**
 * A second operation, so a chain can join two of them and the operation sets
 * union.
 * @typedef {readonly['neg', (a: number) => Result<number, string>]} _NegOp
 */

/** @typedef {_DivOp | _NegOp} _Op */

/** @type {Func<_DivOp>} */
const div = do_('div')

/** @type {Func<_NegOp>} */
const neg = do_('neg')

const next = match({
    div: (/** @type {number} */ a, /** @type {number} */ b) =>
        b === 0 ? error('div by zero') : ok(a / b),
    neg: (/** @type {number} */ a) => ok(-a),
})

/**
 * Runs an effect to completion against the two operations above — `asyncRun`'s
 * loop without the `await`, which is all a synchronous runner is.
 * @type {<T, E>(e: Effect<_Op, T, E>) => Result<T, E>}
 */
const run = e => {
    let current = e
    while (true) {
        const r = next(current)
        if (r[0] === 'done') { return r[1] }
        current = r[2](r[1])
    }
}

/**
 * The `Result` an effect reaches without performing a command.
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>) => Result<T, E>}
 */
const pureResult = e => {
    const o = runPure(e)
    assert(o.length === 1, e)
    return o[0]
}

/**
 * The `ok` value an effect reaches without performing a command.
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>) => T}
 */
const unwrapPure = e => {
    const r = pureResult(e)
    assert(r[0] === 'ok', r)
    return r[1]
}

/** @type {<T, E>(r: Result<T, E>, expected: T) => void} */
const assertOk = (r, expected) => {
    assert(r[0] === 'ok', r)
    assertEq(r[1], expected)
}

/** @type {<T, E>(r: Result<T, E>, expected: E) => void} */
const assertError = (r, expected) => {
    assert(r[0] === 'error', r)
    assertEq(r[1], expected)
}

/** @type {(v: number) => Effect<never, number, string>} */
const positive = v => v > 0 ? pureOk(v) : pureError('not positive')

/** @type {(v: number) => Effect<never, number, number>} */
const small = v => v < 10 ? pureOk(v) : pureError(v)

/**
 * Two adjacent links failing in different ways. The annotation is the claim:
 * the chain's error channel is the **union** of theirs, so neither link had to
 * be pre-widened to the other's error type.
 * @type {(v: number) => Effect<never, number, string | number>}
 */
const checked = v => {
    const x0 = step(pureOk(v), positive)
    return step(x0, small)
}

/**
 * The anything-accepting renderer {@link unwrapStep}'s doc calls an escape
 * hatch. It is the honest choice *here* — these proofs are about `unwrapStep`
 * itself, not about any particular channel — and the wrong one almost anywhere
 * else, since accepting every error is what stops a widened channel from being
 * a compile error.
 *
 * @type {(e: unknown) => string}
 */
const show = e => `${e}`

export const proof = {
    pureOk: () => {
        assertOk(pureResult(pureOk(5)), 5)
    },
    pureError: () => {
        assertError(pureResult(pureError('nope')), 'nope')
    },
    step: {
        ok: () => {
            const e = step(pureOk(5), v => pureOk(v * 2))
            assertOk(pureResult(e), 10)
        },
        // The continuation does not run on an `error`: `todo` throws if it
        // does, so propagation is what keeps this proof passing.
        propagates: () => {
            const e = step(pureError('boom'), todo)
            assertError(pureResult(e), 'boom')
        },
        // ...and the error that comes out is the very tuple that went in,
        // rather than an equal one rebuilt to retag it.
        errorTupleIsUnchanged: () => {
            const e = pureError('boom')
            assertEq(pureResult(step(e, todo)), pureResult(e))
        },
        chain: () => {
            // Flat, one name per link — the chain of `step`s reads in
            // evaluation order.
            const x0 = step(pureOk(3), v => pureOk(v + 1))
            const x1 = step(x0, v => pureOk(v * 2))
            assertOk(pureResult(x1), 8)
        },
        // A `Do` node keeps its command, and the continuation resumes with the
        // operation's `ok` value rather than with the `Result` around it.
        overDo: () => {
            const e = step(div(6, 3), v => pureOk(v * 10))
            assertOk(run(e), 20)
        },
        // The same chain when the operation itself fails: the command was
        // performed, its error propagates, and the continuation never runs.
        overFailedDo: () => {
            // `todo` never returns, so it pins none of the continuation's type
            // parameters; the annotation supplies the operation set `run` needs.
            /** @type {Effect<_DivOp, never, string>} */
            const e = step(div(1, 0), todo)
            assertError(run(e), 'div by zero')
        },
        // Adjacent links performing different commands: the operation sets
        // union, so one runner interprets the whole chain.
        joinsOperations: () => {
            /** @type {Effect<_Op, number, string>} */
            const e = step(div(6, 3), neg)
            assertOk(run(e), -2)
        },
        mixedErrorsOk: () => {
            assertOk(pureResult(checked(5)), 5)
        },
        // The first link's error type...
        mixedErrorsFirst: () => {
            assertError(pureResult(checked(-1)), 'not positive')
        },
        // ...and the second's, in the same chain and the same channel.
        mixedErrorsSecond: () => {
            assertError(pureResult(checked(50)), 50)
        },
    },
    catchStep: {
        recovers: () => {
            const e = catchStep(pureError('boom'), m => pureOk(m.length))
            assertOk(pureResult(e), 4)
        },
        // The success passes through untouched — `todo` proves the recovery
        // does not run — and it is the same tuple, as in `step`'s mirror case.
        preservesOk: () => {
            const e = pureOk(5)
            assertEq(pureResult(catchStep(e, todo)), pureResult(e))
        },
        // Recovery after a performed command, which is the `NotImplemented`
        // fallback shape stage 6 relies on: the program regains control and
        // chooses what the failure means for it.
        overFailedDo: () => {
            const e = catchStep(div(1, 0), () => pureOk(0))
            assertOk(run(e), 0)
        },
        // The success channel unions `T | R`: a recovery may yield a different
        // type than the value it stands in for, and the error channel becomes
        // `f`'s alone — `never` here, since every error is handled.
        unionsSuccess: () => {
            /** @type {Effect<never, number | string, never>} */
            const e = catchStep(pureError('boom'), m => pureOk(m))
            assertOk(pureResult(e), 'boom')
        },
    },
    resultStep: {
        // Both branches reach `f`, which decides the outcome — including
        // turning an `error` into an `ok`.
        ok: () => {
            const e = resultStep(pureOk(5), ([tag]) => pureOk(tag))
            assertOk(pureResult(e), 'ok')
        },
        error: () => {
            const e = resultStep(pureError('boom'), ([tag]) => pureOk(tag))
            assertOk(pureResult(e), 'error')
        },
        overDo: () => {
            const e = resultStep(div(1, 0), ([tag]) => pureOk(tag))
            assertOk(run(e), 'error')
        },
    },
    historyStep: {
        // The chain stays flat: the last link reads a value bound two links
        // back out of the tuple rather than out of an enclosing closure.
        chain: () => {
            const h0 = history(pureOk(1))
            const h1 = historyStep(h0, x => pureOk(x + 1))
            const h2 = historyStep(h1, (y, x) => pureOk(`${x}${y}`))
            assertOk(pureResult(mapStep(h2, ([z]) => z)), '12')
        },
        // The history carries `ok` values, so a later link reads them without
        // asking whether they are there...
        carriesValues: () => {
            const h0 = historyStep(history(pureOk(3)), x => pureOk(x * 2))
            const [result, param] = unwrapPure(h0)
            assertEq(param, 3)
            assertEq(result, 6)
        },
        // ...because a failed link short-circuits instead of contributing one.
        propagates: () => {
            const h0 = historyStep(history(pureOk(3)), () => pureError('boom'))
            assertError(pureResult(historyStep(h0, todo)), 'boom')
        },
        // A failure in the effect the history starts from never reaches `f`.
        propagatesFromHead: () => {
            assertError(pureResult(historyStep(history(pureError('boom')), todo)), 'boom')
        },
        // Over a `Do` node: the captured value survives the command boundary.
        overDo: () => {
            const h0 = historyStep(history(div(6, 3)), r => pureOk(r * 10))
            const [result, param] = run(h0)[1]
            assertEq(param, 2)
            assertEq(result, 20)
        },
    },
    foldStep: {
        empty: () => {
            assertOk(pureResult(foldStep(pureOk([]), 10, x => s => pureOk(s + x))), 10)
        },
        threadsState: () => {
            assertOk(pureResult(foldStep(pureOk([1, 2, 3, 4]), 0, x => s => pureOk(s + x))), 10)
        },
        // The first failure stops the fold: `4` never reaches the accumulator,
        // and the error is the result.
        shortCircuits: () => {
            const e = foldStep(pureOk([1, 2, 4]),
                0,
                x => s => x === 2 ? pureError('two') : pureOk(s + x))
            assertError(pureResult(e), 'two')
        },
    },
    forEachStep: {
        empty: () => {
            assertOk(pureResult(forEachStep(pureOk([]), todo)), undefined)
        },
        runs: () => {
            assertOk(pureResult(forEachStep(pureOk([1, 2, 3]), () => pureOk(undefined))), undefined)
        },
        // Where the raw `forEachStep` would run every item regardless, this one
        // stops — the difference the `void` accumulator hides in the raw form.
        stopsAtTheFirstError: () => {
            const e = forEachStep(pureOk([1, 2, 3]),
                x => x === 2 ? pureError('two') : pureOk(undefined))
            assertError(pureResult(e), 'two')
        },
    },
    unwrapStep: {
        // An `ok` passes through untouched — what the panic empties is the
        // error channel, so the value is still carried in an `ok`.
        ok: () => {
            assertOk(pureResult(unwrapStep(pureOk(5), show)), 5)
        },
        // An `error` is a panic — the policy the name exists to make greppable.
        // It throws where the composition is written, since `mapStep` forces a
        // `Pure` head immediately.
        throw: {
            error: () => {
                unwrapStep(pureError('boom'), show)
            },
        },
    },
    mapStep: {
        ok: () => {
            assertOk(pureResult(mapStep(pureOk(3), v => v + 1)), 4)
        },
        // An `error` is passed through unchanged — the same tuple, and `f` is
        // never applied to it.
        error: () => {
            const e = pureError('boom')
            assertEq(pureResult(mapStep(e, todo)), pureResult(e))
        },
        // A projection over a `Do` node keeps the command intact and applies
        // `f` to the operation's `ok` value when the continuation resumes.
        overDo: () => {
            assertOk(run(mapStep(div(6, 3), v => v * 10)), 20)
        },
    },
}
