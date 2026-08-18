/**
 * @import { Effect, Operation } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { do_, match, partialMatch, pure, runPure } from './module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { assert, assertEq } from '../asserts/module.f.mjs'

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

export const proof = {
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
}
