/** Normal joins retain only their actual predecessors and one continuation.
 * @import { BindingId, Block, Function as FastFunction, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'

const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
/** @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {(id: BindingId) => Value} */
const ref = id => ['ref', id]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value) => Exp} */
const graph = value => fromFast(block(['yield', [value]]))
/** @type {(fn: FastFunction, args: readonly Value[]) => ValueResult} */
const called = (fn, args) => memo(assertOk(identityAnalysis(graph(['()', ['function', fn], args]))))({ args: [] })
/** @type {(fn: FastFunction, args: readonly Value[]) => unknown} */
const evaluated = (fn, args) => assertOk(toData(assertOk(called(fn, args))))

/**
 * The middle arm returns; only the other two arms supply a sum to the final
 * array or call. The final value has one identity shared by those normal arms.
 * @type {(call: boolean) => FastFunction}
 */
const joined = call => {
    const count = id(), sum = id(), operation = id(), next = id(), a = id(), b = id(), inner = id(), outer = id()
    return {
        target: owner, parameters: [count, sum, ...call ? [operation] : []], rest: null, self: null, captures: [],
        body: block(['return', owner, call ? ['()', ref(operation), [['array', [ref(next), ref(outer)]]]] : ['array', [ref(next), ref(outer)]]], [
            ['define', next, ['+', ref(count), 1], 'required'],
            ['if', [outer], ['===', ref(next), 1],
                block(['yield', [ref(a)]], [['define', a, ['+', ref(sum), 10], 'required']]),
                block(['yield', [ref(inner)]], [
                    ['if', [inner], ['===', ref(next), 3], block(['return', owner, 42]),
                        block(['yield', [ref(b)]], [['define', b, ['+', ref(sum), ref(next)], 'required']])],
                ])],
        ]),
    }
}

export const proof = /** @type {const} */ ({
    aReturningSubjoinSuppliesNoOuterResult: () => {
        const first = id(), second = id(), inner = id(), outer = id()
        /** @type {FastFunction} */
        const fn = { target: owner, parameters: [first, second], rest: null, self: null, captures: [],
            body: block(['return', owner, ['+', ref(outer), 10]], [
                ['if', [outer], ref(first), block(['return', owner, ['+', ref(inner), 3]], [
                    ['if', [inner], ref(second), block(['yield', [1]]), block(['return', owner, 2])],
                ]), block(['yield', [5]])],
            ]),
        }
        assertEq(evaluated(fn, [true, true]), 4)
        assertEq(evaluated(fn, [true, false]), 2)
        assertEq(evaluated(fn, [false, true]), 15)
        assertEq(evaluated(fn, [false, false]), 15)
    },
    normalPredecessorsHaveNoTerminalPlaceholder: () => {
        const fn = joined(false)
        /** @type {Exp} */
        const count = ['arg', 0]
        /** @type {Exp} */
        const sum = ['arg', 1]
        /** @type {Exp} */
        const next = ['+', count, 1]
        /** @type {Exp} */
        const first = ['===', next, 1]
        /** @type {Exp} */
        const selected = ['?:', first, ['+', sum, 10], ['+', sum, next]]
        /** @type {Exp} */
        const following = ['[]', [next, selected]]
        /** @type {Exp} */
        const expected = ['=>', 2, [], ['?:', first, following, ['?:', ['===', next, 3], 42, following]]]
        const a = assertOk(identityAnalysis(graph(['function', fn])))
        assertStructurallySame(a, assertOk(identityAnalysis(expected)))
        assertEq(a.nodes.filter(node => node[0] === '[]').length, 1)
        assertStructurallySame(evaluated(fn, [0, 2]), [1, 12])
        assertStructurallySame(evaluated(fn, [1, 2]), [2, 4])
        assertEq(evaluated(fn, [2, 2]), 42)
    },
    normalPathsShareOneFollowingCall: () => {
        const fn = joined(true)
        const value = id()
        const operation = /** @type {Value} */ (['function', {
            target: owner, parameters: [value], rest: null, self: null, captures: [],
            body: block(['return', owner, ['array', [ref(value), ref(value)]]]),
        }])
        const a = assertOk(identityAnalysis(graph(['function', fn])))
        assertEq(a.nodes.filter(node => node[0] === '()').length, 1)
        for (const [count, expected] of /** @type {readonly (readonly [number, readonly number[]])[]} */ ([[0, [1, 12]], [1, [2, 4]]])) {
            const value = evaluated(fn, [count, 2, operation])
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assertStructurallySame(value[0], expected)
        }
        assertEq(evaluated(fn, [2, 2, operation]), 42)
    },
    terminalSubtreesSupplyNoNormalPredecessor: () => {
        const first = id(), second = id(), result = id()
        const fn = /** @type {FastFunction} */ ({
            target: owner, parameters: [first, second], rest: null, self: null, captures: [],
            body: block(['return', owner, ['array', [ref(result)]]], [
                ['if', [result], ref(first), block(['yield', [3]]),
                    block(['yield', []], [['if', [], ref(second), block(['return', owner, 7]), block(['return', owner, 9])]])],
            ]),
        })
        for (const choice of [false, true]) { assertStructurallySame(evaluated(fn, [true, choice]), [3]) }
        assertEq(evaluated(fn, [false, true]), 7)
        assertEq(evaluated(fn, [false, false]), 9)
    },
    prefixesRemainOnBothNormalAndTerminalPaths: () => {
        const first = id(), second = id(), before = id(), terminal = id(), after = id(), joined = id(), discarded = id()
        const failed = /** @type {(value: string) => Value} */ (value => ['function', {
            target: owner, parameters: [], rest: null, self: null, captures: [], body: block(['throw', value]),
        }])
        const succeeded = /** @type {Value} */ (['function', {
            target: owner, parameters: [], rest: null, self: null, captures: [], body: block(['return', owner, 0]),
        }])
        const fn = /** @type {FastFunction} */ ({
            target: owner, parameters: [first, second, before, terminal, after], rest: null, self: null, captures: [],
            body: block(['return', owner, ['array', [ref(joined)]]], [
                ['if', [joined], ref(first),
                    block(['yield', [3]], [['define', discarded, ['()', ref(before), []], 'required']]),
                    block(['yield', [5]], [['if', [], ref(second),
                        block(['return', owner, 42], [['define', discarded, ['()', ref(terminal), []], 'required']]),
                        block(['yield', []])]])],
                ['define', discarded, ['()', ref(after), []], 'required'],
            ]),
        })
        assertEq(assertError(called(fn, [true, false, failed('normal prefix'), failed('terminal prefix'), failed('following')])), 'normal prefix')
        assertEq(assertError(called(fn, [false, true, failed('normal prefix'), failed('terminal prefix'), failed('following')])), 'terminal prefix')
        assertEq(assertError(called(fn, [false, false, failed('normal prefix'), failed('terminal prefix'), failed('following')])), 'following')
        assertEq(assertError(called(fn, [true, false, succeeded, succeeded, failed('following')])), 'following')
        assertEq(evaluated(fn, [false, true, succeeded, succeeded, failed('following')]), 42)
    },
    aBranchOnlyTestIsNotCompletedAtTheJoin: () => {
        const first = id(), operation = id(), deferred = id(), result = id(), required = id()
        const failed = /** @type {Value} */ (['function', {
            target: owner, parameters: [], rest: null, self: null, captures: [], body: block(['throw', 'required lazy read']),
        }])
        const fn = /** @type {FastFunction} */ ({
            target: owner, parameters: [first, operation], rest: null, self: null, captures: [],
            body: block(['return', owner, ['array', [ref(result)]]], [
                ['define', deferred, ['()', ref(operation), []], 'lazy'],
                ['if', [result], ref(first), block(['yield', [3]]),
                    block(['yield', [5]], [['if', [], ref(deferred), block(['return', owner, 42]), block(['yield', []])]])],
                ['define', required, ref(deferred), 'required'],
            ]),
        })
        for (const choice of [true, false]) { assertEq(assertError(called(fn, [choice, failed])), 'required lazy read') }
    },
})
