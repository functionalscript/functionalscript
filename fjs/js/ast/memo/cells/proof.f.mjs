/**
 * Cell plans retain source recipes and resolved identity, select only true
 * deferred dependency closures, and refuse lifetimes beyond the normal helper
 * slice.
 *
 * @import { BindingId, Block, Definition, Exit, FunctionTarget, Loop, Statement, Value } from '../../types.ts'
 * @import { MemoPlan, RecipePlan } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { freeBindings } from '../../control/module.f.mjs'
import { _hasReturn, memoCells, recipeCells } from './module.f.mjs'

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

/** @type {(block: Block, externalLazyIds?: readonly BindingId[], owner?: FunctionTarget | null) => MemoPlan} */
const planned = (block, externalLazyIds = [], owner = null) => {
    const plan = memoCells(block, externalLazyIds, owner)
    assert(plan !== null)
    return plan
}

/** @type {(loop: Loop, statements?: readonly Statement[]) => Block} */
const containing = (loop, statements = [['define', a, ['array', []], 'lazy']]) => body([...statements, ['loop', loop]])

/** @type {(block: Block) => readonly Definition[]} */
const definitionsOf = block => block.statements.flatMap(statement => statement[0] === 'define' ? [statement] : [])

/** @type {(block: Block) => readonly Loop[]} */
const loopsOf = block => block.statements.flatMap(statement => statement[0] === 'loop' ? [statement[1]] : [])

/** @type {(plan: RecipePlan) => Block} */
const recipeBlock = plan => {
    const { value } = plan
    assert(value instanceof Array && value[0] === 'block')
    return value[1]
}

export const proof = /** @type {const} */ ({
    deferredReturnInventoryKeepsFunctionBoundaries: () => {
        const returned = body([], ['return', functionTarget, 7])
        const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
        for (const value of /** @type {readonly Value[]} */ ([
            1, null, ['ref', a], ['Object.is'], ['array', [['ref', a]]],
            ['block', body([], ['return', foreign, 7])],
            ['function', { target: functionTarget, parameters: [], rest: null, self: null, captures: [], body: returned }],
        ])) { assertEq(_hasReturn(value, functionTarget), false) }
        for (const value of /** @type {readonly Value[]} */ ([
            ['block', returned], ['if', true, returned, body()],
            ['function', { target: foreign, parameters: [], rest: null, self: null,
                captures: [{ binding: a, value: ['block', returned] }], body: body([], ['return', foreign, 1]) }],
            ['block', body([
                ['define', a, ['block', returned], 'lazy'], ['block', [], body()],
                ['if', [], true, body(), body()], ['loop', loopOf(body(), target)],
            ])],
        ])) { assertEq(_hasReturn(value, functionTarget), true) }
        /** @type {Value} */
        let deep = ['block', returned]
        for (let depth = 0; depth < 20_000; depth += 1) { deep = ['array', [deep]] }
        assertEq(_hasReturn(deep, functionTarget), true)
    },
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
    deferredHelpersSelectTheirCallerPrerequisites: () => {
        const initializer = /** @type {Value} */ (['block', body([['loop', reading(a)]], ['yield', [['ref', result]]])])
        const source = body([
            ['define', a, ['array', [4]], 'lazy'], ['define', b, initializer, 'lazy'],
        ], ['yield', [['array', [['ref', b], ['ref', a]]]]])
        const plan = planned(source)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.cells[1].initializer, initializer)
        assertEq(plan.loops.size, 0)
        const definitions = definitionsOf(plan.block)
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 1)
    },
    unrelatedDeferredLoopsKeepTheirCallerUnselected: () => {
        const initializer = /** @type {Value} */ (['block', body([
            ['define', known, ['array', [9]], 'lazy'], ['loop', reading(known)],
        ], ['yield', [['ref', a]]])])
        for (const exit of /** @type {readonly Exit[]} */ ([['yield', [0]], ['yield', [['ref', b]]]])) {
            assertEq(memoCells(body([
                ['define', a, ['array', [4]], 'lazy'], ['define', b, initializer, 'lazy'],
            ], exit)), null)
        }
    },
    deferredParameterSnapshotsShadowCallerMarkers: () => {
        const loop = /** @type {Loop} */ ({ ...reading(a), parameters: [a], initial: [['ref', a]] })
        const initializer = /** @type {Value} */ (['block', body([['loop', loop]], ['yield', [['ref', result]]])])
        assertEq(memoCells(body([
            ['define', a, ['array', [4]], 'lazy'], ['define', known, ['array', [9]], 'lazy'],
            ['define', b, initializer, 'lazy'],
        ], ['yield', [['ref', b]]])), null)
    },
    deadDeferredStatementSuffixDoesNotSelectExternalRoots: () => {
        const stopped = body([], ['throw', 'stopped'])
        const terminals = /** @type {readonly Statement[]} */ ([
            ['block', [], stopped], ['if', [], true, stopped, stopped],
        ])
        for (const terminal of terminals) {
            const initializer = /** @type {Value} */ (['block', body([terminal, ['loop', reading(known)]], ['yield', [['ref', result]]])])
            assertEq(memoCells(body([['define', b, initializer, 'lazy']]), [known]), null)
        }
    },
    deepDeferredSelection: () => {
        /** @type {Value} */
        let initializer = ['block', body([['loop', reading(a)]], ['yield', [['ref', result]]])]
        for (let depth = 0; depth < 20_000; depth += 1) {
            const local = /** @type {const} */ ({ index: depth })
            initializer = ['block', body([['define', local, initializer, 'lazy']], ['yield', [['ref', local]]])]
        }
        const plan = planned(body([
            ['define', a, ['array', [4]], 'lazy'], ['define', b, initializer, 'lazy'],
        ], ['yield', [['ref', b]]]))
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.loops.size, 0)
    },
    deadMemoHelpers: () => {
        const unsupported = loopOf(body([], ['return', functionTarget, ['ref', a]]))
        const terminalBlock = /** @type {Statement} */ (['block', [], body([], ['throw', 'stopped'])])
        const terminalIf = /** @type {Statement} */ (['if', [], ['ref', known],
            body([], ['return', functionTarget, 1]), body([], ['throw', 'stopped'])])
        for (const terminal of [terminalBlock, terminalIf]) {
            const source = body([
                ['define', a, ['array', []], 'lazy'], terminal, ['loop', unsupported],
            ], ['continue', innerTarget, [['ref', b]]])
            assertEq(memoCells(source, [b]), null)
        }
    },
    activePlanPrunesDeadLoopSuffix: () => {
        const inner = reading(a, innerTarget)
        const sourceLoop = loopOf(body([
            ['define', known, ['ref', a], 'required'],
            ['block', [], body([], ['throw', 'stopped'])],
            ['loop', inner],
        ], ['continue', innerTarget, [['ref', b]]]))
        const plan = planned(containing(sourceLoop), [b])
        const loop = loopsOf(plan.block)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.loops.size, 1)
        assertEq(loop.body.statements.length, 2)
        assertEq(loopsOf(loop.body).length, 0)
        assertStructurallySame(loop.body.exit, ['yield', []])
        const terminal = loop.body.statements[1]
        assert(terminal[0] === 'block')
        assertStructurallySame(terminal[2].exit, ['throw', 'stopped'])
    },
    activePlanPrunesDeadCallerSuffix: () => {
        const source = body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a)],
            ['if', [], ['ref', known], body([], ['throw', 'first']), body([], ['throw', 'second'])],
            ['loop', loopOf(body([], ['return', functionTarget, ['ref', b]]), innerTarget)],
        ], ['break', innerTarget, [['ref', b]]])
        const plan = planned(source, [b])
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.size, 1)
        assertEq(plan.block.statements.length, 3)
        assertStructurallySame(plan.block.exit, ['yield', []])
    },
    mixedConditionalKeepsSuffix: () => {
        for (const yieldingElse of [false, true]) {
            const then = yieldingElse ? body([], ['throw', 'stopped']) : body()
            const otherwise = yieldingElse ? body() : body([], ['throw', 'stopped'])
            const sourceLoop = loopOf(body([
                ['if', [], false, then, otherwise],
                ['define', known, ['ref', a], 'required'],
            ], ['break', target, [['ref', known]]]))
            const plan = planned(containing(sourceLoop))
            const loop = loopsOf(plan.block)[0]
            assertEq(plan.cells.length, 1)
            assertEq(loop.body.statements.length, 2)
            assertEq(loop.body.exit, sourceLoop.body.exit)
            const conditional = loop.body.statements[0]
            assert(conditional[0] === 'if')
            assertEq(conditional[2], false)
            assertEq(conditional[3].exit, then.exit)
            assertEq(conditional[4].exit, otherwise.exit)
        }
    },
    loopsKeepPotentialNormalSuffix: () => {
        const stopped = loopOf(body([], ['throw', 'stopped']), innerTarget)
        const source = body([
            ['define', a, ['array', []], 'lazy'], ['loop', stopped], ['loop', reading(a)],
        ])
        const plan = planned(source)
        const loops = loopsOf(plan.block)
        assertEq(loops.length, 2)
        assertEq(plan.block.statements.length, 3)
        assertEq(plan.loops.size, 1)
        assertEq(plan.loops.has(loops[0]), false)
        assertEq(plan.loops.has(loops[1]), true)
        assertEq(plan.block.exit, source.exit)
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
        const operand = definitions[0][2]
        assert(operand instanceof Array && operand[0] === 'block')
        assert(operand !== value)
        const innerDefinition = definitionsOf(operand[1])[0]
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].definition, innerDefinition)
        assertEq(plan.cells[1].definition, definitions[1])
        assertEq(plan.definitions.has(shared), false)
        assertEq(plan.definitions.get(innerDefinition), 0)
        assertEq(plan.definitions.get(definitions[1]), 1)
        assertEq(plan.loops.size, 2)
        assertEq(plan.loops.has(loop), false)
        assertEq(plan.loops.has(loopsOf(operand[1])[0]), true)
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
    dependentPrerequisites: () => {
        const initializer = /** @type {Value} */ (['array', [['ref', alias], ['ref', a]]])
        const loop = reading(b)
        const source = containing(loop, [
            ['define', a, ['array', []], 'lazy'], ['define', alias, ['ref', a], 'lazy'],
            ['define', b, initializer, 'lazy'],
        ])
        const plan = planned(source)
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.cells[1].initializer, initializer)
        assertEq(plan.cells[0].definition, definitions[0])
        assertEq(plan.cells[1].definition, definitions[2])
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 0)
        assertEq(plan.definitions.get(definitions[2]), 1)
        assertEq(plan.loops.size, 1)
        assertEq(plan.loops.has(loopsOf(plan.block)[0]), true)
        assertEq([...plan.loops][0].target, loop.target)
    },
    computedDependents: () => {
        const third = /** @type {const} */ ({ index: 0 })
        const fourth = /** @type {const} */ ({ index: 0 })
        const unused = /** @type {const} */ ({ index: 0 })
        const loop = reading(a)
        const source = containing(loop, [
            ['define', a, ['array', []], 'lazy'],
            ['define', b, ['array', []], 'lazy'],
            ['define', alias, ['ref', b], 'lazy'],
            ['define', third, ['array', [['ref', a], ['ref', alias]]], 'lazy'],
            ['define', fourth, ['array', [['ref', third]]], 'lazy'],
            ['define', unused, ['array', []], 'lazy'],
        ])
        const plan = planned(source)
        const definitions = definitionsOf(plan.block)
        assertEq(plan.cells.length, 4)
        for (const [index, binding] of [a, b, third, fourth].entries()) {
            assertEq(plan.cells[index].binding, binding)
            assertEq(plan.definitions.get(plan.cells[index].definition), index)
        }
        assertEq(plan.definitions.get(definitions[2]), 1)
        assertEq(plan.definitions.has(definitions[5]), false)
        assertEq(plan.loops.size, 1)
        assertEq(plan.loops.has(loopsOf(plan.block)[0]), true)
        assertEq([...plan.loops][0].target, loop.target)
        const again = planned(source)
        for (const [index, cell] of plan.cells.entries()) {
            assertEq(again.cells[index].binding, cell.binding)
            assertEq(again.cells[index].initializer, cell.initializer)
        }
    },
    branchOwnedDependents: () => {
        const local = /** @type {const} */ ({ index: 0 })
        const loop = reading(a)
        const source = body([
            ['define', a, ['array', []], 'lazy'],
            ['if', [], false, body([
                ['define', local, 8, 'required'],
                ['define', b, ['array', [['ref', a], ['ref', local]]], 'lazy'],
            ]), body()],
            ['loop', loop],
        ])
        const plan = planned(source)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.definitions.size, 2)
        assertEq(plan.definitions.get(plan.cells[0].definition), 0)
        assertEq(plan.definitions.get(plan.cells[1].definition), 1)
    },
    nestedCallerCells: () => {
        for (const depth of [2, 3]) {
            const targets = Array.from({ length: depth }, () => /** @type {const} */ ({ kind: 'loop', index: 0 }))
            let sourceLoop = reading(b, targets[depth - 1])
            for (let index = depth - 2; index >= 0; index -= 1) {
                sourceLoop = loopOf(body([['loop', sourceLoop]], ['break', targets[index], [0]]), targets[index])
            }
            const plan = planned(containing(sourceLoop, [
                ['define', a, ['array', []], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
            ]))
            const definitions = definitionsOf(plan.block)
            assertEq(plan.cells.length, 2)
            assertEq(plan.cells[0].binding, a)
            assertEq(plan.cells[1].binding, b)
            assertEq(plan.cells[0].iterationLocal, false)
            assertEq(plan.cells[1].iterationLocal, false)
            assertEq(plan.definitions.get(definitions[0]), 0)
            assertEq(plan.definitions.get(definitions[1]), 1)
            assertEq(plan.loops.size, depth)
            const selected = [...plan.loops]
            let loop = loopsOf(plan.block)[0]
            for (let index = 0; index < depth; index += 1) {
                assertEq(loop, selected[index])
                assertEq(loop.target, targets[index])
                if (index + 1 !== depth) { loop = loopsOf(loop.body)[0] }
            }
        }
    },
    nestedSiblingCellOrder: () => {
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const first = reading(b, innerTarget)
        const second = reading(a, secondTarget)
        const outer = loopOf(body([['loop', first], ['loop', second]], ['break', target, [0]]))
        const plan = planned(containing(outer, [
            ['define', a, ['array', [1]], 'lazy'], ['define', b, ['array', [2]], 'lazy'],
        ]))
        const definitions = definitionsOf(plan.block)
        const parent = loopsOf(plan.block)[0]
        const children = loopsOf(parent.body)
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 1)
        assertEq(plan.loops.size, 3)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], children[0])
        assertEq([...plan.loops][2], children[1])
        assertEq(children[0].target, first.target)
        assertEq(children[1].target, second.target)
    },
    nestedConditionalAliases: () => {
        const otherwiseTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = loopOf(body([
            ['if', [], ['ref', known],
                body([['define', alias, ['ref', b], 'lazy'], ['loop', reading(alias, innerTarget)]]),
                body([['define', alias, ['ref', a], 'lazy'], ['loop', reading(alias, otherwiseTarget)]])],
        ], ['break', target, [0]]))
        const plan = planned(containing(outer, [
            ['define', a, ['array', [1]], 'lazy'], ['define', b, ['array', [2]], 'lazy'],
        ]))
        const parent = loopsOf(plan.block)[0]
        const conditional = parent.body.statements[0]
        assert(conditional[0] === 'if')
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.definitions.size, 4)
        assertEq(plan.definitions.get(definitionsOf(conditional[3])[0]), 1)
        assertEq(plan.definitions.get(definitionsOf(conditional[4])[0]), 0)
        assertEq(plan.loops.size, 3)
        assertEq(plan.loops.has(parent), true)
        assertEq(plan.loops.has(loopsOf(conditional[3])[0]), true)
        assertEq(plan.loops.has(loopsOf(conditional[4])[0]), true)
    },
    nestedInitialDemands: () => {
        for (const readsCaller of [false, true]) {
            const inner = /** @type {Loop} */ ({
                target: innerTarget, parameters: [known], initial: [['ref', a]], results: [result],
                body: body([], ['break', innerTarget, [['array', [['ref', known], ...(readsCaller ? [/** @type {Value} */ (['ref', a])] : [])]]]]),
            })
            const outer = loopOf(body([['loop', inner]], ['break', target, [0]]))
            const plan = planned(containing(outer))
            const parent = loopsOf(plan.block)[0]
            const child = loopsOf(parent.body)[0]
            assertEq(plan.cells.length, 1)
            assertEq(plan.cells[0].binding, a)
            assertEq(plan.definitions.get(plan.cells[0].definition), 0)
            assertEq(plan.loops.size, readsCaller ? 2 : 1)
            assertEq(plan.loops.has(parent), true)
            assertEq(plan.loops.has(child), readsCaller)
            assertEq(child.initial, inner.initial)
            assertEq(child.parameters, inner.parameters)
        }
    },
    iterationLocalCellOwner: () => {
        const outer = loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
        ], ['break', target, [0]]))
        const plan = planned(body([['loop', outer]]))
        const parent = loopsOf(plan.block)[0]
        const child = loopsOf(parent.body)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.cells[0].definition, definitionsOf(parent.body)[0])
        assertEq(plan.definitions.get(plan.cells[0].definition), 0)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], child)
    },
    iterationLocalDependentOrder: () => {
        for (const demanded of [false, true]) {
            const outer = loopOf(body([
                ['define', b, ['array', [['ref', a]]], 'lazy'],
                ...(demanded ? [/** @type {Statement} */ (['loop', reading(b, innerTarget)])] : []),
            ], ['break', target, [['ref', a]]]))
            const plan = planned(containing(outer))
            const parent = loopsOf(plan.block)[0]
            assertEq(plan.cells.length, 2)
            assertEq(plan.cells[0].binding, a)
            assertEq(plan.cells[1].binding, b)
            assertEq(plan.cells[0].iterationLocal, false)
            assertEq(plan.cells[1].iterationLocal, true)
            assertEq(plan.definitions.get(definitionsOf(plan.block)[0]), 0)
            assertEq(plan.definitions.get(definitionsOf(parent.body)[0]), 1)
            assertEq(plan.loops.size, demanded ? 2 : 1)
            assertEq([...plan.loops][0], parent)
        }
    },
    iterationLocalCallerPrerequisite: () => {
        const outer = loopOf(body([
            ['define', a, ['array', [['ref', known]]], 'lazy'], ['loop', reading(a, innerTarget)],
        ], ['break', target, [0]]))
        const plan = planned(body([['define', known, 7, 'required'], ['loop', outer]]))
        const parent = loopsOf(plan.block)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.definitions.has(definitionsOf(plan.block)[0]), false)
        assertEq(plan.definitions.get(definitionsOf(parent.body)[0]), 0)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], loopsOf(parent.body)[0])
    },
    iterationLocalThreeLevels: () => {
        const leafTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const middle = loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a, leafTarget)],
        ], ['break', innerTarget, [0]]), innerTarget)
        const outer = loopOf(body([['loop', middle]], ['break', target, [0]]))
        const plan = planned(body([['loop', outer]]))
        const parent = loopsOf(plan.block)[0]
        const child = loopsOf(parent.body)[0]
        const leaf = loopsOf(child.body)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.cells[0].definition, definitionsOf(child.body)[0])
        assertEq(plan.loops.size, 3)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], child)
        assertEq([...plan.loops][2], leaf)
        assertEq(parent.target, target)
        assertEq(child.target, innerTarget)
        assertEq(leaf.target, leafTarget)
    },
    iterationLocalNestedOwners: () => {
        const leafTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const middle = loopOf(body([
            ['define', b, ['array', [['ref', a]]], 'lazy'], ['loop', reading(b, leafTarget)],
        ], ['break', innerTarget, [0]]), innerTarget)
        const outer = loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', middle],
        ], ['break', target, [0]]))
        const plan = planned(body([['loop', outer]]))
        const parent = loopsOf(plan.block)[0]
        const child = loopsOf(parent.body)[0]
        assertEq(plan.cells.length, 2)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[1].binding, b)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.cells[1].iterationLocal, true)
        assertEq(plan.definitions.get(definitionsOf(parent.body)[0]), 0)
        assertEq(plan.definitions.get(definitionsOf(child.body)[0]), 1)
        assertEq(plan.loops.size, 3)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], child)
        assertEq([...plan.loops][2], loopsOf(child.body)[0])
    },
    iterationLocalAliasSiblings: () => {
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
            ['define', alias, ['ref', a], 'lazy'], ['loop', reading(alias, secondTarget)],
        ], ['break', target, [0]]))
        const plan = planned(body([['loop', outer]]))
        const parent = loopsOf(plan.block)[0]
        const definitions = definitionsOf(parent.body)
        const children = loopsOf(parent.body)
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.cells[0].definition, definitions[0])
        assertEq(plan.definitions.size, 2)
        assertEq(plan.definitions.get(definitions[0]), 0)
        assertEq(plan.definitions.get(definitions[1]), 0)
        assertEq(plan.loops.size, 3)
        assertEq([...plan.loops][0], parent)
        assertEq([...plan.loops][1], children[0])
        assertEq([...plan.loops][2], children[1])
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
    eagerValueOwnersAndOpaqueFunctions: () => {
        const hidden = containing(reading(a))
        const fn = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [], rest: null, self: null, captures: [],
            body: { ...hidden, exit: ['return', functionTarget, 1] },
        }])
        const plan = planned(body([
            ['define', known, ['block', hidden], 'required'],
            ['define', b, ['if', true, hidden, hidden], 'required'],
            ['define', alias, fn, 'required'],
        ]))
        assertEq(plan.cells.length, 3)
        assertEq(plan.loops.size, 3)
        assertEq(definitionsOf(plan.block)[2][2], fn)
        assertEq(memoCells(body([['define', alias, fn, 'required']])), null)
    },
    owningFunctionReturn: () => {
        const sourceLoop = loopOf(body([], ['return', functionTarget, ['ref', a]]))
        const plan = planned(containing(sourceLoop), [], functionTarget)
        const loop = loopsOf(plan.block)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].binding, a)
        assertEq(plan.cells[0].iterationLocal, false)
        assertEq(plan.loops.size, 1)
        assertEq(plan.loops.has(loop), true)
        assertEq(loop.body.exit, sourceLoop.body.exit)
    },
    nestedOwningFunctionReturn: () => {
        const sourceInner = loopOf(body([], ['return', functionTarget, ['array', [['ref', a], ['ref', a]]]]), innerTarget)
        const sourceOuter = loopOf(body([['loop', sourceInner]], ['break', target, [0]]))
        const plan = planned(containing(sourceOuter), [], functionTarget)
        const outer = loopsOf(plan.block)[0]
        const inner = loopsOf(outer.body)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], outer)
        assertEq([...plan.loops][1], inner)
        assertEq(inner.body.exit, sourceInner.body.exit)
        assertEq(outer.body.exit, sourceOuter.body.exit)
    },
    mixedOwningFunctionReturn: () => {
        for (const returningThen of [false, true]) {
            const returning = body([], ['return', functionTarget, ['ref', a]])
            const sourceLoop = loopOf(body([
                ['if', [], false, returningThen ? returning : body(), returningThen ? body() : returning],
            ], ['break', target, [['ref', a]]]))
            const plan = planned(containing(sourceLoop), [], functionTarget)
            const loop = loopsOf(plan.block)[0]
            const conditional = loop.body.statements[0]
            assert(conditional[0] === 'if')
            assertEq(plan.cells.length, 1)
            assertEq(plan.loops.size, 1)
            assertEq(loop.body.exit, sourceLoop.body.exit)
            assertEq(conditional[3].exit[0], returningThen ? 'return' : 'yield')
            assertEq(conditional[4].exit[0], returningThen ? 'yield' : 'return')
        }
    },
    localOwnerFunctionReturn: () => {
        const sourceOuter = loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
        ], ['return', functionTarget, 0]))
        const plan = planned(body([['loop', sourceOuter]]), [], functionTarget)
        const outer = loopsOf(plan.block)[0]
        const inner = loopsOf(outer.body)[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.cells[0].iterationLocal, true)
        assertEq(plan.definitions.get(definitionsOf(outer.body)[0]), 0)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], outer)
        assertEq([...plan.loops][1], inner)
        assertEq(outer.body.exit, sourceOuter.body.exit)
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
    ancestorTransfers: () => {
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const inner = loopOf(body([], [kind, target, [['ref', a]]]), innerTarget)
            const plan = planned(containing(loopOf(body([['loop', inner]], ['break', target, [0]]))))
            const outer = loopsOf(plan.block)[0]
            const nested = loopsOf(outer.body)[0]
            assertEq(plan.cells.length, 1)
            assertEq(plan.loops.size, 2)
            assertEq([...plan.loops][0], outer)
            assertEq([...plan.loops][1], nested)
            assertEq(nested.body.exit, inner.body.exit)
        }
    },
    neutralTransferClosure: () => {
        const firstTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const first = loopOf(body([], ['continue', target, []]), firstTarget)
        const second = loopOf(body([], ['continue', innerTarget, []]), secondTarget)
        const middle = loopOf(body([
            ['if', [], ['ref', known], body([['loop', first]]), body([['loop', second]])],
        ], ['break', innerTarget, [0]]), innerTarget)
        const plan = planned(containing(loopOf(body([
            ['define', known, ['ref', a], 'required'], ['loop', middle],
        ], ['break', target, [0]]))))
        const outer = loopsOf(plan.block)[0]
        const parent = loopsOf(outer.body)[0]
        const conditional = parent.body.statements[0]
        assert(conditional[0] === 'if')
        const left = loopsOf(conditional[3])[0], right = loopsOf(conditional[4])[0]
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.size, 4)
        assertEq([...plan.loops][0], outer)
        assertEq([...plan.loops][1], parent)
        assertEq([...plan.loops][2], left)
        assertEq([...plan.loops][3], right)
        assertEq(left.target, firstTarget)
        assertEq(right.target, secondTarget)
    },
    neutralTransfersToUnselectedOwners: () => {
        const leafTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const leaf = loopOf(body([], ['break', innerTarget, [0]]), leafTarget)
        const middle = loopOf(body([['loop', leaf]], ['break', innerTarget, [0]]), innerTarget)
        const source = loopOf(body([
            ['define', known, ['ref', a], 'required'], ['loop', middle],
        ], ['break', target, [0]]))
        const plan = planned(containing(source))
        const outer = loopsOf(plan.block)[0]
        assertEq(plan.loops.size, 1)
        assertEq([...plan.loops][0], outer)
        assertEq(plan.loops.has(loopsOf(outer.body)[0]), false)
        const returning = loopOf(body([], ['return', functionTarget, 7]), innerTarget)
        const returned = planned(containing(loopOf(body([
            ['define', known, ['ref', a], 'required'], ['loop', returning],
        ], ['break', target, [0]]))), [], functionTarget)
        assertEq(returned.loops.size, 1)
    },
    sharedLoopTargetsKeepLexicalSelection: () => {
        const shared = reading(a, innerTarget)
        const laterTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const first = loopOf(body([['loop', shared]], ['break', target, [0]]))
        const second = loopOf(body([
            ['define', a, 7, 'required'], ['loop', shared],
        ], ['break', laterTarget, [0]]), laterTarget)
        const source = body([
            ['define', a, ['array', []], 'lazy'], ['loop', first], ['loop', second],
        ], ['continue', laterTarget, []])
        const plan = planned(source)
        const loops = loopsOf(plan.block)
        const selected = loopsOf(loops[0].body)[0]
        const ordinary = loopsOf(loops[1].body)[0]
        assert(selected !== ordinary)
        assertEq(selected.target, ordinary.target)
        assertEq(plan.loops.size, 2)
        assertEq([...plan.loops][0], loops[0])
        assertEq([...plan.loops][1], selected)
        assertEq(plan.loops.has(ordinary), false)
        assertEq(plan.block.exit, source.exit)
    },
    controlOnlyWithoutMemo: () => {
        const inner = loopOf(body([], ['continue', target, []]), innerTarget)
        assertEq(memoCells(body([['loop', loopOf(body([['loop', inner]], ['break', target, [0]]))]])), null)
        assertEq(memoCells(body([['loop', loopOf(body([], ['return', functionTarget, 0]))]])), null)
    },
    deepStatementRegions: () => {
        const loop = reading(a)
        /** @type {Block} */
        let nested = body([['loop', loop]])
        for (let depth = 0; depth < 20_000; depth += 1) { nested = body([['block', [], nested]]) }
        const plan = planned(body([['define', a, ['array', []], 'lazy'], ['block', [], nested]]))
        assertEq(plan.cells.length, 1)
        assertEq(plan.loops.size, 1)
        assertEq([...plan.loops][0].target, loop.target)
        assert([...plan.loops][0] !== loop)
    },
    recipe: {
        unchanged: () => {
            const outer = planned(containing(reading(a)))
            const sources = /** @type {readonly Value[]} */ ([
                null, undefined, 0, ['ref', a], ['entry'], ['array', [['ref', a]]],
                ['block', body([
                    ['define', known, 1, 'lazy'], ['define', alias, ['ref', a], 'lazy'],
                    ['define', b, ['array', []], 'lazy'],
                ], ['yield', [['ref', b]]])],
                ['block', body([
                    ['define', known, 1, 'lazy'], ['define', b, ['ref', known], 'lazy'],
                ], ['yield', [['ref', b]]])],
            ])
            for (const value of sources) {
                const plan = recipeCells(value, outer, new Map([[a, 0]]))
                assertEq(plan.value, value)
                assertEq(plan.localCount, 0)
                assertEq(plan.layout.cells, outer.cells)
                assertEq(plan.layout.definitions.size, 0)
                assertEq(plan.layout.loops.size, 0)
            }
            const independent = /** @type {Value} */ (['block', body([['define', b, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', b]]])])
            assertEq(recipeCells(independent, outer, new Map()).value, independent)
        },
        dependencyClosure: () => {
            const outer = planned(containing(reading(b), [
                ['define', a, ['array', []], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
            ]))
            const local = /** @type {const} */ ({ index: 0 })
            const dependent = /** @type {const} */ ({ index: 0 })
            const localAlias = /** @type {const} */ ({ index: 0 })
            const unused = /** @type {const} */ ({ index: 0 })
            const value = /** @type {Value} */ (['block', body([
                ['define', alias, ['ref', a], 'lazy'],
                ['define', local, ['array', []], 'lazy'],
                ['define', dependent, ['array', [['ref', alias], ['ref', local]]], 'lazy'],
                ['define', localAlias, ['ref', dependent], 'lazy'],
                ['define', unused, ['array', []], 'lazy'],
            ], ['yield', [['ref', localAlias]]])])
            const plan = recipeCells(value, outer, new Map([[a, 0], [known, 0], [b, 1]]))
            const definitions = definitionsOf(recipeBlock(plan))
            assertEq(plan.localCount, 2)
            assertEq(plan.layout.cells.length, 4)
            assertEq(plan.layout.cells[0], outer.cells[0])
            assertEq(plan.layout.cells[1], outer.cells[1])
            assertEq(plan.layout.cells[2].binding, local)
            assertEq(plan.layout.cells[3].binding, dependent)
            assertEq(plan.layout.cells[2].iterationLocal, false)
            assertEq(plan.layout.cells[3].iterationLocal, false)
            assertEq(plan.layout.definitions.get(definitions[0]), 0)
            assertEq(plan.layout.definitions.get(definitions[1]), 2)
            assertEq(plan.layout.definitions.get(definitions[2]), 3)
            assertEq(plan.layout.definitions.get(definitions[3]), 3)
            assertEq(plan.layout.definitions.has(definitions[4]), false)
            assertEq(plan.layout.definitions.has(outer.cells[0].definition), false)
            assertEq(plan.layout.loops.size, 0)
        },
        lexicalOccurrences: () => {
            const outer = planned(containing(reading(a)))
            const shared = /** @type {Definition} */ (['define', b, ['array', [['ref', a], ['ref', known]]], 'lazy'])
            const value = /** @type {Value} */ (['block', body([
                ['define', known, 1, 'required'], shared, ['define', alias, ['ref', b], 'lazy'],
                ['define', known, 2, 'required'], shared,
            ], ['yield', [['ref', b]]])])
            const plan = recipeCells(value, outer, new Map([[a, 0]]))
            const definitions = definitionsOf(recipeBlock(plan))
            assertEq(plan.localCount, 2)
            assert(definitions[1] !== definitions[4])
            assertEq(plan.layout.definitions.get(definitions[1]), 1)
            assertEq(plan.layout.definitions.get(definitions[2]), 1)
            assertEq(plan.layout.definitions.get(definitions[4]), 2)
            assertEq(plan.layout.cells[1].initializer, shared[2])
            assertEq(plan.layout.cells[2].initializer, shared[2])
            assertEq(plan.layout.definitions.has(shared), false)
            const shadowed = /** @type {Value} */ (['block', body([
                ['define', a, 7, 'required'], ['define', b, ['array', [['ref', a]]], 'lazy'],
            ], ['yield', [['ref', b]]])])
            assertEq(recipeCells(shadowed, outer, new Map([[a, 0]])).localCount, 0)
            const rebound = /** @type {Value} */ (['block', body([
                ['define', a, ['array', [['ref', a]]], 'lazy'], ['define', b, ['array', [['ref', a]]], 'lazy'],
            ], ['yield', [['ref', b]]])])
            const reboundPlan = recipeCells(rebound, outer, new Map([[a, 0]]))
            assertEq(reboundPlan.localCount, 2)
            assertEq(reboundPlan.layout.cells[1].binding, a)
            assertEq(reboundPlan.layout.cells[2].binding, b)
        },
        eagerRegionsAndOpaqueFunctions: () => {
            const outer = planned(containing(reading(a)))
            const local = /** @type {const} */ ({ index: 0 })
            const captured = /** @type {const} */ ({ index: 0 })
            const entered = /** @type {const} */ ({ index: 0 })
            const hidden = /** @type {const} */ ({ index: 0 })
            const fnBody = body([['define', hidden, ['array', [['ref', a]]], 'lazy']], ['return', functionTarget, ['ref', hidden]])
            const loopBody = body([['define', hidden, ['array', [['ref', a]]], 'lazy']], ['break', target, [['ref', hidden]]])
            const value = /** @type {Value} */ (['block', body([
                ['define', known, ['array', [
                    ['block', body([['define', local, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', local]]])],
                    ['function', { target: functionTarget, parameters: [], rest: null, self: null,
                        captures: [{ binding: a, value: ['block', body([['define', captured, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', captured]]])] }], body: fnBody }],
                    ['block', body([['loop', { target, parameters: [a], results: [result], body: loopBody,
                        initial: [['block', body([['define', entered, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', entered]]])]] }]], ['yield', [['ref', result]]])],
                ]], 'required'],
            ], ['yield', [['ref', known]]])])
            const plan = recipeCells(value, outer, new Map([[a, 0]]))
            assertEq(plan.localCount, 3)
            assertEq(plan.layout.cells[1].binding, local)
            assertEq(plan.layout.cells[2].binding, captured)
            assertEq(plan.layout.cells[3].binding, entered)
            const array = definitionsOf(recipeBlock(plan))[0][2]
            assert(array instanceof Array && array[0] === 'array')
            const fn = array[1][1]
            const region = array[1][2]
            assert(fn instanceof Array && fn[0] === 'function')
            assert(region instanceof Array && region[0] === 'block')
            assertEq(fn[1].body, fnBody)
            assertStructurallySame(loopsOf(region[1])[0].body, loopBody)
            assertEq(plan.layout.loops.size, 0)
        },
        loopOccurrencesKeepFreshDeclarationCells: () => {
            const outer = planned(containing(reading(a)))
            const definition = /** @type {Definition} */ (['define', b, ['array', [['ref', a]]], 'lazy'])
            const loop = loopOf(body([definition], ['break', target, [['ref', b]]]))
            const value = /** @type {Value} */ (['block', body([['loop', loop], ['loop', loop]], ['yield', [['ref', result]]])])
            const plan = recipeCells(value, outer, new Map([[a, 0]]))
            const [first, second] = loopsOf(recipeBlock(plan))
            assertEq(plan.localCount, 2)
            assertEq(plan.layout.cells[0], outer.cells[0])
            assertEq(plan.layout.cells[1].iterationLocal, true)
            assertEq(plan.layout.cells[2].iterationLocal, true)
            assert(first !== second && first !== loop && second !== loop)
            assertEq(first.target, loop.target)
            assertEq(second.target, loop.target)
            assertEq(first.parameters, loop.parameters)
            assertEq(second.results, loop.results)
            assertEq(plan.layout.loops.has(first), true)
            assertEq(plan.layout.loops.has(second), true)
            const firstDefinition = definitionsOf(first.body)[0], secondDefinition = definitionsOf(second.body)[0]
            assertEq(plan.layout.definitions.get(firstDefinition), 1)
            assertEq(plan.layout.definitions.get(secondDefinition), 2)
            assertEq(plan.layout.cells[1].definition, firstDefinition)
            assertEq(plan.layout.cells[2].definition, secondDefinition)
            assert(plan.layout.cells[1].definition !== plan.layout.cells[2].definition)
            const independent = /** @type {Value} */ (['block', body([['loop', loopOf(body([
                ['define', b, ['array', []], 'lazy'],
            ], ['break', target, [['ref', b]]]))]], ['yield', [['ref', result]]])])
            const unchanged = recipeCells(independent, outer, new Map([[a, 0]]))
            assertEq(unchanged.localCount, 0)
            assertEq(unchanged.layout.loops.size, 0)
            assertEq(unchanged.value, independent)
        },
        conditionalsAndStatementResults: () => {
            const outer = planned(containing(reading(a)))
            const left = /** @type {const} */ ({ index: 0 })
            const right = /** @type {const} */ ({ index: 0 })
            const arm = /** @type {Block} */ (body([['define', b, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', b]]]))
            for (const value of /** @type {readonly Value[]} */ ([
                ['if', false, arm, arm], ['?:', false, ['block', arm], ['block', arm]],
            ])) {
                const plan = recipeCells(value, outer, new Map([[a, 0]]))
                assertEq(plan.localCount, 2)
                assert(plan.layout.cells[1].definition !== plan.layout.cells[2].definition)
            }
            const source = /** @type {Value} */ (['block', body([
                ['block', [left], arm],
                ['if', [right], true, arm, body([], ['yield', [0]])],
                ['define', known, ['array', [['ref', left], ['ref', right]]], 'lazy'],
            ], ['yield', [['ref', known]]])])
            const plan = recipeCells(source, outer, new Map([[a, 0], [left, 0], [right, 0]]))
            assertEq(plan.localCount, 2)
            assertEq(plan.layout.definitions.has(definitionsOf(recipeBlock(plan))[0]), false)
        },
        nestedGetterBoundary: () => {
            const outer = planned(containing(reading(a)))
            const local = /** @type {const} */ ({ index: 0 })
            const initializer = /** @type {Value} */ (['block', body([
                ['define', local, ['array', [['ref', a]]], 'lazy'],
            ], ['yield', [['ref', local]]])])
            const value = /** @type {Value} */ (['block', body([['define', b, initializer, 'lazy']], ['yield', [['ref', b]]])])
            const plan = recipeCells(value, outer, new Map([[a, 0]]))
            assertEq(plan.localCount, 1)
            assertEq(plan.layout.cells[1].binding, b)
            assertEq(plan.layout.cells[1].initializer, initializer)
            const nested = recipeCells(initializer, plan.layout, new Map([[a, 0]]))
            assertEq(nested.localCount, 1)
            assertEq(nested.layout.cells[0], outer.cells[0])
            assertEq(nested.layout.cells[1], plan.layout.cells[1])
            assertEq(nested.layout.cells[2].binding, local)
            assertEq(nested.layout.cells[2].iterationLocal, false)
            assertEq(nested.layout.definitions.has(plan.layout.cells[1].definition), false)
        },
        prunedWithoutLocals: () => {
            const outer = planned(containing(reading(a)))
            const terminals = /** @type {readonly Statement[]} */ ([
                ['block', [], body([], ['throw', 'stopped'])],
                ['if', [], false, body([], ['throw', 'first']), body([], ['throw', 'second'])],
            ])
            for (const terminal of terminals) {
                const value = /** @type {Value} */ (['block', body([
                    terminal, ['define', b, ['array', [['ref', a]]], 'lazy'],
                ], ['yield', [['ref', a]]])])
                const plan = recipeCells(value, outer, new Map([[a, 0]]))
                assert(plan.value !== value)
                assertEq(plan.localCount, 0)
                assertEq(plan.layout.cells, outer.cells)
                assertEq(recipeBlock(plan).statements.length, 1)
                assertStructurallySame(recipeBlock(plan).exit, ['yield', []])
                assertEq(freeBindings(recipeBlock(plan)).length, 0)
            }
            const alreadyEmpty = /** @type {Value} */ (['block', body([terminals[0]])])
            assertEq(recipeCells(alreadyEmpty, outer, new Map([[a, 0]])).value, alreadyEmpty)
            const mixed = /** @type {Value} */ (['block', body([
                ['if', [], false, body(), body([], ['throw', 'stopped'])], ['define', b, ['array', [['ref', a]]], 'lazy'],
            ], ['yield', [['ref', b]]])])
            assertEq(recipeCells(mixed, outer, new Map([[a, 0]])).localCount, 1)
        },
        exitOperands: () => {
            const outer = planned(containing(reading(a)))
            const value = /** @type {Value} */ (['block', body([['define', b, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', b]]])])
            const exits = /** @type {readonly Exit[]} */ ([
                ['yield', [value]], ['throw', value], ['return', functionTarget, value],
                ['break', target, [value]], ['continue', target, [value]],
            ])
            for (const exit of exits) {
                const plan = recipeCells(['block', body([], exit)], outer, new Map([[a, 0]]))
                assertEq(plan.localCount, 1)
                const prepared = recipeBlock(plan).exit
                assertEq(prepared[0], exit[0])
                assert(prepared !== exit)
            }
        },
        deepOwnedRegions: () => {
            const outer = planned(containing(reading(a)))
            /** @type {Value} */
            let value = ['block', body([['define', b, ['array', [['ref', a]]], 'lazy']], ['yield', [['ref', b]]])]
            for (let depth = 0; depth < 20_000; depth += 1) { value = ['!', value] }
            assertEq(recipeCells(value, outer, new Map([[a, 0]])).localCount, 1)
        },
    },
    throw: {
        explicitNullOwnerReturn: () => memoCells(containing(loopOf(body([], ['return', functionTarget, ['ref', a]]))), [], null),
        foreignFunctionReturn: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: functionTarget.index })
            return memoCells(containing(loopOf(body([], ['return', foreign, ['ref', a]]))), [], functionTarget)
        },
        reachableForeignAfterMixedConditional: () => memoCells(containing(loopOf(body([
            ['if', [], false, body(), body([], ['throw', 'stopped'])],
        ], ['continue', innerTarget, [['ref', a]]])))),
        reachableForeignAfterYieldingBlock: () => memoCells(containing(loopOf(body([
            ['block', [], body()],
        ], ['break', innerTarget, [['ref', a]]])))),
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
        localCellOwnerReturn: () => memoCells(body([['loop', loopOf(body([
            ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
        ], ['return', functionTarget, 0]))]])),
        localCellOwnerForeignBreak: () => {
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return memoCells(body([['loop', loopOf(body([
                ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
            ], ['break', foreign, [0]]))]]))
        },
        localCellOwnerForeignContinue: () => {
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return memoCells(body([['loop', loopOf(body([
                ['define', a, ['array', []], 'lazy'], ['loop', reading(a, innerTarget)],
            ], ['continue', foreign, [0]]))]]))
        },
        nestedMemoReturn: () => memoCells(containing(loopOf(body([
            ['loop', loopOf(body([], ['return', functionTarget, ['ref', a]]), innerTarget)],
        ], ['break', target, [0]])))),
        enclosingReturn: () => memoCells(containing(loopOf(body([], ['return', functionTarget, ['ref', a]])))),
        foreignBreak: () => memoCells(containing(loopOf(body([], ['break', innerTarget, [['ref', a]]])))),
        foreignContinue: () => memoCells(containing(loopOf(body([], ['continue', innerTarget, [['ref', a]]])))),
        neutralForeignBreak: () => {
            const foreign = /** @type {const} */ ({ kind: 'loop', index: target.index })
            return memoCells(containing(loopOf(body([
                ['define', known, ['ref', a], 'required'],
                ['loop', loopOf(body([], ['break', foreign, []]), innerTarget)],
            ], ['break', target, [0]]))))
        },
        neutralSiblingContinue: () => {
            const sibling = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return memoCells(containing(loopOf(body([
                ['define', known, ['ref', a], 'required'],
                ['loop', loopOf(body([], ['break', sibling, [0]]), sibling)],
                ['loop', loopOf(body([], ['continue', sibling, []]), innerTarget)],
            ], ['break', target, [0]]))))
        },
        neutralForeignReturn: () => memoCells(containing(loopOf(body([
            ['define', known, ['ref', a], 'required'],
            ['loop', loopOf(body([], ['return', functionTarget, 0]), innerTarget)],
        ], ['break', target, [0]])))),
    },
})
