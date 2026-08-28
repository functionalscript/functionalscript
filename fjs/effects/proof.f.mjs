/**
 * @import { Effect, Func, IoChannel, Operation } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import {
    catchStep, do_, foldStep, forEachStep, history, historyStep, mapStep,
    match, partialMatch, pure, pureError, pureOk, resultMapStep, resultStep,
    runPure, step, toIoError, unwrapStep,
} from './module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { assert, assertEq, todo } from '../asserts/module.f.mjs'

/**
 * Asserts that `e` reaches `expected` without performing a command.
 *
 * Not `assertEq(runPure(e), [expected])`: `assertEq` compares with `===`, so a
 * freshly allocated option or `Result` is never equal to the returned one.
 * Assert the option's shape first, then compare the value inside it.
 *
 * @template {Operation} O
 * @template T
 * @template E
 * @param {Effect<O, T, E>} e
 * @param {Result<T, E>} expected
 */
const assertPure = (e, expected) => {
    const o = runPure(e)
    assert(o.length === 1, e)
    assertEq(o[0][0], expected[0])
    assertEq(o[0][1], expected[1])
}

/**
 * `Operation` requires a `Result` return, so a runner always has somewhere to
 * answer `error(notImplemented)` — and that requirement is what lets an effect
 * carry its error channel in the type rather than inside an opaque payload.
 * @typedef {readonly['add', (a: number, b: number) => Result<number, string>]} _AddOp
 */

/** @type {(command: 'add') => (a: number, b: number) => Effect<_AddOp, number, string>} */
const doAdd = do_

const next = match({
    add: (/** @type {number} */ a, /** @type {number} */ b) => ok(a + b),
})

/**
 * An operation set whose command is any `string`, which is what a `Do` node
 * decoded from external input effectively is: `command` is runtime data, so
 * nothing stops it naming a member `map` inherits from `Object.prototype`
 * rather than an own handler. `match` must refuse those, and this type is how a
 * proof says so without an `as` cast.
 * @typedef {readonly[string, (a: number) => Result<number, string>]} _AnyOp
 */

/** @type {(command: string) => (a: number) => Effect<_AnyOp, number, string>} */
const doAny = do_

const anyNext = match({ add: (/** @type {number} */ a) => ok(a + 1) })

/**
 * The same map, reached through the runner that may decline a command. The
 * handler's return is annotated so it and `onMissing` agree on one `R` — a
 * runner's answer type is shared by both, which is the whole reason
 * `partialMatch` takes the injector from its caller.
 */
const anyPartial = partialMatch(
    /** @type {readonly string[]} */ (['add', 'sub']),
    (/** @type {string} */ command) =>
        /** @type {Result<number, string>} */ (error(`declined: ${command}`)),
)({
    add: (/** @type {number} */ a) => /** @type {Result<number, string>} */ (ok(a + 1)),
})

// ── Composition ──────────────────────────────────────────────────────────────
/**
 * A fallible operation, spelled the way every operation is spelled: the
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

const nextArith = match({
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
        const r = nextArith(current)
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

/**
 * Asserts that a channel error is a host failure carrying `message`. Every
 * runner reports through the same normalized `IoError`, so a proof names the
 * message rather than the shape.
 *
 * @type {(e: IoChannel, message: string) => void}
 */
const assertIoMessage = (e, message) => {
    assert(e[0] === 'ioError', e)
    assertEq(e[1].message, message)
}

export const proof = {
    // The one boundary where a runner's `catch` becomes effect data: whatever
    // was thrown is reduced to a code (when the host attached a string one)
    // and a message.
    toIoError: {
        error: () => {
            assertIoMessage(toIoError(new Error('boom')), 'boom')
        },
        withCode: () => {
            const e = toIoError(Object.assign(new Error('missing'), { code: 'ENOENT' }))
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, 'ENOENT', e)
            assertEq(e[1].message, 'missing', e)
        },
        // A thrown non-`Error` still normalizes: the value's string form is the
        // message, and there is no code to carry.
        string: () => {
            const e = toIoError('plain')
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
            assertEq(e[1].message, 'plain', e)
        },
        null: () => {
            assertIoMessage(toIoError(null), 'null')
        },
        // An object whose `code` is not a string is not an OS error code, so it
        // is dropped rather than carried as one.
        nonStringCode: () => {
            const e = toIoError({ code: 42 })
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
        },
        noCode: () => {
            const e = toIoError({})
            assert(e[0] === 'ioError', e)
            assertEq(e[1].code, undefined, e)
        },
    },
    runPure: {
        ok: () => {
            assertPure(pure(ok(5)), ok(5))
        },
        error: () => {
            assertPure(pure(error('boom')), error('boom'))
        },
        // A pure `null` is `[ok(null)]`, never `[]`. Collapsing the two is what
        // a bare `T | null` result would do, and why the option is tagged
        // separately from the `Result` inside it.
        pureNull: () => {
            assertPure(pure(ok(null)), ok(null))
        },
        do_: () => {
            assertEq(runPure(doAdd('add')(2, 3)).length, 0)
        },
    },
    // The one place a `Do` node is opened on purpose: `do_` builds the command,
    // the payload it was called with, and a continuation that resumes with the
    // command's output. Everything else goes through `match`, `partialMatch`,
    // or `runPure`.
    doNode: () => {
        const e = doAdd('add')(2, 3)
        assert(typeof e !== 'function', e)
        const { command, payload, continuation } = e
        assertEq(command, 'add')
        const [a, b] = payload
        assertEq(a, 2, payload)
        assertEq(b, 3, payload)
        // The command's output is the whole `Result` — `Operation` requires one
        // so a runner always has somewhere to answer a refusal — so this
        // resumes with `ok(5)` rather than a bare `5`.
        assertPure(continuation(ok(5)), ok(5))
    },
    // A runner hands a failed command back through the *ordinary* continuation,
    // which is what makes `error(notImplemented)` something a program can
    // recover from. Pinned here because it is the property the whole error
    // channel rests on: had the representation short-circuited, there would be
    // nothing for `catchStep` to catch.
    failedCommandResumes: () => {
        const e = doAdd('add')(2, 3)
        assert(typeof e !== 'function', e)
        assertPure(e.continuation(error('declined')), error('declined'))
    },
    match: {
        done: () => {
            const r = next(pure(ok(7)))
            assert(r[0] === 'done', r)
            assertEq(r[1][1], 7)
        },
        cont: () => {
            const r = next(doAdd('add')(2, 3))
            assert(r[0] === 'cont', r)
            assertEq(r[1][1], 5)
            const r2 = next(r[2](r[1]))
            assert(r2[0] === 'done', r2)
            assertEq(r2[1][1], 5)
        },
        ownCommand: () => {
            // The same map the two cases below dispatch against: an own
            // property still resolves, so what they prove is refusal of
            // inherited names, not a map that dispatches nothing.
            const r = anyNext(doAny('add')(41))
            assert(r[0] === 'cont', r)
            assertEq(r[1][1], 42)
        },
        // A `command` naming an `Object.prototype` member must not dispatch to
        // the inherited value. `map['constructor']` is `Object` and
        // `map['toString']` is `Function.prototype.toString` — both callable,
        // neither a handler — so a plain index read would call one of them with
        // the node's payload instead of throwing.
        throw: {
            constructorCommand: () => {
                anyNext(doAny('constructor')(1))
            },
            toStringCommand: () => {
                anyNext(doAny('toString')(1))
            },
        },
    },
    partialMatch: {
        // A command the runner does implement dispatches as usual.
        implemented: () => {
            const r = anyPartial(doAny('add')(41))
            assert(r[0] === 'cont', r)
            assertEq(r[1][1], 42)
        },
        // A command in the set with no handler is an *outcome*: the answer
        // travels back through the ordinary continuation, and the program
        // decides what a runner without that capability means for it.
        declined: () => {
            const r = anyPartial(doAny('sub')(1))
            assert(r[0] === 'cont', r)
            assert(r[1][0] === 'error' && r[1][1] === 'declined: sub', r)
            assertPure(r[2](r[1]), error('declined: sub'))
        },
        // A command outside the set is a malformed node, not a capability the
        // runner lacks, and still panics.
        throw: {
            unknownCommand: () => {
                anyPartial(doAny('nope')(1))
            },
        },
    },
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
        // Recovery after a performed command, which is the shape a runner's
        // `NotImplemented` takes: the program regains control and chooses what
        // the failure means for it.
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
        // Where a `Result`-blind `forEachStep` would run every item regardless,
        // this one stops — the difference a `void` accumulator hides.
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
    resultMapStep: {
        // Both branches reach `f`, which is the difference from `mapStep`: the
        // error is handed over rather than passed around.
        ok: () => {
            assertOk(pureResult(resultMapStep(pureOk(3), r => ok(r[0]))), 'ok')
        },
        error: () => {
            assertOk(pureResult(resultMapStep(pureError('boom'), r => ok(r[0]))), 'error')
        },
        // `f` chooses the outgoing channel, so a failure can be turned into a
        // success — the discard `mapStep` cannot express, written as a function
        // that says it took both branches.
        absorbs: () => {
            assertOk(pureResult(resultMapStep(pureError('boom'), () => ok(0))), 0)
        },
        // ...and the reverse: a success can be rejected.
        rejects: () => {
            assertError(pureResult(resultMapStep(pureOk(3), () => error('no'))), 'no')
        },
        // Over a `Do` node the command survives and `f` runs on the operation's
        // whole answer, including when that answer is the operation's failure.
        overDo: () => {
            assertOk(run(resultMapStep(div(6, 3), r => ok(r[1]))), 2)
        },
        overFailedDo: () => {
            assertOk(run(resultMapStep(div(1, 0), r => ok(r[0]))), 'error')
        },
    },
}
