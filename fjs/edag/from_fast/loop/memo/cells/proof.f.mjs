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

/** @type {(block: Block) => readonly Definition[]} */
const definitionsOf = block => block.statements.flatMap(statement => statement[0] === 'define' ? [statement] : [])

/** @type {(block: Block) => readonly Loop[]} */
const loopsOf = block => block.statements.flatMap(statement => statement[0] === 'loop' ? [statement[1]] : [])

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
        const plan = planned(source, [known])
        const definitions = definitionsOf(plan.block)
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
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].definition, definitions[2])
        assert(plan.cells[0].definition !== local)
        assertEq(plan.definitions.size, 1)
        assertEq(plan.definitions.get(definitions[2]), 0)
        assertEq(plan.definitions.has(definitions[0]), false)
        assertEq(plan.definitions.has(definitions[1]), false)
    },
    distinctRootDeclarations: () => {
        const first = /** @type {Definition} */ (['define', a, ['array', [1]], 'lazy'])
        const second = /** @type {Definition} */ (['define', a, ['array', [2]], 'lazy'])
        const plan = planned(body([first, ['loop', reading(a)], second, ['loop', reading(a, innerTarget)]]))
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, a)
        assertEq(plan.cells[0].definition, definitions[0])
        assertEq(plan.cells[1].definition, definitions[1])
        assertEq(plan.cells[0].initializer, first[2])
        assertEq(plan.cells[1].initializer, second[2])
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 1)
    },
    aliasDeclarationRows: () => {
        const first = /** @type {Definition} */ (['define', a, ['array', [1]], 'lazy'])
        const firstAlias = /** @type {Definition} */ (['define', alias, ['ref', a], 'lazy'])
        const second = /** @type {Definition} */ (['define', b, ['array', [2]], 'lazy'])
        const secondAlias = /** @type {Definition} */ (['define', alias, ['ref', b], 'lazy'])
        const plan = planned(body([
            first, firstAlias, ['loop', reading(alias)], second, secondAlias, ['loop', reading(alias, innerTarget)],
        ]))
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells[0].definition, definitions[0])
        assertEq(plan.cells[1].definition, definitions[2])
        assertEq(plan.definitions.size, 4)
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 0)
        assertEq(plan.definitions.get(definitions[2]), 1)
        assertEq(plan.definitions.get(definitions[3]), 1)
    },
    sharedDefinitionOccurrences: () => {
        const shared = /** @type {Definition} */ (['define', a, ['array', [['ref', known]]], 'lazy'])
        const source = body([
            ['define', known, 1, 'required'], shared, ['loop', reading(a)],
            ['define', known, 2, 'required'], shared, ['loop', reading(a, innerTarget)],
        ])
        const plan = planned(source)
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells.length, 2)
        assert(definitions[1] !== definitions[3])
        assert(definitions[1] !== shared)
        assert(definitions[3] !== shared)
        assertEq(plan.cells[0].definition, definitions[1])
        assertEq(plan.cells[1].definition, definitions[3])
        assertEq(plan.cells[0].initializer, shared[2])
        assertEq(plan.cells[1].initializer, shared[2])
        assertEq(plan.definitions.get(definitions[1]), 0)
        assertEq(plan.definitions.get(definitions[3]), 1)
        assertEq(plan.definitions.has(shared), false)
        assertEq(source.statements[1], shared)
        assertEq(source.statements[4], shared)
    },
    sharedBlockOccurrences: () => {
        const shared = /** @type {Statement} */ (['block', [], body([
            ['define', a, ['array', [['ref', known]]], 'lazy'], ['loop', reading(a)],
        ])])
        const plan = planned(body([
            ['define', known, 1, 'required'], shared,
            ['define', known, 2, 'required'], shared,
        ]))
        const first = plan.block.statements[1]
        const second = plan.block.statements[3]
        assert(first[0] === 'block')
        assert(second[0] === 'block')
        assert(first !== second)
        assert(first[2] !== second[2])
        assertEq(plan.cells.length, 2)
        const firstDefinition = definitionsOf(first[2])[0]
        const secondDefinition = definitionsOf(second[2])[0]
        assert(firstDefinition !== secondDefinition)
        assertEq(plan.definitions.get(firstDefinition), 0)
        assertEq(plan.definitions.get(secondDefinition), 1)
        assertEq(plan.loops.size, 2)
        assertEq(plan.loops.has(loopsOf(first[2])[0]), true)
        assertEq(plan.loops.has(loopsOf(second[2])[0]), true)
    },
    sharedLoopOccurrences: () => {
        const shared = reading(a)
        const plan = planned(body([
            ['define', a, ['array', [1]], 'lazy'], ['loop', shared],
            ['define', a, ['array', [2]], 'lazy'], ['loop', shared],
        ]))
        const loops = loopsOf(plan.block)
        assertEq(plan.cells.length, 2)
        assertEq(plan.loops.size, 2)
        assert(loops[0] !== loops[1])
        assert(loops[0].body !== loops[1].body)
        assertEq(plan.loops.has(shared), false)
        for (const loop of loops) {
            assertEq(plan.loops.has(loop), true)
            assertEq(loop.target, shared.target)
            assertEq(loop.parameters, shared.parameters)
            assertEq(loop.initial, shared.initial)
            assertEq(loop.results, shared.results)
            assertEq(loop.body.exit, shared.body.exit)
        }
    },
    sharedSyntaxAcrossValueBoundary: () => {
        const shared = /** @type {Definition} */ (['define', a, ['array', []], 'lazy'])
        const loop = reading(a)
        const value = /** @type {Value} */ (['block', body([shared, ['loop', loop]], ['yield', [['ref', result]]])])
        const plan = planned(body([['define', known, value, 'required'], shared, ['loop', loop]]))
        const definitions = definitionsOf(plan.block)
        const loops = loopsOf(plan.block)
        assertEq(definitions[0][2], value)
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].definition, definitions[1])
        assertEq(plan.definitions.has(shared), false)
        assertEq(plan.definitions.get(definitions[1]), 0)
        assertEq(plan.loops.size, 1)
        assertEq(plan.loops.has(loop), false)
        assertEq(plan.loops.has(loops[0]), true)
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
        const definitions = definitionsOf(plan.block)
        const loops = loopsOf(plan.block)
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
        assertEq([...plan.loops][0], loops[0])
        assertEq([...plan.loops][1], loops[1])
        assertEq(loops[0].target, first.target)
        assertEq(loops[1].target, second.target)
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
        const firstRegion = plan.block.statements[0]
        const secondRegion = plan.block.statements[1]
        assert(firstRegion[0] === 'block')
        assert(secondRegion[0] === 'if')
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.loops.has(loopsOf(firstRegion[2])[0]), true)
        assertEq(plan.loops.has(loopsOf(secondRegion[3])[0]), true)
        assertEq([...plan.loops][0].target, first.target)
        assertEq([...plan.loops][1].target, second.target)
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
        const plan = planned(containing(loop))
        assertEq(plan.loops.has(loopsOf(plan.block)[0]), true)
        assertEq([...plan.loops][0].target, loop.target)
    },
    deepStatementRegions: () => {
        const loop = reading(a)
        /** @type {Block} */
        let nested = body([['loop', loop]])
        for (let depth = 0; depth < 20_000; ++depth) { nested = body([['block', [], nested]]) }
        const plan = planned(body([['define', a, ['array', []], 'lazy'], ['block', [], nested]]))
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.size, 1)
        assertEq([...plan.loops][0].target, loop.target)
        assert([...plan.loops][0] !== loop)
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
