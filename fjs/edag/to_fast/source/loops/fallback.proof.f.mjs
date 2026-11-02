/**
 * Source fallback boundaries keep owning backedges bounded and preserve
 * one-pass functions with ordinary self uses.
 * @import { Block, Function as FastFunction, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertError, assertOk } from '../../../../asserts/module.f.js'
import { fromFast } from '../../../from_fast/module.f.mjs'
import { evaluate } from '../../../from_fast/member_returns/proof.f.mjs'
import { _sourceLoops } from './module.f.mjs'
import { _fallbackFunction, _valueReturnFunction as valueReturnFunction } from './fixtures.f.js'

/** @type {(value: Value) => Block} */
const yielded = value => ({ statements: [], exit: ['yield', [value]] })

export const proof = /** @type {const} */ ({
    recursiveFallbackRefusesPotentialOwningBackedges: () => {
        const fn = _fallbackFunction()
        const original = yielded(['function', fn])
        assertEq(assertError(_sourceLoops(original)), 'an invocation backedge outside the source loop profile')
        const graph = fromFast(original)
        assertEq(evaluate(['()', graph, [-1]]), -7)
        assertEq(evaluate(['()', graph, [0]]), 7)
        assertEq(evaluate(['()', graph, [3]]), 7)
        const root = fn.body.statements[0]
        assert(root[0] === 'loop')
        const terminal = root[1].body.statements.at(-1)
        assert(terminal !== undefined && terminal[0] === 'if')
        const retained = yielded(['function', { ...fn, body: { ...fn.body, statements: [['loop', { ...root[1], body: {
            ...root[1].body, statements: [...root[1].body.statements.slice(0, -1), ['if', [], terminal[2], terminal[3], terminal[4]]],
        } }]] } }])
        assertEq(assertOk(_sourceLoops(retained)), retained)
        const potential = yielded(['function', { ...fn, body: { ...fn.body, statements: [['loop', { ...root[1], body: {
            ...root[1].body, statements: [...root[1].body.statements.slice(0, -1), ['if', terminal[1], terminal[2], terminal[4], terminal[4]]],
            exit: ['continue', root[1].target, root[1].parameters.map(binding => ['ref', binding])],
        } }]] } }])
        assertEq(assertError(_sourceLoops(potential)), 'an invocation backedge outside the source loop profile')
    },
    onePassFallbackKeepsOrdinarySelfCallsAndReturnedSelf: () => {
        const fn = valueReturnFunction()
        const root = fn.body.statements[0]
        assert(root[0] === 'loop')
        const prefix = root[1].body.statements[0]
        const decision = root[1].body.statements[1]
        assert(prefix[0] === 'define' && decision[0] === 'if')
        const state = root[1].parameters[0]
        const self = /** @type {const} */ ({ index: 0 })
        /** @type {FastFunction} */
        const ordinary = { ...fn, self, body: { ...fn.body, statements: [['loop', { ...root[1], body: {
            ...root[1].body, statements: [prefix, ['if', decision[1], decision[2],
                { statements: [], exit: ['break', root[1].target, [['+', ['()', ['ref', self], [0]], 1]]] }, decision[4]]],
        } }]] } }
        /** @type {FastFunction} */
        const returned = { ...fn, self, body: { ...fn.body, statements: [['loop', { ...root[1], body: {
            ...root[1].body, statements: [
                ['define', prefix[1], ['if', ['===', ['ref', state], 0], { statements: [], exit: ['return', fn.target, ['ref', self]] },
                    { statements: [], exit: ['yield', [['ref', state]]] }], 'required'], decision,
            ],
        } }]] } }
        for (const source of [ordinary, returned]) {
            const original = yielded(['function', source])
            const converted = assertOk(_sourceLoops(original))
            assert(converted !== original)
            for (const candidate of [original, converted]) {
                const graph = fromFast(candidate)
                if (source === ordinary) {
                    assertEq(evaluate(['()', graph, [0]]), 7)
                    assertEq(evaluate(['()', graph, [3]]), 8)
                } else {
                    assertEq(evaluate(['===', ['()', graph, [0]], graph]), true)
                    assertEq(evaluate(['()', graph, [3]]), 3)
                }
            }
        }
    },
})
