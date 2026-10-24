/**
 * Cell plans retain source recipes and resolved identity, select only true
 * deferred crossings, and refuse lifetimes beyond the normal helper slice.
 *
 * @import { BindingId, Block, Exit, Loop, Statement, Value } from '../../../../../js/ast/types.ts'
 * @import { MemoPlan } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../../asserts/module.f.js'
import { memoCells } from './module.f.mjs'

const a = /** @type {const} */ ({ index: 0 })
const b = /** @type {const} */ ({ index: 0 })
const alias = /** @type {const} */ ({ index: 0 })
const known = /** @type {const} */ ({ index: 0 })
const result = /** @type {const} */ ({ index: 0 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
const functionTarget = /** @type {const} */ ({ kind: 'function', index: 0 })

/** @type {(statements?: readonly Statement[], exit?: Exit) => Block} */
const body = (statements = [], exit = ['yield', []]) => ({ statements, exit })

/** @type {(block: Block, loopTarget?: Loop['target']) => Loop} */
const loopOf = (block, loopTarget = target) => ({ target: loopTarget, parameters: [], initial: [], results: [result], body: block })

/** @type {(binding: BindingId, loopTarget?: Loop['target']) => Loop} */
const reading = (binding, loopTarget = target) => loopOf(body([], ['break', loopTarget, [['ref', binding]]]), loopTarget)

/** @type {(block: Block) => MemoPlan} */
const planned = block => {
    const plan = memoCells(block)
    assert(plan !== null)
    return plan
}

/** @type {(loop: Loop, statements?: readonly Statement[]) => Block} */
const containing = (loop, statements = [['define', a, ['array', []], 'lazy']]) => body([...statements, ['loop', loop]])

export const proof = /** @type {const} */ ({
    noCrossing: () => {
        assertEq(memoCells(body()), null)
        assertEq(memoCells(body([['define', a, ['array', []], 'lazy']])), null)
        assertEq(memoCells(containing(reading(known), [])), null)
        for (const primitive of /** @type {readonly Value[]} */ ([null, undefined, false, 0, ''])) {
            assertEq(memoCells(containing(reading(alias), [
                ['define', a, primitive, 'lazy'], ['define', alias, ['ref', a], 'lazy'],
            ])), null)
        }
        assertEq(memoCells(containing(reading(alias), [
            ['define', a, ['array', []], 'required'], ['define', alias, ['ref', a], 'lazy'],
        ])), null)
        assertEq(memoCells(containing(reading(alias), [['define', alias, ['ref', known], 'lazy']])), null)
    },
    orderedRecipesAndAliases: () => {
        const unused = /** @type {const} */ ({ index: 0 })
        const establishedAlias = /** @type {const} */ ({ index: 0 })
        const requiredAlias = /** @type {const} */ ({ index: 0 })
        const initializer = /** @type {Value} */ (['array', [['ref', known], ['ref', establishedAlias], ['ref', known]]])
        const secondInitializer = /** @type {Value} */ (['object', []])
        const first = reading(b)
        const second = reading(alias, innerTarget)
        const source = body([
            ['define', known, 7, 'lazy'],
            ['define', establishedAlias, ['ref', known], 'lazy'],
            ['define', a, initializer, 'lazy'],
            ['define', b, secondInitializer, 'lazy'],
            ['define', alias, ['ref', a], 'lazy'],
            ['define', requiredAlias, ['ref', a], 'required'],
            ['define', unused, ['array', [['ref', { index: 0 }]]], 'lazy'],
            ['loop', first], ['loop', second],
        ])
        const plan = planned(source)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].initializer, initializer)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.cells[1].initializer, secondInitializer)
        assertEq(plan.aliases.size, 3)
        assertEq(plan.aliases.get(a), 0)
        assertEq(plan.aliases.get(b), 1)
        assertEq(plan.aliases.get(alias), 0)
        assertEq(plan.aliases.has(requiredAlias), false)
        assertEq(plan.aliases.has(establishedAlias), false)
        assertEq(plan.aliases.has(unused), false)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], first)
        assertEq([...plan.loops][1], second)
        assertStructurallySame(memoCells(source), plan)
    },
    statementScopes: () => {
        const first = reading(a)
        const second = reading(b, innerTarget)
        const source = body([
            ['block', [], body([['define', a, ['array', []], 'lazy'], ['loop', first]])],
            ['if', [], true, body([['define', b, ['array', []], 'lazy'], ['loop', second]]), body()],
        ])
        const plan = planned(source)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.loops.has(first), true)
        assertEq(plan.loops.has(second), true)
    },
    opaqueValueOwners: () => {
        const hidden = containing(reading(a))
        const fn = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [], rest: null, self: null, captures: [],
            body: { ...hidden, exit: ['return', functionTarget, 1] },
        }])
        assertEq(memoCells(body([
            ['define', known, ['block', hidden], 'required'],
            ['define', b, ['if', true, hidden, hidden], 'required'],
            ['define', alias, fn, 'required'],
        ])), null)
    },
    normalTransfers: () => {
        const inner = loopOf(body([
            ['if', [], true, body([], ['break', innerTarget, [1]]), body([], ['continue', innerTarget, []])],
        ], ['break', innerTarget, [2]]), innerTarget)
        const fn = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [], rest: null, self: null, captures: [],
            body: body([], ['return', functionTarget, 1]),
        }])
        const loop = loopOf(body([
            ['define', known, ['ref', a], 'required'],
            ['define', b, fn, 'required'],
            ['block', [], body()],
            ['if', [], false, body([], ['break', target, [['ref', known]]]), body([], ['throw', 'failed'])],
            ['loop', inner],
        ], ['continue', target, []]))
        assertEq(planned(containing(loop)).loops.has(loop), true)
    },
    deepStatementRegions: () => {
        const loop = reading(a)
        /** @type {Block} */
        let nested = body([['loop', loop]])
        for (let depth = 0; depth < 20_000; ++depth) { nested = body([['block', [], nested]]) }
        const plan = planned(body([['define', a, ['array', []], 'lazy'], ['block', [], nested]]))
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.has(loop), true)
    },
    throw: {
        dependentRecipe: () => memoCells(containing(reading(b), [
            ['define', a, ['array', []], 'lazy'], ['define', alias, ['ref', a], 'lazy'],
            ['define', b, ['array', [['ref', alias], ['ref', a]]], 'lazy'],
        ])),
        computedDependent: () => memoCells(containing(reading(a), [
            ['define', a, ['array', []], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
        ])),
        iterationLocal: () => {
            const inner = reading(a, innerTarget)
            return memoCells(body([['loop', loopOf(body([
                ['define', a, ['array', []], 'lazy'], ['loop', inner],
            ], ['break', target, [0]]))]]))
        },
        nestedBoundary: () => {
            const inner = reading(a, innerTarget)
            return memoCells(containing(loopOf(body([['loop', inner]], ['break', target, [0]]))))
        },
        enclosingReturn: () => memoCells(containing(loopOf(body([], ['return', functionTarget, ['ref', a]])))),
        foreignBreak: () => memoCells(containing(loopOf(body([], ['break', innerTarget, [['ref', a]]])))),
        foreignContinue: () => memoCells(containing(loopOf(body([], ['continue', innerTarget, [['ref', a]]])))),
        nestedAncestorBreak: () => memoCells(containing(loopOf(body([
            ['define', known, ['ref', a], 'required'],
            ['loop', loopOf(body([], ['break', target, []]), innerTarget)],
        ], ['break', target, [0]])))),
        nestedAncestorContinue: () => memoCells(containing(loopOf(body([
            ['define', known, ['ref', a], 'required'],
            ['loop', loopOf(body([], ['continue', target, []]), innerTarget)],
        ], ['break', target, [0]])))),
    },
})
