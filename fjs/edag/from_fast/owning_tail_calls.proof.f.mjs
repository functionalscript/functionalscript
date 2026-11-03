/** Owning self tails are normalized before loops acquire generated helpers.
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'

/** Equal display indices retain distinct resolved identities. @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {() => FunctionTarget} */
const owner = () => ({ kind: 'function', index: 0 })
/** @type {() => LoopTarget} */
const target = () => ({ kind: 'loop', index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(fn: FastFunction, args?: readonly Value[]) => ValueResult} */
const called = (fn, args = []) => memo(assertOk(identityAnalysis(fromFast(block(['yield', [['()', ['function', fn], args]]])))))({ args: [] })
/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const evaluated = (fn, args = []) => assertOk(toData(assertOk(called(fn, args))))
/** @type {(fn: FastFunction) => Exp} */
const functionGraph = fn => fromFast(block(['yield', [['function', fn]]]))

/** The normal loop can complete; the terminal loop returns from its owner.
 * @type {(terminal: boolean, spread?: boolean) => FastFunction}
 */
const swapped = (terminal, spread = false) => {
    const fn = owner(), loop = target(), self = id(), n = id(), left = id(), right = id()
    /** @type {Value} */
    const call = ['()', ref(self), spread
        ? [['...', ['array', [['-', ref(n), 1], ref(right), ref(left)]]], 5]
        : [['-', ref(n), 1], ref(right), ref(left)]]
    /** @type {Loop} */
    const inner = { target: loop, parameters: [], initial: [], results: [], body: terminal
        ? block(['return', fn, call], [['if', [], ['===', ref(n), 0], block(['return', fn, ['array', [ref(left), ref(right)]]]), block(['yield', []])]])
        : block(['break', loop, []], [['if', [], ['>', ref(n), 0], block(['return', fn, call]), block(['yield', []])]]),
    }
    return { target: fn, parameters: [n, left, right], rest: null, self, captures: [], body: terminal
        ? block(['loop', inner])
        : block(['return', fn, ['array', [ref(left), ref(right)]]], [['loop', inner]]),
    }
}

/** One fixed input and a live rest binding cross the completion packet.
 * @type {() => FastFunction}
 */
const restFunction = () => {
    const fn = owner(), loop = target(), self = id(), n = id(), rest = id()
    return { target: fn, parameters: [n], rest, self, captures: [], body: block(['loop', {
        target: loop, parameters: [], initial: [], results: [], body: block(['return', fn, ['()', ref(self), [
            ['-', ref(n), 1], ['...', ref(rest)],
        ]]], [['if', [], ['===', ref(n), 0], block(['return', fn, ['array', [ref(rest), ref(rest)]]]), block(['yield', []])]]),
    }]) }
}

/** A terminal loop's argument block can finish the owner before the call.
 * @type {(extraFailure: boolean) => FastFunction}
 */
const argumentReturn = extraFailure => {
    const fn = owner(), loop = target(), self = id(), n = id()
    /** @type {Value} */
    const argument = ['if', ['===', ref(n), 0], block(['return', fn, 7]), block(['yield', [['-', ref(n), 1]]])]
    /** @type {readonly Value[]} */
    const args = extraFailure ? [argument, ['+', 1n, 1]] : [argument]
    return { target: fn, parameters: [n], rest: null, self, captures: [], body: block(['loop', {
        target: loop, parameters: [], initial: [], results: [], body: block(['return', fn, ['()', ref(self), args]]),
    }]) }
}

/** No branch produces a public result, so inspection must not run the graph.
 * @type {(restOnly: boolean) => FastFunction}
 */
const alwaysTail = restOnly => {
    const fn = owner(), loop = target(), self = id(), input = id()
    return { target: fn, parameters: restOnly ? [] : [input], rest: restOnly ? input : null, self, captures: [], body: block(['loop', {
        target: loop, parameters: [], initial: [], results: [], body: block(['return', fn, ['()', ref(self), restOnly
            ? [['...', ref(input)]] : [['-', ref(input), 1]]]]),
    }]) }
}

export const proof = /** @type {const} */ ({
    fixedReturnsCrossNormalAndTerminalLoopHelpers: () => {
        for (const terminal of [false, true]) {
            for (const spread of [false, true]) {
                const fn = swapped(terminal, spread)
                assertStructurallySame(evaluated(fn, [0, 4, 9]), [4, 9])
                assertStructurallySame(evaluated(fn, [3, 4, 9]), [9, 4])
            }
        }
    },
    transportedRestKeepsItsPublicValuesAndRepeatedReadIdentity: () => {
        const fn = restFunction()
        const first = evaluated(fn, [3, ['array', [9]], 7])
        const second = evaluated(fn, [3, ['array', [9]], 7])
        assertStructurallySame(first, [[[9], 7], [[9], 7]])
        assert(first instanceof Array && second instanceof Array)
        assertEq(first[0], first[1])
        assert(first[0] !== second[0])
        assertStructurallySame(evaluated(fn, [2]), [[], []])
    },
    owningArgumentReturnSkipsTheSelfCallAndRemainingArguments: () => {
        assertEq(evaluated(argumentReturn(false), [3]), 7)
        assertEq(evaluated(argumentReturn(true), [0]), 7)
        assertError(called(argumentReturn(true), [1]))
    },
    alwaysTailFixedAndRestRootsHaveNoInventedCompletion: () => {
        for (const restOnly of [false, true]) {
            const table = assertOk(identityAnalysis(functionGraph(alwaysTail(restOnly))))
            assert(table.nodes.some(node => node[0] === 'self'))
            assertEq(table.nodes.filter(node => node[0] === 'throw').length, 0)
        }
    },
})
