/**
 * Memo normalization keeps a caller's first-demand value across loop helpers.
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { memo } from '../../../memo/module.f.mjs'
import { toData } from '../../../value/to_unknown/module.f.mjs'
import { fromFast } from '../../module.f.mjs'
import { normalizeMemo } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Exit, statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const yielded = (value, statements = []) => body(['yield', [value]], statements)

const lazy = /** @type {const} */ ({ index: 0 })
const alias = /** @type {const} */ ({ index: 0 })
const state = /** @type {const} */ ({ index: 0 })
const output = /** @type {const} */ ({ index: 0 })
const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
const functionTarget = /** @type {const} */ ({ kind: 'function', index: 0 })

/** @type {(value: Value) => Loop} */
const counting = value => ({
    target: loopTarget, parameters: [state], initial: [0], results: [output],
    body: body(['continue', loopTarget, [ref(state)]], [
        ['if', [], ['<', ref(state), 2], body(['continue', loopTarget, [['+', ref(state), 1]]]), body(['break', loopTarget, [value]])],
    ]),
})

/** @type {(value?: Value, recipe?: Value) => Block} */
const crossing = (value = ref(lazy), recipe = ['array', []]) => yielded(['array', [ref(output), ref(lazy)]], [
    ['define', lazy, recipe, 'lazy'], ['loop', counting(value)],
])

/** @type {(block: Block) => unknown} */
const evaluate = block => assertOk(toData(assertOk(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(block)))))({ args: [] }))))

/** @type {(block: Block) => readonly (readonly [BindingId, FastFunction])[]} */
const recipesIn = block => block.statements.flatMap(statement => statement[0] === 'define'
    && statement[2] instanceof Array && statement[2][0] === 'function' ? [/** @type {const} */ ([statement[1], statement[2][1]])] : [])

export const proof = /** @type {const} */ ({
    unchanged: () => {
        const empty = yielded(1)
        assertEq(normalizeMemo(empty), empty)
        const ordinary = yielded(ref(output), [['loop', counting(2)]])
        assertEq(normalizeMemo(ordinary), ordinary)
        const later = yielded(ref(lazy), [['define', lazy, ['array', []], 'lazy'], ['loop', counting(2)]])
        assertEq(normalizeMemo(later), later)
        const primitive = crossing(ref(lazy), 4)
        assertEq(normalizeMemo(primitive), primitive)
        const established = id(0)
        const read = yielded(ref(output), [
            ['define', established, ['array', []], 'required'],
            ['define', lazy, ref(established), 'lazy'], ['loop', counting(ref(lazy))],
        ])
        assertEq(normalizeMemo(read), read)
    },
    firstDemandIdentity: () => {
        const source = crossing()
        const normalized = normalizeMemo(source)
        assert(normalized !== source)
        assertEq(normalizeMemo(normalized), normalized)
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result[0], [])
    },
    dependentReadyVector: () => {
        const dependent = id(0)
        const source = yielded(['array', [ref(output), ref(lazy), ref(dependent)]], [
            ['define', lazy, ['array', [1]], 'lazy'],
            ['define', dependent, ['array', [ref(lazy)]], 'lazy'], ['loop', counting(ref(dependent))],
        ])
        const normalized = normalizeMemo(source)
        const initial = normalized.statements[0]
        assert(initial[0] === 'define')
        assertStructurallySame(initial[2], ['array', [['array', [false, undefined]], ['array', [false, undefined]]]])
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        const recipe = recipes[1][1]
        assertEq(recipe.parameters.length, 1)
        const dependency = recipe.body.statements[0]
        assert(dependency[0] === 'if')
        assertStructurallySame(dependency[2], ['.', ['.', ref(recipe.parameters[0]), 0], 0])
        const statement = normalized.statements.find(statement => statement[0] === 'loop')
        assert(statement !== undefined && statement[0] === 'loop')
        const loop = statement[1]
        const conditional = loop.body.statements[1]
        assert(conditional[0] === 'if')
        const demand = conditional[4].statements[0]
        assert(demand[0] === 'if')
        assertStructurallySame(demand[2], ['.', ['.', ref(loop.parameters[1]), 1], 0])
        const invocation = demand[4].statements[0]
        assert(invocation[0] === 'define')
        const call = invocation[2]
        assert(call instanceof Array && call[0] === '()')
        assertStructurallySame(call[2], [ref(loop.parameters[1])])
        const exit = recipe.body.exit
        assert(exit[0] === 'return')
        assertEq(exit[1], recipe.target)
        const packet = exit[2]
        assert(packet instanceof Array && packet[0] === 'array')
        const updated = packet[1][1]
        assert(updated instanceof Array && updated[0] === 'array')
        // Initializing the dependent must retain the vector returned by its
        // dependency, including that dependency's newly ready cell.
        assertStructurallySame(updated[1][0], ['.', ref(dependency[1][1]), 0])
        const retained = updated[1][0]
        assert(retained instanceof Array && retained[0] === '.')
        const memoRead = retained[1]
        assert(memoRead instanceof Array && memoRead[0] === 'ref')
        assertEq(memoRead[1], dependency[1][1])
        assert(memoRead[1] !== recipe.parameters[0])
        assertStructurallySame(updated[1][1], ['array', [true, packet[1][0]]])
        const result = evaluate(source)
        assert(result instanceof Array && result[0] instanceof Array)
        assertEq(result[0], result[2])
        assertEq(result[0][0], result[1])
    },
    transitiveRecipeAliases: () => {
        const firstAlias = id(0), second = id(0), secondAlias = id(0), third = id(0)
        const source = yielded(['array', [ref(output), ref(third), ref(second), ref(lazy), ref(firstAlias)]], [
            ['define', lazy, ['array', [1]], 'lazy'], ['define', firstAlias, ref(lazy), 'lazy'],
            ['define', second, ['array', [ref(firstAlias)]], 'lazy'], ['define', secondAlias, ref(second), 'lazy'],
            ['define', third, ['array', [ref(secondAlias), ref(firstAlias)]], 'lazy'], ['loop', counting(ref(third))],
        ])
        const normalized = normalizeMemo(source)
        const initial = normalized.statements[0]
        assert(initial[0] === 'define')
        assertStructurallySame(initial[2], ['array', [
            ['array', [false, undefined]], ['array', [false, undefined]], ['array', [false, undefined]],
        ]])
        const result = evaluate(source)
        assert(result instanceof Array && result[0] instanceof Array && result[2] instanceof Array)
        assertEq(result[0], result[1])
        assertEq(result[0][0], result[2])
        assertEq(result[0][1], result[3])
        assertEq(result[2][0], result[3])
        assertEq(result[3], result[4])
        assertStructurallySame(result[3], [1])
    },
    conditionalDiamondGrowth: () => {
        const sizes = [4, 8, 12].map(length => {
            const cells = Array.from({ length }, () => id(0))
            const definitions = cells.map((binding, index) => /** @type {Statement} */ (['define', binding,
                index === 0 ? ['array', [0]] : ['?:', true, ['array', [ref(cells[index - 1])]], ['array', [ref(cells[index - 1])]]], 'lazy']))
            const source = yielded(ref(output), [...definitions, ['loop', counting(ref(cells[length - 1]))]])
            const normalized = normalizeMemo(source)
            const recipes = recipesIn(normalized)
            assertEq(recipes.length, length)
            for (const [, recipe] of recipes) { assertEq(recipe.parameters.length, 1) }
            return JSON.stringify(normalized).length
        })
        // Whole-vector updates grow quadratically; duplicated initializer
        // diamonds would multiply the previous recipe at every layer.
        assert(sizes[1] < sizes[0] * 5)
        assert(sizes[2] < sizes[1] * 3)
        assert(sizes[2] - sizes[1] <= 2 * (sizes[1] - sizes[0]))
    },
    conditionalRecipeDemand: () => {
        const skipped = id(0), dependent = id(0)
        for (const selected of [false, true]) {
            const successful = yielded(['array', [ref(lazy)]])
            const failed = yielded(ref(skipped))
            const initializer = /** @type {Value} */ (['if', selected,
                selected ? successful : failed, selected ? failed : successful,
            ])
            const source = yielded(['array', [ref(output), ref(dependent), ref(lazy)]], [
                ['define', lazy, ['array', [5]], 'lazy'],
                ['define', skipped, ['block', body(['throw', 'undemanded recipe'])], 'lazy'],
                ['define', dependent, initializer, 'lazy'], ['loop', counting(ref(dependent))],
            ])
            const result = evaluate(source)
            assert(result instanceof Array && result[0] instanceof Array)
            assertEq(result[0], result[1])
            assertEq(result[0][0], result[2])
            assertStructurallySame(result[2], [5])
        }
    },
    callerOwnedDependent: () => {
        const dependent = id(0), before = id(0)
        for (const early of [false, true]) {
            const source = yielded(['array', [ref(output), ref(dependent), ref(dependent), early ? ref(before) : ref(lazy)]], [
                ['define', lazy, ['array', [6]], 'lazy'], ['define', dependent, ['array', [ref(lazy)]], 'lazy'],
                ...(early ? /** @type {readonly Statement[]} */ ([['define', before, ref(dependent), 'required']]) : []),
                ['loop', counting(ref(lazy))],
            ])
            const result = evaluate(source)
            assert(result instanceof Array && result[1] instanceof Array)
            assertEq(result[1], result[2])
            assertEq(result[1][0], result[0])
            assertEq(result[3], early ? result[1] : result[0])
            assertStructurallySame(result[0], [6])
        }
    },
    recipeBlockLocalLazy: () => {
        const dependent = id(0), local = id(0)
        const initializer = /** @type {Value} */ (['block', yielded(['array', [ref(lazy), ref(local)]], [
            ['define', local, ['array', [7]], 'lazy'],
        ])])
        const source = yielded(['array', [ref(output), ref(dependent), ref(lazy)]], [
            ['define', lazy, ['array', [6]], 'lazy'], ['define', dependent, initializer, 'lazy'], ['loop', counting(ref(dependent))],
        ])
        const result = evaluate(source)
        assert(result instanceof Array && result[0] instanceof Array)
        assertEq(result[0], result[1])
        assertEq(result[0][0], result[2])
        assertStructurallySame(result[0][1], [7])
    },
    deepRecipeDependency: () => {
        const dependent = id(0)
        /** @type {Value} */
        let initializer = ref(lazy)
        // Two cells keep vector size fixed while twenty thousand recipe
        // regions exercise the demand trampoline without quadratic packets.
        for (let depth = 0; depth < 20_000; ++depth) { initializer = ['block', yielded(initializer)] }
        const source = yielded(ref(output), [
            ['define', lazy, ['array', []], 'lazy'], ['define', dependent, initializer, 'lazy'], ['loop', counting(ref(dependent))],
        ])
        const normalized = normalizeMemo(source)
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        const recipe = recipes[1][1]
        let current = recipe.body
        for (let depth = 0; depth < 20_000; ++depth) {
            const region = current.statements[0]
            assert(region[0] === 'block')
            assertEq(region[1].length, 2)
            current = region[2]
        }
        const dependency = current.statements[0]
        assert(dependency[0] === 'if')
        assertStructurallySame(dependency[2], ['.', ['.', ref(recipe.parameters[0]), 0], 0])
    },
    prerequisiteSnapshot: () => {
        const prerequisite = id(0), before = id(0)
        const source = yielded(['array', [ref(output), ref(before), ref(prerequisite)]], [
            ['define', prerequisite, ['array', [1]], 'required'], ['define', before, ref(prerequisite), 'required'],
            ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'],
            ['define', prerequisite, ['array', [2]], 'required'], ['loop', counting(ref(lazy))],
        ])
        const result = evaluate(source)
        assert(result instanceof Array && result[0] instanceof Array)
        assertEq(result[0][0], result[1])
        assert(result[1] !== result[2])
        assertStructurallySame(result[1], [1])
        assertStructurallySame(result[2], [2])
    },
    selectedDeclarationActivation: () => {
        const before = id(0)
        const source = yielded(['array', [ref(before), ref(output), ref(lazy)]], [
            ['define', lazy, 10, 'required'], ['define', before, ref(lazy), 'required'],
            ['define', lazy, ['array', [20]], 'lazy'], ['loop', counting(ref(lazy))],
        ])
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], 10)
        assertEq(result[1], result[2])
        assertStructurallySame(result[1], [20])
        const initializerShadow = yielded(ref(output), [
            ['define', lazy, 9, 'required'], ['define', lazy, ['array', [ref(lazy)]], 'lazy'], ['loop', counting(ref(lazy))],
        ])
        assertStructurallySame(evaluate(initializerShadow), [9])
    },
    aliasDeclarationActivation: () => {
        const before = id(0), saved = id(0)
        const source = yielded(['array', [ref(before), ref(output), ref(saved), ref(alias), ref(lazy)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['define', alias, 10, 'required'], ['define', before, ref(alias), 'required'],
            ['define', alias, ref(lazy), 'lazy'], ['loop', counting(ref(alias))],
            ['define', saved, ref(alias), 'required'], ['define', alias, 21, 'required'],
        ])
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], 10)
        assertEq(result[1], result[2])
        assertEq(result[1], result[4])
        assertEq(result[3], 21)
        assertStructurallySame(result[1], [5])
    },
    requiredAndLazyShadows: () => {
        for (const mode of /** @type {const} */ (['required', 'lazy'])) {
            const source = yielded(['array', [ref(output), ref(lazy)]], [
                ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))], ['define', lazy, ['array', [9]], mode],
            ])
            const result = evaluate(source)
            assert(result instanceof Array)
            assert(result[0] !== result[1])
            assertStructurallySame(result[0], [5])
            assertStructurallySame(result[1], [9])
        }
        const initializer = yielded(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))],
            ['define', lazy, ['array', [ref(lazy)]], 'required'],
        ])
        const result = evaluate(initializer)
        assert(result instanceof Array && result[1] instanceof Array)
        assertEq(result[1][0], result[0])
    },
    regionResultShadows: () => {
        const block = yielded(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))],
            ['block', [lazy], yielded(['.', ref(lazy), 0])],
        ])
        const result = evaluate(block)
        assert(result instanceof Array)
        assertStructurallySame(result[0], [5])
        assertEq(result[1], 5)
        for (const selected of [false, true]) {
            const source = yielded(['array', [ref(output), ref(lazy)]], [
                ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))],
                ['if', [lazy], selected, yielded(['+', ['.', ref(lazy), 0], 1]), yielded(['+', ['.', ref(lazy), 0], 2])],
            ])
            const value = evaluate(source)
            assert(value instanceof Array)
            assertStructurallySame(value[0], [5])
            assertEq(value[1], selected ? 6 : 7)
        }
    },
    branchShadowRestoration: () => {
        const branchResult = id(0)
        for (const selected of [false, true]) {
            const source = yielded(['array', [ref(output), ref(branchResult), ref(lazy)]], [
                ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))],
                ['if', [branchResult], selected,
                    yielded(ref(lazy), [['define', lazy, 9, 'required']]), yielded(ref(lazy))],
            ])
            const result = evaluate(source)
            assert(result instanceof Array)
            assertEq(result[0], result[2])
            assertEq(result[1], selected ? 9 : result[0])
        }
        const source = yielded(['array', [ref(output), ref(branchResult), ref(lazy)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))],
            ['block', [branchResult], yielded(ref(lazy), [['define', lazy, 9, 'required']])],
        ])
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[2])
        assertEq(result[1], 9)
    },
    loopBindingShadows: () => {
        const second = id(0), secondOutput = id(0)
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const selected = /** @type {Loop} */ ({
            target: secondTarget, parameters: [lazy], initial: [9], results: [secondOutput],
            body: body(['break', secondTarget, [['array', [ref(lazy), ref(second)]]]]),
        })
        const source = yielded(['array', [ref(output), ref(secondOutput), ref(lazy), ref(second)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['define', second, ['array', [7]], 'lazy'],
            ['loop', counting(ref(lazy))], ['loop', selected],
        ])
        const result = evaluate(source)
        assert(result instanceof Array && result[1] instanceof Array)
        assertEq(result[0], result[2])
        assertEq(result[1][0], 9)
        assertEq(result[1][1], result[3])
        const neutral = /** @type {Loop} */ ({
            target: secondTarget, parameters: [], initial: [], results: [lazy], body: body(['break', secondTarget, [11]]),
        })
        const resultShadow = yielded(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))], ['loop', neutral],
        ])
        const value = evaluate(resultShadow)
        assert(value instanceof Array)
        assertStructurallySame(value[0], [5])
        assertEq(value[1], 11)
    },
    aliasIdentity: () => {
        const source = yielded(['array', [ref(output), ref(alias), ref(lazy)]], [
            ['define', lazy, ['array', [3]], 'lazy'], ['define', alias, ref(lazy), 'lazy'], ['loop', counting(ref(alias))],
        ])
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertEq(result[1], result[2])
        assertStructurallySame(result[0], [3])
    },
    privateLoopLayout: () => {
        const second = id(0)
        const original = counting(['array', [ref(second), ref(lazy)]])
        const source = yielded(ref(output), [
            ['define', lazy, ['array', [11]], 'lazy'],
            ['define', second, ['array', [22]], 'lazy'], ['loop', original],
        ])
        const normalized = normalizeMemo(source)
        const initial = normalized.statements[0]
        assert(initial[0] === 'define')
        assertEq(initial[3], 'required')
        assertStructurallySame(initial[2], ['array', [['array', [false, undefined]], ['array', [false, undefined]]]])
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        for (const [, recipe] of recipes) { assertEq(recipe.parameters.length, 1) }
        const recipe = recipes[1][1]
        const returned = recipe.body.exit
        assert(returned[0] === 'return')
        assertEq(returned[1], recipe.target)
        const packet = returned[2]
        assert(packet instanceof Array && packet[0] === 'array')
        const ready = packet[1][1]
        assert(ready instanceof Array && ready[0] === 'array')
        assertStructurallySame(ready[1][0], ['.', ref(recipe.parameters[0]), 0])
        assertStructurallySame(ready[1][1], ['array', [true, packet[1][0]]])
        const loops = normalized.statements.flatMap(statement => statement[0] === 'loop' ? [statement[1]] : [])
        assertEq(loops.length, 1)
        const carried = loops[0]
        assert(carried.target !== original.target)
        assertEq(carried.parameters.length, 2)
        assertEq(carried.results.length, 2)
        assertStructurallySame(carried.initial, [['array', original.initial], ref(initial[1])])
        const unpacked = carried.body.statements[0]
        assert(unpacked[0] === 'define')
        assertEq(unpacked[1], state)
        assertEq(unpacked[3], 'required')
        assertStructurallySame(unpacked[2], ['.', ref(carried.parameters[0]), 0])
        const conditional = carried.body.statements[1]
        assert(conditional[0] === 'if')
        const demand = conditional[4].statements[0]
        assert(demand[0] === 'if')
        const invocation = demand[4].statements[0]
        assert(invocation[0] === 'define')
        const call = invocation[2]
        assert(call instanceof Array && call[0] === '()')
        const callee = call[1]
        assert(callee instanceof Array && callee[0] === 'ref')
        assertEq(callee[1], recipes[1][0])
        assertStructurallySame(call[2], [ref(carried.parameters[1])])
        const projection = normalized.statements.find(statement => statement[0] === 'define' && statement[1] === output)
        assert(projection !== undefined && projection[0] === 'define')
        assertEq(projection[3], 'required')
        assertStructurallySame(projection[2], ['.', ref(carried.results[0]), 0])
        // The first demand visits the second source cell; cell ordering still
        // follows declaration identities, even though every debug index is 0.
        assertStructurallySame(evaluate(source), [[22], [11]])
        assertEq(original.target, loopTarget)
        assertEq(original.parameters.length, 1)
        assertEq(original.results.length, 1)
        assertEq(original.initial[0], 0)
    },
    iterationIdentity: () => {
        const read = id(0)
        const original = counting(ref(read))
        const loop = /** @type {Loop} */ ({ ...original,
            body: { ...original.body, statements: [['define', read, ref(lazy), 'required'], ...original.body.statements] } })
        const source = yielded(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', ['once']], 'lazy'], ['loop', loop],
        ])
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result[0], ['once'])
        assertEq(loop.parameters, original.parameters)
        assertEq(loop.results, original.results)
        assertEq(loop.parameters.length, 1)
        assertEq(loop.results.length, 1)
    },
    selectedRegions: () => {
        const failed = /** @type {Value} */ (['.', null, 'x'])
        const sources = /** @type {readonly Value[]} */ ([
            ['if', false, yielded(ref(lazy)), yielded(7)],
            ['?:', false, ref(lazy), 7],
            ['block', yielded(7, [['if', [], false, body(['yield', []], [['define', alias, ref(lazy), 'required']]), body(['yield', []])]])],
        ])
        for (const value of sources) {
            const source = yielded(ref(output), [['define', lazy, failed, 'lazy'], ['loop', counting(value)]])
            assertEq(evaluate(source), 7)
        }
        const skipped = /** @type {Loop} */ ({ ...counting(ref(lazy)), results: [id(0)] })
        const block = yielded(ref(output), [
            ['define', lazy, failed, 'lazy'], ['if', [], false, body(['yield', []], [['loop', skipped]]), body(['yield', []])],
            ['define', output, 8, 'required'],
        ])
        assertEq(evaluate(block), 8)
    },
    eagerValuesAndCaptures: () => {
        const captured = id(0)
        const fn = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(lazy) }], body: body(['return', functionTarget, ref(captured)]),
        }])
        const values = /** @type {readonly Value[]} */ ([
            ['array', [ref(lazy), ref(lazy)]],
            ['object', [[':', 'first', ref(lazy)], [':', 'second', ref(lazy)]]],
            ['()', fn, []],
            ['if', true, yielded(ref(lazy)), yielded(0)],
            ['?:', true, ref(lazy), 0],
            ['if', ['===', ['.', ref(lazy), 0], 5], yielded(ref(lazy)), yielded(0)],
            ['?:', ['===', ['.', ref(lazy), 0], 5], ref(lazy), 0],
            ['block', yielded(ref(alias), [['define', alias, ref(lazy), 'required']])],
        ])
        for (const value of values) {
            const result = evaluate(crossing(value, ['array', [5]]))
            assert(result instanceof Array)
            if (value instanceof Array && value[0] === 'array') {
                assert(result[0] instanceof Array)
                assertEq(result[0][0], result[1])
                assertEq(result[0][1], result[1])
            } else if (value instanceof Array && value[0] === 'object') {
                const fields = /** @type {Readonly<Record<string, unknown>>} */ (result[0])
                assertEq(fields.first, result[1])
                assertEq(fields.second, result[1])
            } else {
                assertEq(result[0], result[1])
            }
        }
        const same = evaluate(crossing(['===', ref(lazy), ref(lazy)]))
        assert(same instanceof Array)
        assertEq(same[0], true)
    },
    operandResultSignatures: () => {
        const demanded = id(0)
        const prefix = /** @type {readonly Statement[]} */ ([['define', demanded, ref(lazy), 'required']])
        for (const length of [0, 1, 2, 3]) {
            const values = Array.from({ length }, () => ref(demanded))
            const result = evaluate(crossing(['block', body(['yield', values], prefix)], ['array', [9]]))
            assert(result instanceof Array)
            if (length === 1) { assertEq(result[0], result[1]) }
            else {
                assert(result[0] instanceof Array)
                assertEq(result[0].length, length)
                for (const value of result[0]) { assertEq(value, result[1]) }
            }
        }
        const otherDemanded = id(0)
        for (const selected of [false, true]) {
            const value = /** @type {Value} */ (['if', selected,
                body(['yield', [ref(demanded), 7]], prefix), body(['yield', []], [['define', otherDemanded, ref(lazy), 'required']]),
            ])
            const result = evaluate(crossing(value, ['array', [9]]))
            assert(result instanceof Array && result[0] instanceof Array)
            if (selected) {
                assertEq(result[0].length, 2)
                assertEq(result[0][0], result[1])
                assertEq(result[0][1], 7)
            } else { assertEq(result[0].length, 0) }
        }
    },
    operandLocalAlias: () => {
        const value = /** @type {Value} */ (['block', body(['yield', [ref(alias)]], [['define', alias, ref(lazy), 'lazy']])])
        const result = evaluate(crossing(value, ['array', ['local alias']]))
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result[0], ['local alias'])
    },
    conditionalGuardOnly: () => {
        const demanded = id(0)
        const guard = /** @type {Value} */ (['>', ['.', ref(lazy), 0], 0])
        const values = /** @type {readonly (readonly [Value, number])[]} */ ([
            [['if', guard, yielded(7), yielded(8)], 7],
            [['?:', guard, 7, 8], 7],
            [['if', false, yielded(7), yielded(8)], 8],
            [['?:', false, 7, 8], 8],
        ])
        for (const [value, expected] of values) {
            const original = counting(value)
            const loop = /** @type {Loop} */ ({ ...original,
                body: { ...original.body, statements: [['define', demanded, ref(lazy), 'required'], ...original.body.statements] } })
            const source = yielded(['array', [ref(output), ref(lazy)]], [['define', lazy, ['array', [1]], 'lazy'], ['loop', loop]])
            const result = evaluate(source)
            assert(result instanceof Array)
            assertEq(result[0], expected)
            assertStructurallySame(result[1], [1])
        }
    },
    unselectedLoopInitial: () => {
        const neutralState = id(0), neutralOutput = id(0)
        const neutralTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const stateful of [false, true]) {
            const initial = /** @type {Value} */ (stateful ? ['.', ref(lazy), 0] : 0)
            const neutral = /** @type {Loop} */ ({
                target: neutralTarget, parameters: [neutralState], initial: [initial], results: [neutralOutput],
                body: body(['break', neutralTarget, [['+', ref(neutralState), 1]]]),
            })
            const source = yielded(['array', [ref(output), ref(neutralOutput), ref(lazy)]], [
                ['define', lazy, ['array', [5]], 'lazy'], ['loop', counting(ref(lazy))], ['loop', neutral],
            ])
            const result = evaluate(source)
            assert(result instanceof Array)
            assertEq(result[0], result[2])
            assertEq(result[1], stateful ? 6 : 1)
            assertStructurallySame(result[0], [5])
        }
    },
    plainCallArgument: () => {
        const parameter = id(0)
        const identity = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [parameter], rest: null, self: null, captures: [],
            body: body(['return', functionTarget, ref(parameter)]),
        }])
        const result = evaluate(crossing(['()', identity, [ref(lazy)]]))
        assert(result instanceof Array)
        assertEq(result[0], result[1])
    },
    mixedTerminalRegions: () => {
        const demanded = id(0)
        for (const selected of [false, true]) {
            const statement = yielded(['array', [ref(output), ref(lazy)]], [
                ['define', lazy, ['array', [6]], 'lazy'],
                ['if', [], selected, body(['yield', []], [['define', demanded, ref(lazy), 'required']]), body(['throw', 'statement stop'])],
                ['loop', counting(ref(lazy))],
            ])
            const operand = crossing(['if', selected, yielded(ref(lazy)), body(['throw', 'operand stop'])], ['array', [6]])
            for (const source of [statement, operand]) {
                if (selected) {
                    const result = evaluate(source)
                    assert(result instanceof Array)
                    assertEq(result[0], result[1])
                    assertStructurallySame(result[0], [6])
                } else {
                    assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(source)))))({ args: [] })),
                        source === statement ? 'statement stop' : 'operand stop')
                }
            }
        }
    },
    unchangedAndTerminalValueBlocks: () => {
        const result = evaluate(crossing(['array', [ref(lazy), ['block', yielded(7)]]]))
        assert(result instanceof Array && result[0] instanceof Array)
        assertEq(result[0][0], result[1])
        assertEq(result[0][1], 7)
        const demanded = id(0)
        const source = crossing(['block', body(['throw', 'terminal operand'], [['define', demanded, ref(lazy), 'required']])])
        assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(source)))))({ args: [] })), 'terminal operand')
    },
    callerLoopTargets: () => {
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const source = /** @type {Block} */ ({ ...crossing(), exit: [kind, outer, [ref(lazy)]] })
            const normalized = normalizeMemo(source)
            const exit = normalized.exit
            assert(exit[0] === 'break' || exit[0] === 'continue')
            assertEq(exit[0], kind)
            assertEq(exit[1], outer)
            assertEq(exit[2].length, 1)
            const value = exit[2][0]
            assert(value instanceof Array && value[0] === 'ref')
            assert(value[1] !== lazy)
        }
    },
    statementBlockIdentity: () => {
        const pure = /** @type {Statement} */ (['block', [], body(['yield', []])])
        const local = /** @type {Statement} */ (['block', [], body(['yield', []], [['define', alias, ref(lazy), 'lazy']])])
        const source = yielded(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], pure, local, ['loop', counting(ref(lazy))],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalized.statements[2], pure)
        const region = normalized.statements[3]
        assert(region[0] === 'block')
        assertEq(region[1].length, 0)
        assertEq(region[2].statements.length, 0)
        assert(region !== local)
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
    },
    statementElseDemand: () => {
        const demanded = id(0)
        for (const selected of [false, true]) {
            const source = yielded(['array', [ref(output), ref(lazy)]], [
                ['define', lazy, ['array', [4]], 'lazy'],
                ['if', [], selected, body(['yield', []]), body(['yield', []], [['define', demanded, ref(lazy), 'required']])],
                ['loop', counting(ref(lazy))],
            ])
            const result = evaluate(source)
            assert(result instanceof Array)
            assertEq(result[0], result[1])
            assertStructurallySame(result[0], [4])
        }
    },
    callerExits: () => {
        const source = crossing()
        const returned = /** @type {Block} */ ({ ...source, exit: ['return', functionTarget, ref(lazy)] })
        const normalized = normalizeMemo(returned)
        assert(normalized.exit[0] === 'return')
        assertEq(normalized.exit[1], functionTarget)
        assertStructurallySame(evaluate(returned), [])
        const thrown = /** @type {Block} */ ({ ...crossing(ref(lazy), ['array', ['caller failure']]), exit: ['throw', ['.', ref(lazy), 0]] })
        assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(thrown)))))({ args: [] })), 'caller failure')
        const failed = yielded(ref(output), [
            ['define', lazy, ['block', body(['throw', 'initialization failure'])], 'lazy'], ['loop', counting(ref(lazy))],
        ])
        assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(failed)))))({ args: [] })), 'initialization failure')
    },
    functionBodyBoundary: () => {
        const captured = id(0), callee = id(0)
        const nestedBody = body(['return', functionTarget, ref(captured)])
        const nested = /** @type {Value} */ (['function', {
            target: functionTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(lazy) }], body: nestedBody,
        }])
        const source = yielded(['array', [ref(output), ['()', ref(callee), []]]], [
            ['define', lazy, ['array', ['capture']], 'lazy'], ['define', callee, nested, 'required'], ['loop', counting(ref(lazy))],
        ])
        const normalized = normalizeMemo(source)
        const definition = normalized.statements.find(statement => statement[0] === 'define' && statement[1] === callee)
        assert(definition !== undefined && definition[0] === 'define')
        const value = definition[2]
        assert(value instanceof Array && value[0] === 'function')
        assertEq(value[1].body, nestedBody)
        assertEq(value[1].target, functionTarget)
        assertEq(value[1].captures.length, 1)
        assertEq(value[1].captures[0].binding, captured)
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
    },
    unrelatedLazyDefinition: () => {
        const unused = id(0)
        const definition = /** @type {Statement} */ (['define', unused, ['block', body(['throw', 'undemanded'])], 'lazy'])
        const original = crossing()
        const source = /** @type {Block} */ ({ ...original, statements: [definition, ...original.statements] })
        const normalized = normalizeMemo(source)
        assertEq(normalized.statements[1], definition)
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result[0], [])
    },
    unchangedFunctionValues: () => {
        const established = id(0), captured = id(0), callee = id(0)
        for (const capture of [false, true]) {
            const nestedBody = body(['return', functionTarget, capture ? ref(captured) : 7])
            const nested = /** @type {Value} */ (['function', {
                target: functionTarget, parameters: [], rest: null, self: null,
                captures: capture ? [{ binding: captured, value: ref(established) }] : [], body: nestedBody,
            }])
            const source = yielded(['array', [ref(output), ['()', ref(callee), []], ref(lazy)]], [
                ['define', established, 7, 'required'], ['define', callee, nested, 'required'],
                ['define', lazy, ['array', []], 'lazy'], ['loop', counting(ref(lazy))],
            ])
            const normalized = normalizeMemo(source)
            const definition = normalized.statements.find(statement => statement[0] === 'define' && statement[1] === callee)
            assert(definition !== undefined && definition[0] === 'define')
            assertEq(definition[2], nested)
            assert(nested instanceof Array && nested[0] === 'function')
            assertEq(nested[1].body, nestedBody)
            const result = evaluate(source)
            assert(result instanceof Array)
            assertEq(result[0], result[2])
            assertEq(result[1], 7)
        }
    },
    deepStatementRegions: () => {
        /** @type {Block} */
        let region = body(['yield', []], [['loop', counting(ref(lazy))]])
        for (let depth = 0; depth < 20_000; ++depth) { region = body(['yield', []], [['block', [], region]]) }
        const source = yielded(0, [['define', lazy, ['array', []], 'lazy'], ['block', [], region]])
        const normalized = normalizeMemo(source)
        const outer = normalized.statements[2]
        assert(outer[0] === 'block')
        assertEq(outer[1].length, 1)
        let current = outer[2]
        for (let depth = 0; depth < 20_000; ++depth) {
            const statement = current.statements[0]
            assert(statement[0] === 'block')
            assertEq(statement[1].length, 1)
            assertEq(current.exit[0], 'yield')
            current = statement[2]
        }
        const statement = current.statements[0]
        assert(statement[0] === 'loop')
        assertEq(statement[1].parameters.length, 2)
        assertEq(statement[1].results.length, 2)
        assertEq(current.exit[0], 'yield')
    },
    throw: {
        optionalDemand: () => { normalizeMemo(crossing(['?.', ref(lazy), 'length'])) },
        optionalCallDemand: () => { normalizeMemo(crossing(['?.()', ref(lazy), []])) },
        continuedMemberDemand: () => { normalizeMemo(crossing(['.', ref(lazy), 'method', ['|()', []]])) },
        immediateMemberDemand: () => { normalizeMemo(crossing(['()', ['.', ['array', [4]], 'at'], [ref(lazy)]], ['+', 0, 0])) },
        spreadDemand: () => { normalizeMemo(crossing(['array', [['...', ref(lazy)]]])) },
        objectSpreadDemand: () => { normalizeMemo(crossing(['object', [['...', ref(lazy)]]])) },
        callSpreadDemand: () => {
            const plain = /** @type {Value} */ (['function', {
                target: functionTarget, parameters: [], rest: null, self: null, captures: [], body: body(['return', functionTarget, 0]),
            }])
            normalizeMemo(crossing(['()', plain, [['...', ref(lazy)]]]))
        },
        operandOwnedLoop: () => {
            const innerOutput = id(0)
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {Loop} */ ({
                target: innerTarget, parameters: [], initial: [], results: [innerOutput], body: body(['break', innerTarget, [ref(lazy)]]),
            })
            const source = yielded(['block', yielded(ref(innerOutput), [['loop', inner]])], [
                ['define', lazy, ['array', []], 'lazy'], ['loop', counting(ref(lazy))],
            ])
            normalizeMemo(source)
        },
        operandComputedLazyDependent: () => {
            normalizeMemo(crossing(['block', body(['yield', [ref(alias)]], [['define', alias, ['array', [ref(lazy)]], 'lazy']])]))
        },
        recipeLocalComputedLazyDependent: () => {
            const dependent = id(0), local = id(0)
            const initializer = /** @type {Value} */ (['block', yielded(ref(local), [['define', local, ['array', [ref(lazy)]], 'lazy']])])
            normalizeMemo(yielded(ref(output), [
                ['define', lazy, ['array', []], 'lazy'], ['define', dependent, initializer, 'lazy'], ['loop', counting(ref(dependent))],
            ]))
        },
        operandReturn: () => { normalizeMemo(crossing(['block', body(['return', functionTarget, ref(lazy)])])) },
        escapedReturn: () => {
            const loop = /** @type {Loop} */ ({ ...counting(ref(lazy)), body: body(['return', functionTarget, ref(lazy)]) })
            normalizeMemo(yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', loop]]))
        },
    },
})
