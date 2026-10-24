/**
 * Cell plans retain source recipes and resolved identity, select only true
 * deferred crossings, and refuse lifetimes beyond the normal helper slice.
 *
 * @import { BindingId, Block, Definition, Exit, Loop, Statement, Value } from '../../../../../js/ast/types.ts'
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

/** @type {(block: Block, externalLazyIds?: readonly BindingId[]) => MemoPlan} */
const planned = (block, externalLazyIds = []) => {
    const plan = memoCells(block, externalLazyIds)
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
    unusedExternal: () => {
        assertEq(memoCells(body(), [known]), null)
        assertEq(memoCells(body([
            ['define', a, ['ref', known], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
        ]), [known]), null)
        const plan = planned(containing(reading(a)), [known])
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.definitions.size, 1)
        assertEq(plan.definitions.get(plan.cells[0].definition), 0)
    },
    establishedExternalAlias: () => {
        const initializer = /** @type {Value} */ (['array', [['ref', alias]]])
        const source = containing(reading(b), [
            ['define', a, ['ref', known], 'required'],
            ['define', alias, ['ref', a], 'lazy'],
            ['define', b, initializer, 'lazy'],
        ])
        const definitions = source.statements.flatMap(statement => statement[0] === 'define' ? [statement] : [])
        const plan = planned(source, [known])
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, b)
        assertEq(plan.cells[0].initializer, initializer)
        assertEq(plan.definitions.size, 1)
        assertEq(plan.definitions.get(definitions[2]), 0)
        assertEq(plan.definitions.has(definitions[0]), false)
        assertEq(plan.definitions.has(definitions[1]), false)
        assertEq(memoCells(containing(reading(a), [['define', a, ['ref', known], 'required']]), [known]), null)
    },
    externalShadowDeclarations: () => {
        const before = /** @type {Definition} */ (['define', known, ['ref', a], 'required'])
        const beforeAlias = /** @type {Definition} */ (['define', alias, ['ref', a], 'lazy'])
        const local = /** @type {Definition} */ (['define', a, ['array', []], 'lazy'])
        const plan = planned(containing(reading(a), [before, beforeAlias, local]), [a])
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].definition, local)
        assertEq(plan.definitions.size, 1)
        assertEq(plan.definitions.get(local), 0)
        assertEq(plan.definitions.has(before), false)
        assertEq(plan.definitions.has(beforeAlias), false)
    },
    distinctRootDeclarations: () => {
        const first = /** @type {Definition} */ (['define', a, ['array', [1]], 'lazy'])
        const second = /** @type {Definition} */ (['define', a, ['array', [2]], 'lazy'])
        const plan = planned(body([first, ['loop', reading(a)], second, ['loop', reading(a, innerTarget)]]))
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, a)
        assertEq(plan.cells[0].definition, first)
        assertEq(plan.cells[1].definition, second)
        assertEq(plan.definitions.get(first), 0)
        assertEq(plan.definitions.get(second), 1)
    },
    aliasDeclarationRows: () => {
        const first = /** @type {Definition} */ (['define', a, ['array', [1]], 'lazy'])
        const firstAlias = /** @type {Definition} */ (['define', alias, ['ref', a], 'lazy'])
        const second = /** @type {Definition} */ (['define', b, ['array', [2]], 'lazy'])
        const secondAlias = /** @type {Definition} */ (['define', alias, ['ref', b], 'lazy'])
        const plan = planned(body([
            first, firstAlias, ['loop', reading(alias)], second, secondAlias, ['loop', reading(alias, innerTarget)],
        ]))
        assertEq(plan.cells[0].definition, first)
        assertEq(plan.cells[1].definition, second)
        assertEq(plan.definitions.size, 4)
        assertEq(plan.definitions.get(first), 0)
        assertEq(plan.definitions.get(firstAlias), 0)
        assertEq(plan.definitions.get(second), 1)
        assertEq(plan.definitions.get(secondAlias), 1)
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
        const definitions = source.statements.flatMap(statement => statement[0] === 'define' ? [statement] : [])
        const plan = planned(source)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].initializer, initializer)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.cells[1].initializer, secondInitializer)
        assertEq(plan.definitions.size, 3)
        assertEq(plan.definitions.get(definitions[2]), 0)
        assertEq(plan.definitions.get(definitions[3]), 1)
        assertEq(plan.definitions.get(definitions[4]), 0)
        assertEq(plan.definitions.has(definitions[5]), false)
        assertEq(plan.definitions.has(definitions[1]), false)
        assertEq(plan.definitions.has(definitions[6]), false)
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
        externalDirect: () => memoCells(containing(reading(known), []), [known]),
        externalAliasChain: () => memoCells(containing(reading(alias), [
            ['define', a, ['ref', known], 'lazy'], ['define', alias, ['ref', a], 'lazy'],
        ]), [known]),
        externalComputedAliasDependency: () => memoCells(containing(reading(b), [
            ['define', a, ['ref', known], 'lazy'], ['define', alias, ['ref', a], 'lazy'],
            ['define', b, ['array', [['ref', alias]]], 'lazy'],
        ]), [known]),
        externalComputedPrerequisite: () => memoCells(containing(reading(b), [
            ['define', a, ['array', [['ref', known]]], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
        ]), [known]),
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
