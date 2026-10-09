/**
 * @import { Commands, Func } from '../types.ts'
 * @import { MemOperationMap } from './types.ts'
 * @import { _Add, _Sub } from './private.ts'
 */

import { do_, pureOk, step } from '../module.f.mjs'
import { partialRun, run } from './module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { assertEq, assertError, assertOk } from '../../asserts/module.f.mjs'

/** @type {Func<_Add>} */
const add = do_('add')

/** @type {Func<_Sub>} */
const sub = do_('sub')

/** @type {MemOperationMap<_Add, number>} */
const adder = { add: n => s => [s + n, ok(s)] }

/** `add(2)`, then `add(3)`: the second sees the state the first left. */
const twice = step(add(2), a => step(add(3), b => pureOk([a, b])))

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
    partialRun: {
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
