/**
 * Memo normalization keeps a caller's first-demand value across loop helpers.
 * @import { BindingId, Block, Definition, Exit, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { normalizeLazyReturns, normalizeMemo } from './module.f.mjs'
import { proof as deferredReturns } from '../../../edag/from_fast/lazy_returns/proof.f.mjs'
import { proof as initializerLoops } from '../../../edag/from_fast/initializer_loop_cells/proof.f.mjs'
import { _ownedLoopValue as ownedLoopValue, proof as ownedOperands } from '../../../edag/from_fast/operand_owned_demands/proof.f.mjs'
import { proof as eagerOperands } from '../../../edag/from_fast/eager_operand_memo/proof.f.mjs'
import { proof as deferredLoops } from '../../../edag/from_fast/deferred_loop_cells/proof.f.mjs'

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
const spreadCallee = /** @type {Value} */ (['function', {
    target: functionTarget, parameters: [], rest: null, self: null, captures: [], body: body(['return', functionTarget, 0]),
}])

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

/** Internally selected cells are absent from the operand's free bindings. @type {(consume: (argument: Value) => Value, initializer?: Value) => Block} */
const ownedMemoOperand = (consume, initializer = ['array', [4, 5]]) => crossing(ref(lazy), consume(ownedLoopValue(initializer)))

/** A value-owned helper can transfer only within that operand. @type {(escape: boolean) => Block} */
const initializerOperandTransfer = escape => {
    const selected = id(0), local = id(0), innerResult = id(0), operand = id(0), outerResult = id(0)
    const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
    /** @type {Value} */
    const initializer = ['block', yielded(ref(outerResult), [['loop', {
        target: outer, parameters: [], initial: [], results: [outerResult], body: body(['break', outer, [ref(operand)]], [
            ['define', local, ['array', [ref(lazy)]], 'lazy'],
            ['define', operand, ['block', yielded(ref(innerResult), [['loop', {
                target: inner, parameters: [], initial: [], results: [innerResult],
                body: body(['break', escape ? outer : inner, [ref(local)]]),
            }]])], 'required'],
        ]),
    }]])]
    return yielded(['array', [ref(output), ref(selected)]], [
        ['define', lazy, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', counting(ref(selected))],
    ])
}

/** @type {(block: Block) => unknown} */
const evaluate = block => assertOk(toData(assertOk(memo(assertOk(identityAnalysis(fromFast(normalizeMemo(block)))))({ args: [] }))))

/** @type {(block: Block) => readonly (readonly [BindingId, FastFunction])[]} */
const recipesIn = block => block.statements.flatMap(statement => statement[0] === 'define'
    && statement[2] instanceof Array && statement[2][0] === 'function' ? [/** @type {const} */ ([statement[1], statement[2][1]])] : [])

/** @type {(fn: FastFunction) => readonly Value[]} */
const readyCells = fn => {
    const exit = fn.body.exit
    assert(exit[0] === 'return')
    const packet = exit[2]
    assert(packet instanceof Array && packet[0] === 'array')
    const vector = packet[1][1]
    assert(vector instanceof Array && vector[0] === 'array')
    return vector[1].map(cell => {
        assert(!(cell instanceof Array) || cell[0] !== '...')
        // TypeScript does not exclude the readonly spread tuple after this guard.
        return /** @type {Value} */ (cell)
    })
}

/** @type {(exit: Exit, kind: 'break' | 'continue', target: LoopTarget, values: readonly BindingId[], memo: BindingId) => void} */
const loopPacket = (exit, kind, target, values, memo) => {
    assert(exit[0] === 'break' || exit[0] === 'continue')
    assertEq(exit[0], kind)
    assertEq(exit[1], target)
    assertEq(exit[2].length, 2)
    const packet = exit[2][0]
    assert(packet instanceof Array && packet[0] === 'array')
    assertEq(packet[1].length, values.length)
    for (const [index, binding] of values.entries()) {
        const value = packet[1][index]
        assert(value instanceof Array && value[0] === 'ref')
        assertEq(value[1], binding)
    }
    const current = exit[2][1]
    assert(current instanceof Array && current[0] === 'ref')
    assertEq(current[1], memo)
}

export const proof = /** @type {const} */ ({
    skippedTerminalOperandsKeepTheirOwnedMemoRegions: () => {
        const local = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {readonly Block[]} */
        const bodies = [
            body(['throw', 7]),
            body(['throw', ref(output)], [['define', local, ['array', [7]], 'lazy'], ['loop', counting(ref(local))]]),
        ]
        for (const loopBody of bodies) {
            /** @type {Value} */
            const argument = ['block', body(['loop', { target, parameters: [], initial: [], results: [], body: loopBody }])]
            const source = yielded(['?.()', null, [argument]], [
                ['define', lazy, ['array', [7]], 'lazy'], ['loop', counting(ref(lazy))],
            ])
            assertEq(evaluate(source), undefined)
        }
    },
    terminalLoopsThreadMemoWithoutNormalResults: () => {
        /** @type {Block} */
        const source = body(['loop', {
            target: loopTarget, parameters: [state], initial: [0], results: [], body: body(['continue', loopTarget, [['+', ref(state), 1]]], [
                ['if', [], ['===', ref(state), 2], body(['return', functionTarget, ['array', [ref(lazy), ref(lazy)]]]), body(['yield', []])],
            ]),
        }], [['define', lazy, ['array', [7]], 'lazy']])
        const terminalTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const terminalState = id(0)
        /** @type {readonly Block[]} */
        const cases = [source, .../** @type {const} */ ([false, true]).map(/** @returns {Block} */ initialized => body(['loop', {
            target: terminalTarget, parameters: initialized ? [terminalState] : [], initial: initialized ? [ref(lazy)] : [], results: [],
            body: body(['return', functionTarget, ['array', [ref(output), ref(output)]]]),
        }], [['define', lazy, ['array', [7]], 'lazy'], ['loop', counting(ref(lazy))]]))]
        for (const source of cases) {
            const normalized = normalizeMemo(source, [], functionTarget)
            assert(normalized.exit[0] === 'loop')
            assertEq(normalized.exit[1].results.length, 0)
            /** @type {FastFunction} */
            const fn = { target: functionTarget, parameters: [], rest: null, self: null, captures: [], body: normalized }
            const graph = fromFast(yielded(['function', fn]))
            const value = assertOk(toData(assertOk(memo(assertOk(identityAnalysis(['()', graph, []])))({ args: [] }))))
            assertStructurallySame(value, [[7], [7]])
            assert(value instanceof Array)
            assertEq(value[0], value[1])
        }
    },
    deferredReturns,
    initializerLoops,
    ownedOperands,
    eagerOperands,
    deferredLoops,
    optionalDemand: () => {
        assertStructurallySame(evaluate(crossing(['?.', ref(lazy), 'length'])), [0, []])
    },
    optionalCallDemand: () => {
        const callable = /** @type {Value} */ (['function', { target: functionTarget, parameters: [], rest: null, self: null,
            captures: [], body: body(['return', functionTarget, 4]) }])
        const source = crossing(['?.()', ref(lazy), []], callable)
        assertStructurallySame(evaluate({ ...source, exit: ['yield', [['array', [ref(output), ['===', ref(lazy), ref(lazy)]]]]] }), [4, true])
        const normalized = normalizeMemo(source)
        assertEq(readyCells(recipesIn(normalized)[0][1]).length, 1)
    },
    continuedMemberDemand: () => {
        const callable = /** @type {Value} */ (['function', { target: functionTarget, parameters: [], rest: null, self: null,
            captures: [], body: body(['return', functionTarget, 9]) }])
        const source = crossing(['.', ref(lazy), 'method', ['|()', []]], ['object', [[':', 'method', callable]]])
        assertStructurallySame(evaluate({ ...source, exit: ['yield', [['array', [ref(output), ['===', ref(lazy), ref(lazy)]]]]] }), [9, true])
    },
    immediateMemberDemand: () => {
        assertStructurallySame(evaluate(crossing(['()', ['.', ['array', [4]], 'at'], [ref(lazy)]], ['+', 0, 0])), [4, 0])
    },
    operandOwnedLoop: () => {
        const innerOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerOutput], body: body(['break', innerTarget, [ref(lazy)]]),
        })
        const operand = /** @type {Value} */ (['block', yielded(ref(innerOutput), [['loop', inner]])])
        const source = yielded(['array', [operand, ref(lazy), ref(output)]], [
            ['define', lazy, ['array', []], 'lazy'], ['loop', counting(ref(lazy))],
        ])
        const value = evaluate(source)
        assertStructurallySame(value, [[], [], []])
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    operandComputedLazyDependent: () => {
        const value = evaluate(crossing(['block', body(['yield', [ref(alias)]], [['define', alias, ['array', [ref(lazy)]], 'lazy']])]))
        assertStructurallySame(value, [[[]], []])
        assert(value instanceof Array && value[0] instanceof Array)
        assertEq(value[0][0], value[1])
    },
    borrowedOnlyRecipeAliasesKeepTheirCallerCell: () => {
        const owner = id(0)
        const value = evaluate(yielded(['array', [ref(output), ref(owner), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'],
            ['define', owner, ['block', yielded(ref(alias), [['define', alias, ref(lazy), 'lazy']])], 'lazy'],
            ['loop', counting(ref(owner))],
        ]))
        assertStructurallySame(value, [[4], [4], [4]])
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    spreadDemand: () => {
        const value = evaluate(crossing(['array', [['...', ref(lazy)]]]))
        assertStructurallySame(value, [[], []])
        assert(value instanceof Array)
        assert(value[0] !== value[1])
    },
    objectSpreadDemand: () => {
        assertStructurallySame(evaluate(crossing(['object', [['...', ref(lazy)]]])), [{}, []])
    },
    callSpreadDemand: () => {
        assertStructurallySame(evaluate(crossing(['()', spreadCallee, [['...', ref(lazy)]]])), [0, []])
    },
    operandOwnedDemandRegions: {
        optionalCall: () => {
            assertStructurallySame(evaluate(ownedMemoOperand(argument => ['?.()', null, [argument]],
                ['block', body(['throw', 'hidden operand demand'])])), [undefined, undefined])
        },
        arraySpread: () => {
            const value = evaluate(ownedMemoOperand(argument => ['array', [['...', argument]]]))
            assertStructurallySame(value, [[4, 5], [4, 5]])
            assert(value instanceof Array)
            assertEq(value[0], value[1])
        },
        callSpread: () => {
            assertStructurallySame(evaluate(ownedMemoOperand(argument => ['()', spreadCallee, [['...', argument]]])), [0, 0])
        },
        objectSpread: () => {
            const value = evaluate(ownedMemoOperand(argument => ['object', [['...', argument]]]))
            assertStructurallySame(value, [{ 0: 4, 1: 5 }, { 0: 4, 1: 5 }])
            assert(value instanceof Array)
            assertEq(value[0], value[1])
        },
        objectEntry: () => {
            const value = evaluate(ownedMemoOperand(argument => ['object', [[':', 'key', argument]]]))
            assertStructurallySame(value, [{ key: [4, 5] }, { key: [4, 5] }])
            assert(value instanceof Array)
            assertEq(value[0], value[1])
        },
    },
    initializerValueOwnedLoopKeepsItsLocalTransfer: () => {
        const result = evaluate(initializerOperandTransfer(false))
        assertStructurallySame(result, [[[4]], [[4]]])
        assert(result instanceof Array)
        assertEq(result[0], result[1])
    },
    completionOnlyEntryKeepsOrdinaryMemoIdentity: () => {
        const ordinary = crossing()
        assertEq(normalizeLazyReturns(ordinary, functionTarget), ordinary)
        const source = body(['return', functionTarget, ref(lazy)], [
            ['define', lazy, ['block', body(['return', functionTarget, 7])], 'lazy'],
        ])
        const normalized = normalizeLazyReturns(source, functionTarget)
        assert(normalized !== source)
        assertEq(normalizeLazyReturns(normalized, functionTarget), normalized)
        const value = /** @type {Value} */ (['function', { target: functionTarget, parameters: [], rest: null, self: null,
            captures: [], body: normalized }])
        assertEq(evaluate(yielded(['()', value, []])), 7)
        const crossingSource = crossing(ref(lazy), ['block', body(['return', functionTarget, 8])])
        const crossed = normalizeLazyReturns({ ...crossingSource, exit: ['return', functionTarget, ref(output)] }, functionTarget)
        assertEq(evaluate(yielded(['()', ['function', { target: functionTarget, parameters: [], rest: null, self: null,
            captures: [], body: crossed }], []])), 8)
    },
    initializerOwnedLoopReturnsToDemandingOwner: () => {
        const result = id(0)
        const local = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Value} */
        const initializer = ['block', yielded(ref(result), [['loop', {
            target: local, parameters: [], initial: [], results: [result],
            body: body(['return', functionTarget, 7]),
        }]])]
        const normalized = normalizeLazyReturns(body(['return', functionTarget, ref(lazy)], [
            ['define', lazy, initializer, 'lazy'],
        ]), functionTarget)
        const value = /** @type {Value} */ (['function', { target: functionTarget, parameters: [], rest: null, self: null,
            captures: [], body: normalized }])
        assertEq(evaluate(yielded(['()', value, []])), 7)
    },
    unrelatedConditionalKeepsItsNormalRegion: () => {
        const unaffected = /** @type {Statement} */ (['if', [], true, body(['yield', []]), body(['yield', []])])
        const original = crossing()
        /** @type {Block} */
        const source = { ...original, statements: [original.statements[0], unaffected, ...original.statements.slice(1)] }
        const normalized = normalizeMemo(source)
        const conditional = normalized.statements.find(statement => statement[0] === 'if' && statement[2] === true)
        assert(conditional !== undefined && conditional[0] === 'if')
        assertEq(conditional[1], unaffected[1])
        assertStructurallySame(conditional[3], body(['yield', []]))
        assertStructurallySame(conditional[4], body(['yield', []]))
        const result = evaluate(source)
        assert(result instanceof Array)
        assertEq(result[0], result[1])
    },
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
    recipeLocalLayout: () => {
        const owner = id(0), local = id(0), localAlias = id(0)
        const initializer = /** @type {Value} */ (['block', yielded(['array', [ref(localAlias), ref(local)]], [
            ['define', local, ['array', [ref(lazy)]], 'lazy'], ['define', localAlias, ref(local), 'lazy'],
        ])])
        const source = yielded(ref(output), [
            ['define', lazy, ['array', [4]], 'lazy'], ['define', owner, initializer, 'lazy'], ['loop', counting(ref(owner))],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const initial = normalized.statements[0]
        assert(initial[0] === 'define')
        assertStructurallySame(initial[2], ['array', [['array', [false, undefined]], ['array', [false, undefined]]]])
        const roots = recipesIn(normalized)
        assertEq(roots.length, 2)
        const recipe = roots[1][1]
        const extension = recipe.body.statements[0]
        assert(extension[0] === 'define')
        assertEq(extension[3], 'required')
        const extended = extension[2]
        assert(extended instanceof Array && extended[0] === 'array')
        assertEq(extended[1].length, 3)
        assertStructurallySame(extended[1][2], ['array', [false, undefined]])
        for (const slot of /** @type {const} */ ([0, 1])) {
            const retained = extended[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], recipe.parameters[0])
        }
        const region = recipe.body.statements[1]
        assert(region[0] === 'block')
        const locals = recipesIn(region[2])
        assertEq(locals.length, 1)
        const definition = region[2].statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[1], locals[0][0])
        assertEq(readyCells(locals[0][1]).length, 3)
        const demand = region[2].statements[1]
        assert(demand[0] === 'if')
        const ready = demand[2]
        assert(ready instanceof Array && ready[0] === '.')
        const cell = ready[1]
        assert(cell instanceof Array && cell[0] === '.')
        assertEq(cell[2], 2)
        const memo = cell[1]
        assert(memo instanceof Array && memo[0] === 'ref')
        assertEq(memo[1], extension[1])
        const invocation = demand[4].statements[0]
        assert(invocation[0] === 'define')
        const call = invocation[2]
        assert(call instanceof Array && call[0] === '()')
        const callee = call[1]
        assert(callee instanceof Array && callee[0] === 'ref')
        assertEq(callee[1], locals[0][0])
        const argument = call[2][0]
        assert(argument instanceof Array && argument[0] === 'ref')
        assertEq(argument[1], extension[1])
        const returned = readyCells(recipe)
        assertEq(returned.length, 2)
        const retained = returned[0]
        assert(retained instanceof Array && retained[0] === '.')
        const latest = retained[1]
        assert(latest instanceof Array && latest[0] === 'ref')
        assertEq(latest[1], region[1][1])
    },
    recipeLocalOuterMissRetainsTail: () => {
        const outer = id(0), owner = id(0), outerLocal = id(0), sibling = id(0), saved = id(0), observed = id(0)
        const outerInitializer = /** @type {Value} */ (['block', yielded(ref(outerLocal), [
            ['define', outerLocal, ['array', [ref(lazy)]], 'lazy'],
        ])])
        const initializer = /** @type {Value} */ (['block', yielded(['array', [ref(saved), ref(sibling), ref(outer)]], [
            ['define', sibling, ['array', [ref(lazy)]], 'lazy'],
            ['define', saved, ref(sibling), 'required'], ['define', observed, ref(outer), 'required'],
        ])])
        const source = yielded(ref(output), [
            ['define', lazy, ['array', [1]], 'lazy'], ['define', outer, outerInitializer, 'lazy'],
            ['define', owner, initializer, 'lazy'], ['loop', counting(ref(owner))],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const roots = recipesIn(normalized)
        assertEq(roots.length, 3)
        assertEq(readyCells(roots[1][1]).length, 3)
        assertEq(readyCells(roots[2][1]).length, 3)
        const outerExtension = roots[1][1].body.statements[0]
        const ownerExtension = roots[2][1].body.statements[0]
        assert(outerExtension[0] === 'define' && ownerExtension[0] === 'define')
        const outerVector = outerExtension[2]
        const ownerVector = ownerExtension[2]
        assert(outerVector instanceof Array && outerVector[0] === 'array')
        assert(ownerVector instanceof Array && ownerVector[0] === 'array')
        assertEq(outerVector[1].length, 4)
        assertEq(ownerVector[1].length, 4)
        assertStructurallySame(outerVector[1][3], ['array', [false, undefined]])
        assertStructurallySame(ownerVector[1][3], ['array', [false, undefined]])
        const region = roots[2][1].body.statements[1]
        assert(region[0] === 'block')
        const firstDemand = region[2].statements[1]
        const outerDemand = region[2].statements[3]
        assert(firstDemand[0] === 'if' && outerDemand[0] === 'if')
        const invocation = outerDemand[4].statements[0]
        assert(invocation[0] === 'define')
        const call = invocation[2]
        assert(call instanceof Array && call[0] === '()')
        const callee = call[1]
        assert(callee instanceof Array && callee[0] === 'ref')
        assertEq(callee[1], roots[1][0])
        const prefix = call[2][0]
        assert(prefix instanceof Array && prefix[0] === 'array')
        assertEq(prefix[1].length, 3)
        for (const slot of /** @type {const} */ ([0, 1, 2])) {
            const retained = prefix[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], firstDemand[1][1])
        }
        const miss = outerDemand[4].exit
        assert(miss[0] === 'yield')
        const merged = miss[1][1]
        assert(merged instanceof Array && merged[0] === 'array')
        assertEq(merged[1].length, 4)
        for (const slot of /** @type {const} */ ([0, 1, 2])) {
            const retained = merged[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const returned = retained[1]
            assert(returned instanceof Array && returned[0] === '.')
            assertEq(returned[2], 1)
            const packet = returned[1]
            assert(packet instanceof Array && packet[0] === 'ref')
            assertEq(packet[1], invocation[1])
        }
        const tail = merged[1][3]
        assert(tail instanceof Array && tail[0] === '.')
        assertEq(tail[2], 3)
        const incoming = tail[1]
        assert(incoming instanceof Array && incoming[0] === 'ref')
        assertEq(incoming[1], firstDemand[1][1])
        const reused = region[2].statements[6]
        assert(reused[0] === 'if')
        const ready = reused[2]
        assert(ready instanceof Array && ready[0] === '.')
        const cell = ready[1]
        assert(cell instanceof Array && cell[0] === '.')
        assertEq(cell[2], 3)
        const memo = cell[1]
        assert(memo instanceof Array && memo[0] === 'ref')
        assertEq(memo[1], outerDemand[1][1])
    },
    nestedRecipeLocalWidths: () => {
        const owner = id(0), local = id(0), nested = id(0)
        const nestedInitializer = /** @type {Value} */ (['block', yielded(ref(nested), [
            ['define', nested, ['array', [ref(lazy)]], 'lazy'],
        ])])
        const initializer = /** @type {Value} */ (['block', yielded(ref(local), [
            ['define', local, nestedInitializer, 'lazy'],
        ])])
        const source = yielded(ref(output), [
            ['define', lazy, ['array', [1]], 'lazy'], ['define', owner, initializer, 'lazy'], ['loop', counting(ref(owner))],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const roots = recipesIn(normalized)
        assertEq(roots.length, 2)
        const ownerRecipe = roots[1][1]
        const extension = ownerRecipe.body.statements[0]
        assert(extension[0] === 'define')
        const vector = extension[2]
        assert(vector instanceof Array && vector[0] === 'array')
        assertEq(vector[1].length, 3)
        const region = ownerRecipe.body.statements[1]
        assert(region[0] === 'block')
        const locals = recipesIn(region[2])
        assertEq(locals.length, 1)
        const localRecipe = locals[0][1]
        const localExtension = localRecipe.body.statements[0]
        assert(localExtension[0] === 'define')
        const localVector = localExtension[2]
        assert(localVector instanceof Array && localVector[0] === 'array')
        assertEq(localVector[1].length, 4)
        assertStructurallySame(localVector[1][3], ['array', [false, undefined]])
        const localRegion = localRecipe.body.statements[1]
        assert(localRegion[0] === 'block')
        const nestedRecipes = recipesIn(localRegion[2])
        assertEq(nestedRecipes.length, 1)
        assertEq(readyCells(ownerRecipe).length, 2)
        assertEq(readyCells(localRecipe).length, 3)
        assertEq(readyCells(nestedRecipes[0][1]).length, 4)
        assertEq(nestedRecipes[0][1].body.statements[0][0], 'if')
    },
    deepOwnedRecipeLocal: () => {
        const owner = id(0), local = id(0)
        /** @type {Value} */
        let initializer = ['block', yielded(ref(local), [['define', local, ['array', [ref(lazy)]], 'lazy']])]
        for (let depth = 0; depth < 20_000; depth += 1) { initializer = ['block', yielded(initializer)] }
        const source = yielded(ref(output), [
            ['define', lazy, ['array', []], 'lazy'], ['define', owner, initializer, 'lazy'], ['loop', counting(ref(owner))],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const roots = recipesIn(normalized)
        assertEq(roots.length, 2)
        const recipe = roots[1][1]
        const extension = recipe.body.statements[0]
        assert(extension[0] === 'define')
        const vector = extension[2]
        assert(vector instanceof Array && vector[0] === 'array')
        assertEq(vector[1].length, 3)
        const outer = recipe.body.statements[1]
        assert(outer[0] === 'block')
        let current = outer[2]
        for (let depth = 0; depth < 20_000; depth += 1) {
            const region = current.statements[0]
            assert(region[0] === 'block')
            assertEq(region[1].length, 2)
            current = region[2]
        }
        const locals = recipesIn(current)
        assertEq(locals.length, 1)
        assertEq(readyCells(locals[0][1]).length, 3)
        const demand = current.statements[1]
        assert(demand[0] === 'if')
        assertStructurallySame(demand[2], ['.', ['.', ref(extension[1]), 2], 0])
    },
    deepRecipeDependency: () => {
        const dependent = id(0)
        /** @type {Value} */
        let initializer = ref(lazy)
        // Two cells keep vector size fixed while twenty thousand recipe
        // regions exercise the demand trampoline without quadratic packets.
        for (let depth = 0; depth < 20_000; depth += 1) { initializer = ['block', yielded(initializer)] }
        const source = yielded(ref(output), [
            ['define', lazy, ['array', []], 'lazy'], ['define', dependent, initializer, 'lazy'], ['loop', counting(ref(dependent))],
        ])
        const normalized = normalizeMemo(source)
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        const recipe = recipes[1][1]
        let current = recipe.body
        for (let depth = 0; depth < 20_000; depth += 1) {
            const region = current.statements[0]
            assert(region[0] === 'block')
            assertEq(region[1].length, 2)
            current = region[2]
        }
        const dependency = current.statements[0]
        assert(dependency[0] === 'if')
        assertStructurallySame(dependency[2], ['.', ['.', ref(recipe.parameters[0]), 0], 0])
    },
    sharedDefinitionOccurrences: () => {
        const prerequisite = id(0), saved = id(0)
        const definition = /** @type {Definition} */ (['define', lazy, ['array', [ref(prerequisite)]], 'lazy'])
        const loop = counting(ref(lazy))
        const statement = /** @type {Statement} */ (['loop', loop])
        const source = yielded(['array', [ref(saved), ref(output)]], [
            ['define', prerequisite, 1, 'required'], definition, statement, ['define', saved, ref(output), 'required'],
            ['define', prerequisite, 2, 'required'], definition, statement,
        ])
        const normalized = normalizeMemo(source)
        const initial = normalized.statements[0]
        assert(initial[0] === 'define')
        assertStructurallySame(initial[2], ['array', [['array', [false, undefined]], ['array', [false, undefined]]]])
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        assert(recipes[0][0] !== recipes[1][0])
        assert(recipes[0][1] !== recipes[1][1])
        const loops = normalized.statements.flatMap(statement => statement[0] === 'loop' ? [statement[1]] : [])
        assertEq(loops.length, 2)
        assert(loops[0].target !== loops[1].target)
        for (let index = 0; index < loops.length; index += 1) {
            const conditional = loops[index].body.statements[1]
            assert(conditional[0] === 'if')
            const demand = conditional[4].statements[0]
            assert(demand[0] === 'if')
            assertStructurallySame(demand[2], ['.', ['.', ref(loops[index].parameters[1]), index], 0])
            const invocation = demand[4].statements[0]
            assert(invocation[0] === 'define')
            const call = invocation[2]
            assert(call instanceof Array && call[0] === '()')
            const callee = call[1]
            assert(callee instanceof Array && callee[0] === 'ref')
            assertEq(callee[1], recipes[index][0])
        }
        assertEq(source.statements[1], definition)
        assertEq(source.statements[5], definition)
        assertEq(source.statements[2], statement)
        assertEq(source.statements[6], statement)
        assertEq(loop.parameters[0], state)
    },
    sharedBlockOccurrences: () => {
        const prerequisite = id(0), regionResult = id(0), saved = id(0)
        const definition = /** @type {Definition} */ (['define', lazy, ['array', [ref(prerequisite)]], 'lazy'])
        const loop = counting(ref(lazy))
        const region = yielded(ref(output), [definition, ['loop', loop]])
        const statement = /** @type {Statement} */ (['block', [regionResult], region])
        const source = yielded(['array', [ref(saved), ref(regionResult)]], [
            ['define', prerequisite, 1, 'required'], statement, ['define', saved, ref(regionResult), 'required'],
            ['define', prerequisite, 2, 'required'], statement,
        ])
        const normalized = normalizeMemo(source)
        const regions = normalized.statements.flatMap(statement => statement[0] === 'block' ? [statement] : [])
        assertEq(regions.length, 2)
        assert(regions[0] !== regions[1])
        assert(regions[0][2] !== regions[1][2])
        const first = recipesIn(regions[0][2])
        const second = recipesIn(regions[1][2])
        assertEq(first.length, 1)
        assertEq(second.length, 1)
        assert(first[0][0] !== second[0][0])
        assert(first[0][1].target !== second[0][1].target)
        assertEq(regions[0][1][0], regionResult)
        assertEq(regions[1][1][0], regionResult)
        assertEq(source.statements[1], statement)
        assertEq(source.statements[4], statement)
        assertEq(statement[2], region)
    },
    opaqueDefinitionOccurrence: () => {
        const second = id(0)
        const definition = /** @type {Definition} */ (['define', lazy, ['array', [1]], 'lazy'])
        const initializer = /** @type {Value} */ (['block', yielded(ref(lazy), [definition])])
        const source = yielded(ref(output), [
            definition, ['loop', counting(ref(lazy))],
            ['define', second, initializer, 'lazy'], ['loop', counting(ref(second))],
        ])
        const normalized = normalizeMemo(source)
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 2)
        const recipe = recipes[1][1]
        assertEq(recipe.captures.length, 0)
        assertEq(recipe.body.statements.length, 1)
        const payload = recipe.body.statements[0]
        assert(payload[0] === 'define')
        assertEq(payload[2], initializer)
        assert(initializer instanceof Array && initializer[0] === 'block')
        assertEq(initializer[1].statements[0], definition)
        assertEq(source.statements[0], definition)
    },
    sharedNoMemoIdentity: () => {
        const definition = /** @type {Definition} */ (['define', lazy, ['array', [1]], 'lazy'])
        const loop = counting(7)
        const region = body(['yield', []], [definition, ['loop', loop]])
        const statement = /** @type {Statement} */ (['block', [], region])
        const source = yielded(0, [statement, statement])
        assertEq(normalizeMemo(source), source)
        assertEq(source.statements[0], source.statements[1])
        assertEq(statement[2], region)
        assertEq(region.statements[0], definition)
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
    nestedPacketLayout: () => {
        const innerState = id(0), innerOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [innerState], initial: [0], results: [innerOutput],
            body: body(['continue', innerTarget, [ref(innerState)]], [
                ['if', [], ['<', ref(innerState), 1], body(['continue', innerTarget, [['+', ref(innerState), 1]]]),
                    body(['break', innerTarget, [ref(lazy)]])],
            ]),
        })
        const original = counting(ref(innerOutput))
        const outer = /** @type {Loop} */ ({ ...original,
            body: { ...original.body, statements: [['loop', inner], ...original.body.statements] } })
        const source = yielded(ref(output), [['define', lazy, ['array', [7]], 'lazy'], ['loop', outer]])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const vector = normalized.statements[0]
        assert(vector[0] === 'define')
        assertStructurallySame(vector[2], ['array', [['array', [false, undefined]]]])
        assertEq(recipesIn(normalized).length, 1)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        assert(carriedOuter.target !== outer.target)
        assertEq(carriedOuter.parameters.length, 2)
        assertEq(carriedOuter.results.length, 2)
        const outerMemo = carriedOuter.initial[1]
        assert(outerMemo instanceof Array && outerMemo[0] === 'ref')
        assertEq(outerMemo[1], vector[1])
        const nested = carriedOuter.body.statements[1]
        assert(nested[0] === 'loop')
        const carriedInner = nested[1]
        assert(carriedInner.target !== inner.target)
        assert(carriedInner.target !== carriedOuter.target)
        assertEq(carriedInner.parameters.length, 2)
        assertEq(carriedInner.results.length, 2)
        const innerMemo = carriedInner.initial[1]
        assert(innerMemo instanceof Array && innerMemo[0] === 'ref')
        assertEq(innerMemo[1], carriedOuter.parameters[1])
        const innerConditional = carriedInner.body.statements[1]
        assert(innerConditional[0] === 'if')
        const demand = innerConditional[4].statements[0]
        assert(demand[0] === 'if')
        const ready = demand[2]
        assert(ready instanceof Array && ready[0] === '.')
        const cell = ready[1]
        assert(cell instanceof Array && cell[0] === '.')
        const readMemo = cell[1]
        assert(readMemo instanceof Array && readMemo[0] === 'ref')
        assertEq(readMemo[1], carriedInner.parameters[1])
        const innerContinue = innerConditional[3].exit
        assert(innerContinue[0] === 'continue')
        assertEq(innerContinue[1], carriedInner.target)
        const unchangedMemo = innerContinue[2][1]
        assert(unchangedMemo instanceof Array && unchangedMemo[0] === 'ref')
        assertEq(unchangedMemo[1], carriedInner.parameters[1])
        const innerBreak = innerConditional[4].exit
        assert(innerBreak[0] === 'break')
        assertEq(innerBreak[1], carriedInner.target)
        const demandedMemo = innerBreak[2][1]
        assert(demandedMemo instanceof Array && demandedMemo[0] === 'ref')
        assertEq(demandedMemo[1], demand[1][1])
        const projection = carriedOuter.body.statements[2]
        assert(projection[0] === 'define')
        assertEq(projection[1], innerOutput)
        assertStructurallySame(projection[2], ['.', ref(carriedInner.results[0]), 0])
        const outerConditional = carriedOuter.body.statements[3]
        assert(outerConditional[0] === 'if')
        for (const branch of /** @type {const} */ ([outerConditional[3], outerConditional[4]])) {
            const exit = branch.exit
            assert(exit[0] === 'break' || exit[0] === 'continue')
            assertEq(exit[1], carriedOuter.target)
            assertEq(exit[2].length, 2)
            const memo = exit[2][1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], carriedInner.results[1])
        }
        assertEq(outer.parameters, original.parameters)
        assertEq(outer.results, original.results)
        assertEq(inner.parameters[0], innerState)
        assertEq(inner.initial[0], 0)
        assertEq(inner.results[0], innerOutput)
        assertEq(inner.target, innerTarget)
    },
    nestedInitialDemandDependencies: () => {
        const initialCell = id(0), bodyCell = id(0), innerState = id(0), innerOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [innerState], initial: [ref(initialCell)], results: [innerOutput],
            body: body(['break', innerTarget, [['array', [ref(innerState), ref(bodyCell)]]]]),
        })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [ref(innerOutput)]], [['loop', inner]]),
        })
        const source = yielded(ref(output), [
            ['define', lazy, ['array', [1]], 'lazy'],
            ['define', initialCell, ['array', [ref(lazy)]], 'lazy'],
            ['define', bodyCell, ['array', [ref(lazy), ref(initialCell)]], 'lazy'], ['loop', outer],
        ])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const vector = normalized.statements[0]
        assert(vector[0] === 'define')
        assertStructurallySame(vector[2], ['array', [
            ['array', [false, undefined]], ['array', [false, undefined]], ['array', [false, undefined]],
        ]])
        const recipes = recipesIn(normalized)
        assertEq(recipes.length, 3)
        const statement = normalized.statements[4]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        const initialDemand = carriedOuter.body.statements[0]
        assert(initialDemand[0] === 'if')
        assertStructurallySame(initialDemand[2], ['.', ['.', ref(carriedOuter.parameters[1]), 1], 0])
        const initialInvocation = initialDemand[4].statements[0]
        assert(initialInvocation[0] === 'define')
        const initialCall = initialInvocation[2]
        assert(initialCall instanceof Array && initialCall[0] === '()')
        const initialRecipe = initialCall[1]
        assert(initialRecipe instanceof Array && initialRecipe[0] === 'ref')
        assertEq(initialRecipe[1], recipes[1][0])
        const nested = carriedOuter.body.statements[2]
        assert(nested[0] === 'loop')
        const carriedInner = nested[1]
        const initialMemo = carriedInner.initial[1]
        assert(initialMemo instanceof Array && initialMemo[0] === 'ref')
        assertEq(initialMemo[1], initialDemand[1][1])
        assert(initialMemo[1] !== carriedOuter.parameters[1])
        const eagerOperand = carriedInner.body.statements[1]
        assert(eagerOperand[0] === 'define')
        assertEq(eagerOperand[3], 'required')
        const established = eagerOperand[2]
        assert(established instanceof Array && established[0] === 'ref')
        assertEq(established[1], innerState)
        const bodyDemand = carriedInner.body.statements[2]
        assert(bodyDemand[0] === 'if')
        assertStructurallySame(bodyDemand[2], ['.', ['.', ref(carriedInner.parameters[1]), 2], 0])
        const bodyInvocation = bodyDemand[4].statements[0]
        assert(bodyInvocation[0] === 'define')
        const bodyCall = bodyInvocation[2]
        assert(bodyCall instanceof Array && bodyCall[0] === '()')
        const bodyRecipe = bodyCall[1]
        assert(bodyRecipe instanceof Array && bodyRecipe[0] === 'ref')
        assertEq(bodyRecipe[1], recipes[2][0])
        const dependencies = recipes[2][1].body.statements.filter(statement => statement[0] === 'if')
        assertEq(dependencies.length, 2)
        assertStructurallySame(dependencies[0][2], ['.', ['.', ref(recipes[2][1].parameters[0]), 0], 0])
        assertStructurallySame(dependencies[1][2], ['.', ['.', ref(dependencies[0][1][1]), 1], 0])
        const returned = recipes[2][1].body.exit
        assert(returned[0] === 'return')
        const packet = returned[2]
        assert(packet instanceof Array && packet[0] === 'array')
        const updated = packet[1][1]
        assert(updated instanceof Array && updated[0] === 'array')
        for (const slot of /** @type {const} */ ([0, 1])) {
            const retained = updated[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], dependencies[1][1][1])
        }
        const innerBreak = carriedInner.body.exit
        assert(innerBreak[0] === 'break')
        assertEq(innerBreak[1], carriedInner.target)
        const bodyMemo = innerBreak[2][1]
        assert(bodyMemo instanceof Array && bodyMemo[0] === 'ref')
        assertEq(bodyMemo[1], bodyDemand[1][1])
        const outerBreak = carriedOuter.body.exit
        assert(outerBreak[0] === 'break')
        assertEq(outerBreak[1], carriedOuter.target)
        const outputMemo = outerBreak[2][1]
        assert(outputMemo instanceof Array && outputMemo[0] === 'ref')
        assertEq(outputMemo[1], carriedInner.results[1])
    },
    ancestorTransferPackets: () => {
        const second = id(0), secondOutput = id(0), middleFirst = id(0), middleSecond = id(0)
        const middleOutput = id(0), middleOtherOutput = id(0), innerOutput = id(0), demanded = id(0)
        const middleTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerOutput],
            body: body(['yield', []], [
                ['define', demanded, ref(lazy), 'required'],
                ['if', [], true, body(['continue', loopTarget, [ref(second), ref(state)]]), body(['yield', []], [
                    ['if', [], true, body(['break', middleTarget, [ref(middleSecond), ref(middleFirst)]]),
                        body(['break', innerTarget, [ref(demanded)]])],
                ])],
            ]),
        })
        const middle = /** @type {Loop} */ ({
            target: middleTarget, parameters: [middleFirst, middleSecond], initial: [3, 4], results: [middleOutput, middleOtherOutput],
            body: body(['break', middleTarget, [ref(middleFirst), ref(middleSecond)]], [['loop', inner]]),
        })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state, second], initial: [1, 2], results: [output, secondOutput],
            body: body(['break', loopTarget, [ref(middleOutput), ref(middleOtherOutput)]], [['loop', middle]]),
        })
        const source = yielded(0, [['define', lazy, ['array', [5]], 'lazy'], ['loop', outer]])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        const middleStatement = carriedOuter.body.statements[2]
        assert(middleStatement[0] === 'loop')
        const carriedMiddle = middleStatement[1]
        const innerStatement = carriedMiddle.body.statements[2]
        assert(innerStatement[0] === 'loop')
        const carriedInner = innerStatement[1]
        for (const loop of /** @type {const} */ ([carriedOuter, carriedMiddle, carriedInner])) {
            assertEq(loop.parameters.length, 2)
            assertEq(loop.results.length, 2)
        }
        assert(carriedOuter.target !== outer.target)
        assert(carriedMiddle.target !== middle.target)
        assert(carriedInner.target !== inner.target)
        const demand = carriedInner.body.statements[0]
        assert(demand[0] === 'if')
        const conditional = carriedInner.body.statements[2]
        assert(conditional[0] === 'if')
        loopPacket(conditional[3].exit, 'continue', carriedOuter.target, [second, state], demand[1][1])
        const cases = conditional[4].statements[0]
        assert(cases[0] === 'if')
        loopPacket(cases[3].exit, 'break', carriedMiddle.target, [middleSecond, middleFirst], demand[1][1])
        loopPacket(cases[4].exit, 'break', carriedInner.target, [demanded], demand[1][1])
        loopPacket(carriedMiddle.body.exit, 'break', carriedMiddle.target, [middleFirst, middleSecond], carriedInner.results[1])
        loopPacket(carriedOuter.body.exit, 'break', carriedOuter.target, [middleOutput, middleOtherOutput], carriedMiddle.results[1])
        assertEq(outer.parameters[0], state)
        assertEq(outer.parameters[1], second)
        assertEq(outer.results[0], output)
        assertEq(outer.results[1], secondOutput)
        assertEq(middle.target, middleTarget)
        assertEq(inner.target, innerTarget)
    },
    ancestorTransferSignatures: () => {
        for (const arity of /** @type {const} */ ([0, 2])) {
            const parameters = Array.from({ length: arity }, () => id(0))
            const results = Array.from({ length: arity }, () => id(0))
            const demanded = id(0)
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {Loop} */ ({
                target: innerTarget, parameters: [], initial: [], results: [],
                body: body(['yield', []], [
                    ['define', demanded, ref(lazy), 'required'],
                    ['if', [], true, body(['continue', loopTarget, parameters.toReversed().map(ref)]),
                        body(['break', loopTarget, parameters.map(ref)])],
                ]),
            })
            const outer = /** @type {Loop} */ ({
                target: loopTarget, parameters, initial: parameters.map((_, index) => index + 1), results,
                body: body(['break', loopTarget, parameters.map(ref)], [['loop', inner]]),
            })
            const source = yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', outer]])
            const normalized = normalizeMemo(source)
            assertEq(normalizeMemo(normalized), normalized)
            const statement = normalized.statements[2]
            assert(statement[0] === 'loop')
            const carriedOuter = statement[1]
            const statePacket = carriedOuter.initial[0]
            assert(statePacket instanceof Array && statePacket[0] === 'array')
            assertEq(statePacket[1].length, arity)
            const nested = carriedOuter.body.statements[arity]
            assert(nested[0] === 'loop')
            const carriedInner = nested[1]
            const demand = carriedInner.body.statements[0]
            assert(demand[0] === 'if')
            const conditional = carriedInner.body.statements[2]
            assert(conditional[0] === 'if')
            loopPacket(conditional[3].exit, 'continue', carriedOuter.target, parameters.toReversed(), demand[1][1])
            loopPacket(conditional[4].exit, 'break', carriedOuter.target, parameters, demand[1][1])
            assertEq(outer.parameters, parameters)
            assertEq(outer.results, results)
            assertEq(outer.initial.length, arity)
        }
    },
    neutralAncestorTransferClosure: () => {
        const observed = id(0)
        const middleTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const firstTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const first = /** @type {Loop} */ ({
            target: firstTarget, parameters: [], initial: [], results: [], body: body(['continue', loopTarget, [ref(state)]]),
        })
        const second = /** @type {Loop} */ ({
            target: secondTarget, parameters: [], initial: [], results: [], body: body(['continue', middleTarget, []]),
        })
        const middle = /** @type {Loop} */ ({
            target: middleTarget, parameters: [], initial: [], results: [],
            body: body(['break', middleTarget, []], [
                ['if', [], true, body(['yield', []], [['loop', first]]), body(['yield', []], [['loop', second]])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [0], results: [output],
            body: body(['break', loopTarget, [ref(state)]], [['define', observed, ref(lazy), 'required'], ['loop', middle]]),
        })
        const source = yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', outer]])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        const demand = carriedOuter.body.statements[1]
        assert(demand[0] === 'if')
        const middleStatement = carriedOuter.body.statements[3]
        assert(middleStatement[0] === 'loop')
        const carriedMiddle = middleStatement[1]
        const middleMemo = carriedMiddle.initial[1]
        assert(middleMemo instanceof Array && middleMemo[0] === 'ref')
        assertEq(middleMemo[1], demand[1][1])
        const conditional = carriedMiddle.body.statements[0]
        assert(conditional[0] === 'if')
        assertEq(conditional[1].length, 1)
        const firstStatement = conditional[3].statements[0]
        const secondStatement = conditional[4].statements[0]
        assert(firstStatement[0] === 'loop' && secondStatement[0] === 'loop')
        const carriedFirst = firstStatement[1]
        const carriedSecond = secondStatement[1]
        for (const loop of /** @type {const} */ ([carriedMiddle, carriedFirst, carriedSecond])) {
            assertEq(loop.parameters.length, 2)
            assertEq(loop.results.length, 2)
        }
        loopPacket(carriedFirst.body.exit, 'continue', carriedOuter.target, [state], carriedFirst.parameters[1])
        loopPacket(carriedSecond.body.exit, 'continue', carriedMiddle.target, [], carriedSecond.parameters[1])
        loopPacket(carriedMiddle.body.exit, 'break', carriedMiddle.target, [], conditional[1][0])
        loopPacket(carriedOuter.body.exit, 'break', carriedOuter.target, [state], carriedMiddle.results[1])
        assertEq(first.parameters.length, 0)
        assertEq(second.results.length, 0)
        assertEq(middle.target, middleTarget)
    },
    localDeclarationResetLayout: () => {
        const local = id(0), localAlias = id(0), prerequisite = id(0), innerOutput = id(0), regionOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerOutput],
            body: body(['break', innerTarget, [ref(localAlias)]]),
        })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [0], results: [output],
            body: body(['break', loopTarget, [ref(regionOutput)]], [
                ['block', [regionOutput], yielded(ref(innerOutput), [
                    ['define', prerequisite, ['+', ref(state), 1], 'required'],
                    ['define', local, ['array', [ref(prerequisite)]], 'lazy'],
                    ['define', localAlias, ref(local), 'lazy'], ['loop', inner],
                ])],
            ]),
        })
        const source = yielded(ref(output), [['loop', outer]])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const vector = normalized.statements[0]
        assert(vector[0] === 'define')
        assertStructurallySame(vector[2], ['array', [['array', [false, undefined]]]])
        assertEq(recipesIn(normalized).length, 0)
        const statement = normalized.statements[1]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        assert(carriedOuter.target !== outer.target)
        assertEq(carriedOuter.parameters.length, 2)
        assertEq(carriedOuter.results.length, 2)
        const initialMemo = carriedOuter.initial[1]
        assert(initialMemo instanceof Array && initialMemo[0] === 'ref')
        assertEq(initialMemo[1], vector[1])
        assertEq(carriedOuter.body.statements.length, 2)
        const region = carriedOuter.body.statements[1]
        assert(region[0] === 'block')
        assertEq(region[1][0], regionOutput)
        assertEq(region[1].length, 2)
        const statements = region[2].statements
        assertEq(statements.length, 5)
        const established = statements[0]
        assert(established[0] === 'define')
        assertEq(established[1], prerequisite)
        assertEq(established[3], 'required')
        const reset = statements[1]
        assert(reset[0] === 'define')
        assertEq(reset[3], 'required')
        assertStructurallySame(reset[2], ['array', [['array', [false, undefined]]]])
        const getter = statements[2]
        assert(getter[0] === 'define')
        assertEq(getter[3], 'required')
        const value = getter[2]
        assert(value instanceof Array && value[0] === 'function')
        assertEq(value[1].parameters.length, 1)
        assertEq(value[1].captures.length, 1)
        assertEq(value[1].captures[0].binding, prerequisite)
        const captured = value[1].captures[0].value
        assert(captured instanceof Array && captured[0] === 'ref')
        assertEq(captured[1], prerequisite)
        const nested = statements[3]
        assert(nested[0] === 'loop')
        const carriedInner = nested[1]
        const innerMemo = carriedInner.initial[1]
        assert(innerMemo instanceof Array && innerMemo[0] === 'ref')
        assertEq(innerMemo[1], reset[1])
        const demand = carriedInner.body.statements[0]
        assert(demand[0] === 'if')
        const invocation = demand[4].statements[0]
        assert(invocation[0] === 'define')
        const call = invocation[2]
        assert(call instanceof Array && call[0] === '()')
        const callee = call[1]
        assert(callee instanceof Array && callee[0] === 'ref')
        assertEq(callee[1], getter[1])
        const outerExit = carriedOuter.body.exit
        assert(outerExit[0] === 'break')
        const returnedMemo = outerExit[2][1]
        assert(returnedMemo instanceof Array && returnedMemo[0] === 'ref')
        assertEq(returnedMemo[1], region[1][1])
        assertEq(outer.body.statements.length, 1)
        assertEq(inner.target, innerTarget)
    },
    localDependencyResetRetention: () => {
        const local = id(0), dependent = id(0), observedCaller = id(0), observedLocal = id(0), innerOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerOutput],
            body: body(['break', innerTarget, [ref(dependent)]]),
        })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [0], results: [output],
            body: body(['break', loopTarget, [ref(innerOutput)]], [
                ['define', observedCaller, ref(lazy), 'required'],
                ['define', local, ['array', [ref(lazy), ref(state)]], 'lazy'],
                ['define', observedLocal, ref(local), 'required'],
                ['define', dependent, ['array', [ref(local), ref(state)]], 'lazy'], ['loop', inner],
            ]),
        })
        const source = yielded(ref(output), [['define', lazy, ['array', [1]], 'lazy'], ['loop', outer]])
        const normalized = normalizeMemo(source)
        assertEq(normalizeMemo(normalized), normalized)
        const callerRecipes = recipesIn(normalized)
        assertEq(callerRecipes.length, 1)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carriedOuter = statement[1]
        const callerDemand = carriedOuter.body.statements[1]
        assert(callerDemand[0] === 'if')
        const localReset = carriedOuter.body.statements[3]
        assert(localReset[0] === 'define')
        assertEq(localReset[3], 'required')
        const resetLocal = localReset[2]
        assert(resetLocal instanceof Array && resetLocal[0] === 'array')
        assertStructurallySame(resetLocal[1][1], ['array', [false, undefined]])
        for (const slot of /** @type {const} */ ([0, 2])) {
            const retained = resetLocal[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], callerDemand[1][1])
        }
        const localRecipes = recipesIn(carriedOuter.body)
        assertEq(localRecipes.length, 2)
        const localGetter = carriedOuter.body.statements[4]
        assert(localGetter[0] === 'define')
        assertEq(localGetter[1], localRecipes[0][0])
        const localDemand = carriedOuter.body.statements[5]
        assert(localDemand[0] === 'if')
        const dependentReset = carriedOuter.body.statements[7]
        assert(dependentReset[0] === 'define')
        assertEq(dependentReset[3], 'required')
        const resetDependent = dependentReset[2]
        assert(resetDependent instanceof Array && resetDependent[0] === 'array')
        assertStructurallySame(resetDependent[1][2], ['array', [false, undefined]])
        for (const slot of /** @type {const} */ ([0, 1])) {
            const retained = resetDependent[1][slot]
            assert(retained instanceof Array && retained[0] === '.')
            assertEq(retained[2], slot)
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], localDemand[1][1])
        }
        const dependentGetter = carriedOuter.body.statements[8]
        assert(dependentGetter[0] === 'define')
        assertEq(dependentGetter[1], localRecipes[1][0])
        for (const index of /** @type {const} */ ([0, 1])) {
            const getter = localRecipes[index][1]
            assertEq(getter.parameters.length, 1)
            assertEq(getter.captures.length, 2)
            const established = getter.captures.find(capture => capture.binding === state)
            assert(established !== undefined)
            const captured = established.value
            assert(captured instanceof Array && captured[0] === 'ref')
            assertEq(captured[1], state)
            const dependency = getter.body.statements[0]
            assert(dependency[0] === 'if')
            const invocation = dependency[4].statements[0]
            assert(invocation[0] === 'define')
            const call = invocation[2]
            assert(call instanceof Array && call[0] === '()')
            const callee = call[1]
            assert(callee instanceof Array && callee[0] === 'ref')
            assertEq(callee[1], index === 0 ? callerRecipes[0][0] : localRecipes[0][0])
            const returned = getter.body.exit
            assert(returned[0] === 'return')
            const packet = returned[2]
            assert(packet instanceof Array && packet[0] === 'array')
            const ready = packet[1][1]
            assert(ready instanceof Array && ready[0] === 'array')
            const retained = ready[1][0]
            assert(retained instanceof Array && retained[0] === '.')
            const memo = retained[1]
            assert(memo instanceof Array && memo[0] === 'ref')
            assertEq(memo[1], dependency[1][1])
            assertStructurallySame(ready[1][index + 1], ['array', [true, packet[1][0]]])
        }
        const nested = carriedOuter.body.statements[9]
        assert(nested[0] === 'loop')
        const innerMemo = nested[1].initial[1]
        assert(innerMemo instanceof Array && innerMemo[0] === 'ref')
        assertEq(innerMemo[1], dependentReset[1])
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
        const unchanged = normalized.statements[2]
        assert(unchanged[0] === 'block' && pure[0] === 'block')
        assert(unchanged !== pure)
        assert(unchanged[2] !== pure[2])
        assertEq(unchanged[1], pure[1])
        assertEq(unchanged[2].exit, pure[2].exit)
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
    ownedReturnLayout: () => {
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [0], results: [output],
            body: body(['continue', loopTarget, [ref(state)]], [
                ['if', [], ['<', ref(state), 1], body(['continue', loopTarget, [['+', ref(state), 1]]]),
                    body(['yield', []], [
                        ['if', [], true, body(['return', functionTarget, ref(lazy)]), body(['break', loopTarget, [ref(lazy)]])],
                    ])],
            ]),
        })
        const source = yielded(ref(output), [['define', lazy, ['array', [5]], 'lazy'], ['loop', loop]])
        const normalized = normalizeMemo(source, [], functionTarget)
        assertEq(normalizeMemo(normalized, [], functionTarget), normalized)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carried = statement[1]
        assert(carried.target !== loop.target)
        assertEq(carried.parameters.length, 2)
        assertEq(carried.results.length, 2)
        assertStructurallySame(carried.initial[0], ['array', loop.initial])
        const conditional = carried.body.statements[1]
        assert(conditional[0] === 'if')
        const continued = conditional[3]
        assertEq(continued.statements.length, 0)
        assert(continued.exit[0] === 'continue')
        assertEq(continued.exit[1], carried.target)
        assertEq(continued.exit[2].length, 2)
        const continuingMemo = continued.exit[2][1]
        assert(continuingMemo instanceof Array && continuingMemo[0] === 'ref')
        assertEq(continuingMemo[1], carried.parameters[1])
        const exits = conditional[4].statements[0]
        assert(exits[0] === 'if')
        const returned = exits[3]
        assertEq(returned.statements.length, 2)
        const returnDemand = returned.statements[0]
        assert(returnDemand[0] === 'if')
        const stableReturn = returned.statements[1]
        assert(stableReturn[0] === 'define')
        assertEq(stableReturn[3], 'required')
        const demanded = stableReturn[2]
        assert(demanded instanceof Array && demanded[0] === 'ref')
        assertEq(demanded[1], returnDemand[1][0])
        assert(returned.exit[0] === 'return')
        assertEq(returned.exit[1], functionTarget)
        const payload = returned.exit[2]
        assert(payload instanceof Array && payload[0] === 'ref')
        assertEq(payload[1], stableReturn[1])
        const broken = exits[4]
        const breakDemand = broken.statements[0]
        assert(breakDemand[0] === 'if')
        const stableBreak = broken.statements[1]
        assert(stableBreak[0] === 'define')
        assertEq(stableBreak[3], 'required')
        assert(broken.exit[0] === 'break')
        assertEq(broken.exit[1], carried.target)
        assertEq(broken.exit[2].length, 2)
        const values = broken.exit[2][0]
        assert(values instanceof Array && values[0] === 'array')
        assertEq(values[1].length, 1)
        const result = values[1][0]
        assert(result instanceof Array && result[0] === 'ref')
        assertEq(result[1], stableBreak[1])
        const breakingMemo = broken.exit[2][1]
        assert(breakingMemo instanceof Array && breakingMemo[0] === 'ref')
        assertEq(breakingMemo[1], breakDemand[1][1])
        assertEq(loop.parameters[0], state)
        assertEq(loop.initial[0], 0)
        assertEq(loop.results[0], output)
    },
    ownedReturnExitIdentity: () => {
        const observed = id(0)
        const exit = /** @type {Exit} */ (['return', functionTarget, ref(state)])
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [3], results: [output],
            body: body(exit, [['define', observed, ref(lazy), 'required']]),
        })
        const source = yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', loop]])
        const normalized = normalizeMemo(source, [], functionTarget)
        const statement = normalized.statements[2]
        assert(statement[0] === 'loop')
        const carried = statement[1]
        assertEq(carried.body.statements.length, 3)
        const demand = carried.body.statements[1]
        assert(demand[0] === 'if')
        const required = carried.body.statements[2]
        assert(required[0] === 'define')
        assertEq(required[1], observed)
        assertEq(required[3], 'required')
        const value = required[2]
        assert(value instanceof Array && value[0] === 'ref')
        assertEq(value[1], demand[1][0])
        assertEq(carried.body.exit, exit)
        assertEq(loop.body.exit, exit)
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
        const unchanged = normalized.statements[1]
        assert(unchanged[0] === 'define' && definition[0] === 'define')
        assert(unchanged !== definition)
        assertEq(unchanged[1], definition[1])
        assertEq(unchanged[2], definition[2])
        assertEq(unchanged[3], definition[3])
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
        for (let depth = 0; depth < 20_000; depth += 1) { region = body(['yield', []], [['block', [], region]]) }
        const source = yielded(0, [['define', lazy, ['array', []], 'lazy'], ['block', [], region]])
        const normalized = normalizeMemo(source)
        const outer = normalized.statements[2]
        assert(outer[0] === 'block')
        assertEq(outer[1].length, 1)
        let current = outer[2]
        for (let depth = 0; depth < 20_000; depth += 1) {
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
    deepOperandOwnedRegions: () => {
        /** @type {Value} */
        let argument = ownedLoopValue(['array', [4, 5]])
        for (let depth = 0; depth < 20_000; depth += 1) { argument = ['block', yielded(argument)] }
        const source = crossing(ref(lazy), ['?.()', null, [argument]])
        assert(normalizeMemo(source) !== source)
    },
    throw: {
        initializerOperandCannotTransferToContainingLoop: () => evaluate(initializerOperandTransfer(true)),
        deferredSpreadCalleeBoundary: () => normalizeLazyReturns(body(['return', functionTarget,
            ['()', [',', []], [['...', ref(lazy)]]],
        ], [['define', lazy, ['block', body(['return', functionTarget, 7])], 'lazy']]), functionTarget),
        operandReturn: () => { normalizeMemo(crossing(['block', body(['return', functionTarget, ref(lazy)])])) },
        ownedOperandReturn: () => { normalizeMemo(crossing(['block', body(['return', functionTarget, ref(lazy)])]), [], functionTarget) },
        ownedForeignReturn: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const loop = /** @type {Loop} */ ({ ...counting(ref(lazy)), body: body(['return', foreign, ref(lazy)]) })
            normalizeMemo(yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', loop]]), [], functionTarget)
        },
        foreignLoopBreak: () => {
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const observed = id(0)
            const loop = /** @type {Loop} */ ({ ...counting(0), body: body(['break', foreign, []], [['define', observed, ref(lazy), 'required']]) })
            normalizeMemo(yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', loop]]))
        },
        siblingLoopContinue: () => {
            const siblingTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const observed = id(0)
            const sibling = /** @type {Loop} */ ({
                target: siblingTarget, parameters: [], initial: [], results: [], body: body(['break', siblingTarget, []]),
            })
            const loop = /** @type {Loop} */ ({ ...counting(0), body: body(['continue', siblingTarget, []], [['define', observed, ref(lazy), 'required']]) })
            normalizeMemo(yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', sibling], ['loop', loop]]))
        },
        operandLoopBreak: () => { normalizeMemo(crossing(['block', body(['break', loopTarget, [ref(lazy)]])])) },
        operandLoopContinue: () => { normalizeMemo(crossing(['block', body(['continue', loopTarget, [ref(lazy)]])])) },
        escapedReturn: () => {
            const loop = /** @type {Loop} */ ({ ...counting(ref(lazy)), body: body(['return', functionTarget, ref(lazy)]) })
            normalizeMemo(yielded(0, [['define', lazy, ['array', []], 'lazy'], ['loop', loop]]))
        },
    },
})
