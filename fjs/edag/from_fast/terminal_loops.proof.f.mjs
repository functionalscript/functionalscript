/** Terminal FAST loops have no normal successor or fabricated failure.
 * @import { BindingId, Block, Function as FastFunction, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { completeTransfers } from './loop/completions/module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { evaluate, failure } from './member_returns/proof.f.mjs'
import { proof as operandOrder } from './operand_order/proof.f.mjs'
import { proof as objectSpread } from './object_spread_returns/proof.f.mjs'
import { proof as invocationRoots } from './loop/root/proof.f.mjs'

/** @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {() => FunctionTarget} */
const owner = () => ({ kind: 'function', index: 0 })
/** @type {() => LoopTarget} */
const target = () => ({ kind: 'loop', index: 0 })
/** @type {(value: BindingId) => Value} */
const ref = value => ['ref', value]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const called = (fn, args = []) => evaluate(fromFast(block(['yield', [['()', ['function', fn], args]]])))

/** @type {(returns: boolean) => FastFunction} */
const mixed = returns => {
    const fn = owner(), outer = target(), inner = target(), stop = id(), breakAt = id(), count = id(), result = id()
    /** @type {readonly Statement[]} */
    const early = returns ? [['if', [], ['===', ref(count), ref(stop)], block(['return', fn, ['array', ['early', ref(count)]]]), block(['yield', []])]] : []
    /** @type {Loop} */
    const terminal = { target: inner, parameters: [], initial: [], results: [],
        body: block(['continue', outer, [['+', ref(count), 1]]], [
            ...early, ['if', [], ['===', ref(count), ref(breakAt)], block(['break', outer, [40]]), block(['yield', []])],
        ]),
    }
    return { target: fn, parameters: [stop, breakAt], rest: null, self: null, captures: [],
        body: block(['return', fn, ['array', ['normal', ref(result)]]], [
            ['loop', { target: outer, parameters: [count], initial: [0], results: [result], body: block(['loop', terminal], [
                ['if', [], ['>=', ref(count), 3], block(['break', outer, [ref(count)]]), block(['yield', []])],
            ]) }],
        ]),
    }
}

export const proof = /** @type {const} */ ({
    computedKeysBeforeReturningArguments: operandOrder.computedKeysConvertBeforeTheirValuesAndArguments,
    objectSpreadsBeforeReturningValues: objectSpread.earlierEntriesBeforeLaterReturn,
    returnsCarryTheValueWithoutACompletionDiscriminator: () => {
        const fn = owner(), loop = target(), limit = id(), state = id(), allocation = id()
        /** @type {FastFunction} */
        const original = { target: fn, parameters: [limit], rest: null, self: null, captures: [],
            body: block(['loop', { target: loop, parameters: [state], initial: [0], results: [],
                body: block(['continue', loop, [['+', ref(state), 1]]], [
                    ['if', [], ['===', ref(state), ref(limit)], block(['return', fn, ['array', [ref(allocation), ref(allocation)]]]), block(['yield', []])],
                ]),
            }], [['define', allocation, ['array', [ref(limit)]], 'required']]),
        }
        const completed = completeTransfers(original, null)
        assert(completed !== original)
        assert(completed.body.exit[0] === 'return')
        assertEq(completed.body.exit[1], fn)
        assert(completed.body.exit[2] instanceof Array && completed.body.exit[2][0] === 'ref')
        const wrapped = completed.body.statements.at(-1)
        assert(wrapped !== undefined && wrapped[0] === 'loop')
        assertEq(completed.body.exit[2][1], wrapped[1].results[0])
        for (const value of [original, completed]) {
            const result = called(value, [3])
            assertStructurallySame(result, [[3], [3]])
            assert(result instanceof Array)
            assertEq(result[0], result[1])
        }
        const table = assertOk(identityAnalysis(fromFast(block(['yield', [['function', original]]]))))
        assertEq(table.nodes.filter(node => node[0] === 'throw').length, 0)
    },
    mixedOutwardTransfersHaveNoNormalFallback: () => {
        for (const returns of [false, true]) {
            const original = mixed(returns)
            const completed = completeTransfers(original, null)
            for (const value of [original, completed]) {
                assertStructurallySame(called(value, [99, 1]), ['normal', 40])
                assertStructurallySame(called(value, [99, 99]), ['normal', 3])
                if (returns) {
                    assertStructurallySame(called(value, [0, 99]), ['early', 0])
                    assertStructurallySame(called(value, [2, 99]), ['early', 2])
                }
            }
            const table = assertOk(identityAnalysis(fromFast(block(['yield', [['function', original]]]))))
            assertEq(table.nodes.filter(node => node[0] === 'throw').length, 0)
        }
    },
    aSingleOuterBreakNeedsNoDispatch: () => {
        const fn = owner(), outer = target(), inner = target(), result = id()
        /** @type {FastFunction} */
        const original = { target: fn, parameters: [], rest: null, self: null, captures: [],
            body: block(['return', fn, ref(result)], [['loop', { target: outer, parameters: [], initial: [], results: [result], body: block(['loop', {
                target: inner, parameters: [], initial: [], results: [], body: block(['break', outer, [7]]),
            }]) }]]),
        }
        assertEq(called(original), 7)
    },
    divergentAndThrowingLoopsAreTheirOwnGoals: () => {
        const loop = target(), state = id()
        const divergent = fromFast(block(['loop', { target: loop, parameters: [state], initial: [0], results: [],
            body: block(['continue', loop, [['+', ref(state), 1]]]),
        }]))
        const table = assertOk(identityAnalysis(divergent))
        assert(table.nodes.some(node => node[0] === 'self'))
        assertEq(table.nodes.filter(node => node[0] === 'throw').length, 0)
        const actualThrow = fromFast(block(['loop', { target: loop, parameters: [], initial: [], results: [], body: block(['throw', 9]) }]))
        failure(actualThrow)
        assertEq(assertOk(identityAnalysis(actualThrow)).nodes.filter(node => node[0] === 'throw').length, 1)
        /** @type {Loop} */
        const terminal = { target: loop, parameters: [], initial: [], results: [], body: block(['throw', 9]) }
        const skipped = fromFast(block(['yield', [['if', false, block(['loop', terminal]), block(['yield', [7]])]]]))
        assertEq(evaluate(skipped), 7)
        failure(fromFast(block(['yield', [['if', true, block(['loop', terminal]), block(['yield', [7]])]]])))
    },
    nestedTerminalContinuesKeepTheirOuterTarget: () => {
        const outer = target(), inner = target(), state = id()
        /** @type {Block} */
        const original = block(['loop', { target: outer, parameters: [state], initial: [0], results: [], body: block(['loop', {
            target: inner, parameters: [], initial: [], results: [], body: block(['continue', outer, [['+', ref(state), 1]]]),
        }]) }])
        const graph = fromFast(original)
        const table = assertOk(identityAnalysis(graph))
        assert(table.nodes.some(node => node[0] === 'self'))
        assertEq(table.nodes.filter(node => node[0] === 'throw').length, 0)
    },
    throw: {
        fixedParameterLimit: invocationRoots.throw.fixedArityLimit,
    },
})
