/**
 * @import { Effect, Operation } from './types.ts'
 */

import { step, do_, foldStep, forEachStep, mapStep, match, history, pure, runPure, historyStep } from './module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { assert, assertEq } from '../asserts/module.f.mjs'

/**
 * Asserts that `e` yields `expected` without performing a command. Exported so
 * other proofs can share this definition instead of repeating it.
 *
 * Not `assertEq(runPure(e), [expected])`: `assertEq` compares with `===`, so a
 * freshly allocated `[expected]` is never equal to the returned option. Assert
 * the option's shape first, then compare the value inside it.
 * @template {Operation} O
 * @template T
 * @param {Effect<O, T>} e
 * @param {T} expected
 */
export const assertPure = (e, expected) => {
    const o = runPure(e)
    assert(o.length === 1, e)
    assertEq(o[0], expected)
}

/** @typedef {readonly['add', (a: number, b: number) => number]} _AddOp */

/** @type {(command: 'add') => (a: number, b: number) => Effect<_AddOp, number>} */
const doAdd = do_

const next = match({ add: (a, b) => a + b })

/**
 * An operation set whose command is any `string`, which is what a `Do` node
 * decoded from external input effectively is: `command` is runtime data, so
 * nothing stops it naming a member `map` inherits from `Object.prototype`
 * rather than an own handler. `match` must refuse those, and this type is how a
 * proof says so without an `as` cast.
 * @typedef {readonly[string, (a: number) => number]} _AnyOp
 */

/** @type {(command: string) => (a: number) => Effect<_AnyOp, number>} */
const doAny = do_

const anyNext = match({ add: a => a + 1 })

export const proof = {
    foldStep: {
        empty: () => {
            const e = foldStep(pure([]), 10, x => s => pure(s + x))
            assertPure(e, 10)
        },
        threadsState: () => {
            const e = foldStep(pure([1, 2, 3, 4]), 0, x => s => pure(s + x))
            assertPure(e, 10)
        },
        order: () => {
            const e = foldStep(pure(['a', 'b', 'c']), '', x => s => pure(s + x))
            assertPure(e, 'abc')
        },
    },
    forEachStep: {
        empty: () => {
            const e = forEachStep(pure([]), () => pure(undefined))
            assertPure(e, undefined)
        },
        runs: () => {
            const e = forEachStep(pure([1, 2, 3]), () => pure(undefined))
            assertPure(e, undefined)
        },
    },
    runPure: {
        pure: () => {
            const o = runPure(pure(5))
            assert(o.length === 1, o)
            assertEq(o[0], 5)
        },
        // A pure `null` is `[null]`, never `[]`. Collapsing the two is what a
        // `T | null` result would do, and why the option is tagged.
        pureNull: () => {
            const o = runPure(pure(null))
            assertEq(o.length, 1, o)
            assertEq(o[0], null)
        },
        do_: () => {
            assertEq(runPure(doAdd('add')(2, 3)).length, 0)
        },
    },
    // The one place a `Do` node is opened on purpose: `do_` builds the command,
    // the payload it was called with, and a continuation that resumes with the
    // command's output. Everything else goes through `step`, `match`, or
    // `runPure`.
    doNode: () => {
        const e = doAdd('add')(2, 3)
        assert(typeof e !== 'function', e)
        const { command, payload, continuation } = e
        assertEq(command, 'add')
        const [a, b] = payload
        assertEq(a, 2, payload)
        assertEq(b, 3, payload)
        assertPure(continuation(5), 5)
    },
    match: {
        done: () => {
            const r = next(pure(7))
            assert(r[0] === 'done', r)
            assertEq(r[1], 7)
        },
        cont: () => {
            const r = next(doAdd('add')(2, 3))
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            const r2 = next(r[2](r[1]))
            assert(r2[0] === 'done', r2)
            assertEq(r2[1], 5)
        },
        ownCommand: () => {
            // The same map the two cases below dispatch against: an own
            // property still resolves, so what they prove is refusal of
            // inherited names, not a map that dispatches nothing.
            const r = anyNext(doAny('add')(41))
            assert(r[0] === 'cont', r)
            assertEq(r[1], 42)
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
    step: {
        pure: () => {
            assertPure(step(pure(3), v => pure(v + 1)), 4)
        },
        chain: () => {
            // Chains as step(step(e, f), g), raw effect in and out.
            assertPure(step(step(pure(3), v => pure(v + 1)), v => pure(v * 2)), 8)
        },
        overDo: () => {
            // Stepping a Do node preserves the command and threads the result
            // through the rebuilt continuation.
            const e = step(doAdd('add')(2, 3), r => pure(r * 10))
            const r = next(e)
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            assertPure(r[2](r[1]), 50)
        },
    },
    mapStep: {
        pure: () => {
            assertPure(mapStep(pure(3), v => v + 1), 4)
        },
        constant: () => {
            // The `() => v` shape a `constStep` would have covered.
            assertPure(mapStep(pure('ignored'), () => 1), 1)
        },
        overDo: () => {
            // A projection over a `Do` node keeps the command intact and is
            // applied to the command's output when the continuation resumes.
            const r = next(mapStep(doAdd('add')(2, 3), v => v * 10))
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            assertPure(r[2](r[1]), 50)
        },
    },
    historyStep: {
        pure: () => {
            const o = runPure(historyStep(history(pure(3)), v => pure(v * 2)))
            assert(o.length === 1, o)
            const [[result, param]] = o
            assertEq(param, 3)
            assertEq(result, 6)
        },
        overDo: () => {
            // The captured value survives a command boundary: the history is
            // rebuilt inside the continuation rather than lost when `e` is a Do.
            const c = next(historyStep(history(doAdd('add')(2, 3)), r => pure(r * 10)))
            assert(c[0] === 'cont', c)
            assertEq(c[1], 5)
            const o = runPure(c[2](c[1]))
            assert(o.length === 1, o)
            const [[result, param]] = o
            assertEq(param, 5)
            assertEq(result, 50)
        },
        chain: () => {
            // `historyStep` takes a history and returns one, so link two is
            // spelled exactly like link one. The tuple is newest first, so a
            // destructuring reads reverse-chronologically.
            const a = historyStep(history(pure(1)), x => pure(x + 1))
            const b = historyStep(a, (result, param) => pure(result + param))
            assertPure(
                step(b, ([z, y, x]) => pure(`${x}${y}${z}`)),
                '123')
        },
        fReceivesWholeHistory: () => {
            // `f` is handed the whole history spread as arguments, not just the
            // most recent value - which is what lets a later link reach back.
            const a = historyStep(history(pure(1)), x => pure(x + 1))
            const b = historyStep(a, (...p) => pure(p[1] * 100 + p[0]))
            assertPure(step(b, ([result]) => pure(result)), 102)
        },
    },
}
