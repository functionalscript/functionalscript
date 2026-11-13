/**
 * @import { Commands, Effect, Func, NotImplemented } from '../types.ts'
 * @import { MemOperationMap, RunInstance } from './types.ts'
 * @import { _Add, _Sub } from './private.ts'
 * @import { All } from '../common/types.ts'
 */

import { do_, pureOk, step } from '../module.f.js'
import { partialRun, run, runAll } from './module.f.js'
import { all } from '../common/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'

/** @type {Func<_Add>} */
const add = do_('add')

/** @type {Func<_Sub>} */
const sub = do_('sub')

/** @type {MemOperationMap<_Add, number>} */
const adder = { add: n => s => [s + n, ok(s)] }

/** `add(2)`, then `add(3)`: the second sees the state the first left. */
const twice = step(add(2), a => step(add(3), b => pureOk([a, b])))

/** `add` over a runner that answers `all` over itself. @type {RunInstance<_Add | All, number>} */
const adderAll = runAll(adder)

/** `all` over two `add`s: each sees the state the one before it left. */
const both = all(add(2), add(3))

/** A runner that handles `add` and declares `sub` without a handler. */
const partial = partialRun(/** @type {Commands<_Add | _Sub>} */ (['add', 'sub']))(adder)

export const proof = {
    run: {
        /** A pure effect returns the state it was given, untouched. */
        pure: () => {
            const [s, r] = run({})(7)(pureOk('x'))
            assertEq(s, 7)
            assertEq(assertOk(r), 'x')
        },
        /** Each command's transition feeds the next: the state is threaded. */
        threadsState: () => {
            const [s, r] = run(adder)(10)(twice)
            assertEq(s, 15)
            const [a, b] = assertOk(r)
            assertEq(a, 10)
            assertEq(b, 12)
        },
    },
    runAll: {
        /**
         * `all` runs its effects in turn through the runner itself, threading
         * the state, and answers each one's whole `Result` in order.
         */
        threadsState: () => {
            const [s, r] = adderAll(10)(both)
            assertEq(s, 15)
            const [a, b] = assertOk(r)
            assertEq(assertOk(a), 10)
            assertEq(assertOk(b), 12)
        },
        /** A nested `all` uses the same runner and passes its state onward. */
        nested: () => {
            const [s, r] = adderAll(10)(all(both, both))
            assertEq(s, 20)
            const [a, b] = assertOk(r)
            assertEq(assertOk(assertOk(a)[0]), 10)
            assertEq(assertOk(assertOk(a)[1]), 12)
            assertEq(assertOk(assertOk(b)[0]), 15)
            assertEq(assertOk(assertOk(b)[1]), 17)
        },
    },
    partialRun: {
        /** `all` among the commands is answered over the runner itself. */
        all: () => {
            const [s, r] = partialRun(/** @type {Commands<_Add | All>} */ (['add', 'all']))(adder)(10)(both)
            assertEq(s, 15)
            assertEq(assertOk(assertOk(r)[1]), 12)
        },
        /** Nested `all` preserves each result, including a missing handler. */
        nestedAll: () => {
            /** @type {readonly Effect<_Add | _Sub, number, NotImplemented>[]} */
            const group = [add(2), sub(3)]
            const [s, r] = partialRun(/** @type {Commands<_Add | _Sub | All>} */ (['add', 'sub', 'all']))(adder)(10)(
                all(all(...group), all(...group)))
            assertEq(s, 14)
            const [a, b] = assertOk(r)
            assertEq(assertOk(assertOk(a)[0]), 10)
            assertEq(assertError(assertOk(a)[1])[0], 'notImplemented')
            assertEq(assertError(assertOk(a)[1])[1], 'sub')
            assertEq(assertOk(assertOk(b)[0]), 12)
            assertEq(assertError(assertOk(b)[1])[0], 'notImplemented')
            assertEq(assertError(assertOk(b)[1])[1], 'sub')
        },
        /** A handled command runs as `run` would run it. */
        handled: () => {
            const [s, r] = partial(10)(twice)
            assertEq(s, 15)
            const [a, b] = assertOk(r)
            assertEq(a, 10)
            assertEq(b, 12)
        },
        /**
         * A declared command with no handler answers `notImplemented` through
         * its own continuation, and leaves the state as it was.
         */
        missing: () => {
            const [s, r] = partial(10)(sub(1))
            assertEq(s, 10)
            const [tag, command] = assertError(r)
            assertEq(tag, 'notImplemented')
            assertEq(command, 'sub')
        },
        /** A command outside `commands` is a runner bug, not a refusal. */
        throw: {
            undeclared: () => {
                partialRun(/** @type {Commands<_Add | _Sub>} */ (['add']))({})(0)(sub(1))
            },
        },
    },
}
