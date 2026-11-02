/**
 * Selected results converge once; required work, allocations and terminal
 * paths retain their regions. Demand barriers use the shared graph query.
 *
 * @import { BindingId, Block, Exit, Function as FastFunction, Statement, Value } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _joinResults } from './module.f.mjs'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { memo } from '../../memo/module.f.mjs'
import { toData } from '../../value/to_unknown/module.f.mjs'
import { parse } from '../../../compiler/transpiler/module.f.mjs'
import { unresolved, _defaultExport } from '../../../compiler/edag/module.f.mjs'
import { tryModuleStringify } from '../../../compiler/serializer/module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const result = (value, statements = []) => ({ statements, exit: ['yield', [value]] })
/** @type {(statements?: readonly Statement[]) => Block} */
const normal = (statements = []) => ({ statements, exit: ['yield', []] })
/** @type {(test: Value, left: Value, right?: Value) => Value} */
const selected = (test, left, right = 1) => ['if', test, result(left), result(right)]
/** @type {(test: Value, value: Value, left?: Block, right?: Block, prefix?: readonly Statement[], exit?: (value: Value) => Exit) => Block} */
const source = (test, value, left = normal(), right = normal(), prefix = [], exit = value => ['yield', [value]]) => ({
    statements: [...prefix, ['if', [], test, left, right]], exit: exit(value),
})
/** @type {(block: Block) => Extract<Statement, readonly ['if', ...unknown[]]>} */
const branchOf = block => /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (block.statements.at(-1))
const parseModule = parse('/join.f.js')
/** @type {(text: string) => import('../../types.ts').Exp} */
const moduleGraph = text => unresolved(assertOk(parseModule(text))).edag
/** @type {(message: string) => Value} */
const fail = message => ['block', { statements: [], exit: ['throw', message] }]
/** @type {(block: Block, parameter: BindingId, argument: boolean) => import('../../../types/result/types.ts').Result<import('../../value/types.ts').EdagValue, import('../../value/types.ts').EdagValue>} */
const evaluate = (block, parameter, argument) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const fn = /** @type {FastFunction} */ ({ target: owner, parameters: [parameter], rest: null, self: null, captures: [], body: { statements: block.statements, exit: ['return', owner, block.exit[0] === 'yield' ? block.exit[1][0] : undefined] } })
    const graph = fromFast(result(['function', fn]))
    return memo(assertOk(identityAnalysis(['()', graph, [argument]])))({ args: [] })
}

export const proof = /** @type {const} */ ({
    nestedExclusiveDemandsLocalizeDependentsBeforeTheirPrerequisites: () => {
        const condition = id(0), first = id(1), second = id(2), third = id(3), checked = id(4), tag = id(5)
        const observed = id(6), inner = id(7), chosen = id(8), capture = id(9)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const allocation = /** @type {Value} */ (['array', [7]])
        const call = /** @type {Value} */ (['()', ['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ref(first) }], body: { statements: [], exit: ['return', owner, ['array', [ref(capture), ref(capture)]]] } }], []])
        const expansion = /** @type {Value} */ (['array', [['...', ref(second)]]])
        const before = result(['array', [ref(chosen), ref(observed)]], [
            ['define', first, allocation, 'lazy'], ['define', second, call, 'lazy'], ['define', third, expansion, 'lazy'],
            ['define', checked, ['.', ref(first), 0], 'required'],
            ['if', [observed], ref(condition), result(undefined), {
                statements: [
                    ['define', tag, ['.', ref(second), 0], 'required'],
                    ['if', [inner], ['===', ref(checked), 7], result(ref(third)), result(0)],
                ], exit: ['yield', [ref(inner)]],
            }],
            ['define', chosen, selected(ref(condition), 0, ref(second)), 'required'],
        ])
        const after = _joinResults(before)
        const established = after.statements[0]
        assert(established[0] === 'define')
        assertEq(established[1], first)
        assertEq(established[2], allocation)
        assertEq(established[3], 'required')
        const outer = after.statements[2]
        assert(outer[0] === 'if')
        const invoked = outer[4].statements[0]
        assert(invoked[0] === 'define')
        assertEq(invoked[1], second)
        assertEq(invoked[2], call)
        assertEq(invoked[3], 'required')
        const nested = outer[4].statements[2]
        assert(nested[0] === 'if')
        const expanded = nested[3].statements[0]
        assert(expanded[0] === 'define')
        assertEq(expanded[1], third)
        assertEq(expanded[2], expansion)
        assertEq(expanded[3], 'required')
        for (const block of [before, after]) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, true)))), [0, undefined])
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, false)))), [[[7], [7]], [[7], [7]]])
        }
    },
    conditionalDependentsKeepSkippedInitializersUnevaluated: () => {
        const condition = id(0), prerequisite = id(1), dependent = id(2)
        const before = source(ref(condition), ['array', [selected(ref(condition), 7, 0), ref(dependent)]], normal(), normal(), [
            ['define', prerequisite, fail('selected'), 'lazy'],
            ['define', dependent, selected(ref(condition), ref(prerequisite), 0), 'lazy'],
        ])
        const after = _joinResults(before)
        for (const block of [before, after]) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, false)))), [0, 0])
            assertEq(assertError(evaluate(block, condition, true)), 'selected')
        }
    },
    recursiveDemandsKeepTheOuterMemoAcrossLoopIterations: () => {
        const condition = id(0), cell = id(1), step = id(2), previous = id(3), pair = id(4), chosen = id(5)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const deferred = /** @type {Statement} */ (['define', cell, ['array', [7]], 'lazy'])
        const before = result(['array', [ref(chosen), ['===', ['.', ref(pair), 0], ['.', ref(pair), 1]]]], [
            deferred,
            ['loop', { target, parameters: [step, previous], initial: [0, null], results: [pair], body: {
                statements: [['if', [], ['<', ref(step), 2], { statements: [], exit: ['continue', target, [['+', ref(step), 1], ref(cell)]] }, normal()]],
                exit: ['break', target, [['array', [ref(previous), ref(cell)]]]],
            } }],
            ['if', [], ref(condition), normal(), normal()],
            ['define', chosen, selected(ref(condition), 7, 0), 'required'],
        ])
        const after = _joinResults(before)
        assertEq(after.statements[0], deferred)
        for (const block of [before, after]) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, true)))), [7, true])
        }
    },
    laterRecipeNameShadowsKeepTheirOwnDeclarationValues: () => {
        const condition = id(0), cell = id(1), chosen = id(2), used = id(3)
        const deferred = /** @type {Statement} */ (['define', cell, ['array', [9]], 'lazy'])
        const shadow = /** @type {Statement} */ (['define', cell, 3, 'required'])
        const consumer = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 7, 0), 'required'])
        /** @type {readonly Block[]} */
        const cases = [
            result(['array', [ref(chosen), ref(cell)]], [deferred, shadow, ['if', [], ref(condition), normal(), normal()], consumer]),
            result(['array', [ref(chosen), ref(used)]], [deferred, shadow, ['if', [used], ref(condition), result(ref(cell)), result(0)], consumer]),
            result(ref(chosen), [['define', cell, selected(ref(condition), 7, 0), 'lazy'], shadow,
                ['if', [], ref(condition), normal(), normal()], ['define', chosen, ref(cell), 'required']]),
        ]
        for (const [index, before] of cases.entries()) {
            const after = _joinResults(before)
            const expected = index === 2 ? 3 : [7, 3]
            assertStructurallySame(assertOk(toData(assertOk(evaluate(before, condition, true)))), expected)
            assertStructurallySame(assertOk(toData(assertOk(evaluate(after, condition, true)))), expected)
        }
    },
    exclusiveRecoveryDoesNotAdvancePastEarlierTestOrArmWork: () => {
        const condition = id(0), cell = id(1), local = id(2), chosen = id(3)
        const deferred = /** @type {Statement} */ (['define', cell, fail('later'), 'lazy'])
        const decision = /** @type {Statement} */ (['if', [], ref(condition), normal(), normal()])
        const consumer = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 7, 0), 'required'])
        /** @type {readonly Block[]} */
        const cases = [
            result(ref(chosen), [deferred, ['if', [], ['===', fail('earlier'), ref(cell)], normal(), normal()], decision, consumer]),
            result(ref(chosen), [deferred, ['if', [], ref(condition), normal([
                ['define', local, ['array', [fail('earlier'), ref(cell)]], 'required'],
            ]), normal()], decision, consumer]),
        ]
        for (const [index, before] of cases.entries()) {
            const after = _joinResults(before)
            assert(after.statements.includes(deferred))
            for (const block of [before, after]) {
                assertEq(assertError(evaluate(block, condition, true)), 'earlier')
                if (index === 1) { assertEq(assertOk(toData(assertOk(evaluate(block, condition, false)))), 0) }
            }
        }
    },
    adjacentRequiredInitializersKeepOneConditionallyDemandedRecipe: () => {
        const condition = id(0), cell = id(1), chosen = id(2), kept = id(3), later = id(4)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const call = /** @type {Value} */ (['()', ['function', { target: owner, parameters: [], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['return', owner, ['array', [7]]] } }], []])
        const prefix = /** @type {Statement} */ (['define', kept, 3, 'required'])
        const consumer = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 9, ref(cell)), 'required'])
        const following = /** @type {Statement} */ (['define', later, ['array', [ref(chosen), ref(chosen)]], 'required'])
        const branch = /** @type {Statement} */ (['if', [], ref(condition), normal(), normal([
            ['if', [], ['===', ['.', ref(cell), 0], 0], { statements: [], exit: ['throw', 8] }, normal()],
        ])])
        const before = result(ref(later), [prefix, ['define', cell, call, 'lazy'], branch, consumer, following])
        const after = _joinResults(before)
        assertEq(after.statements.length, 4)
        assertEq(after.statements[0], prefix)
        assertEq(after.statements[3], following)
        const joined = after.statements[1]
        assert(joined[0] === 'if')
        assertEq(joined[1].length, 1)
        assertEq(joined[3].statements.length, 0)
        const established = joined[4].statements[0]
        assert(established[0] === 'define')
        assertEq(established[1], cell)
        assertEq(established[2], call)
        assertEq(established[3], 'required')
        for (const block of [before, after]) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, true)))), [9, 9])
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, false)))), [[7], [7]])
        }
    },
    requiredInitializerJoinsKeepAbruptOwnersAndExistingResults: () => {
        const condition = id(0), kept = id(1), chosen = id(2)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {readonly Exit[]} */
        const exits = [['throw', 7], ['return', owner, 7], ['break', target, [7]], ['continue', target, [7]]]
        for (const exit of exits) {
            const left = /** @type {Block} */ ({ statements: [], exit })
            const before = result(ref(chosen), [
                ['if', [kept], ref(condition), left, { statements: [], exit: ['yield', [3]] }],
                ['define', chosen, selected(ref(condition), fail('unreached'), 9), 'required'],
            ])
            const after = _joinResults(before)
            const branch = after.statements[0]
            assert(branch[0] === 'if')
            assertEq(branch[1].length, 2)
            assertEq(branch[1][0], kept)
            assertStructurallySame(branch[3], left)
            assertEq(branch[3].exit, exit)
            assert(branch[4].exit[0] === 'yield')
            assertEq(branch[4].exit[1].length, 2)
        }
    },
    requiredInitializerJoinsKeepEarlierWorkAndInterveningScopes: () => {
        const condition = id(0), other = id(0), local = id(1), chosen = id(2)
        const call = /** @type {Value} */ (['()', ref(other), []])
        const branch = /** @type {Statement} */ (['if', [], ref(condition), normal(), normal()])
        /** @type {readonly Block[]} */
        const cases = [
            result(ref(chosen), [branch, ['define', chosen, selected(ref(other), 7), 'required']]),
            result(ref(chosen), [branch, ['define', chosen, ['array', [call, selected(ref(condition), 7)]], 'required']]),
            result(ref(chosen), [branch, ['define', local, call, 'lazy'], ['define', chosen, selected(ref(condition), ref(local), ref(local)), 'required']]),
            result(ref(chosen), [branch, ['block', [], normal()], ['define', chosen, selected(ref(condition), 7), 'required']]),
            result(ref(chosen), [['if', [local], ref(condition), { statements: [], exit: ['yield', [7]] }, { statements: [], exit: ['yield', [9]] }],
                ['define', chosen, selected(ref(condition), ref(local), ref(local)), 'required']]),
        ]
        for (const before of cases) { assertStructurallySame(_joinResults(before), before) }
    },
    repeatedTestsKeepTheValueAfterAResultShadowsTheirBinding: () => {
        const condition = id(0), chosen = id(1)
        const prefix = /** @type {Statement} */ (['define', condition, true, 'required'])
        const branch = /** @type {Statement} */ (['if', [condition], ref(condition), { statements: [], exit: ['yield', [false]] }, { statements: [], exit: ['yield', [true]] }])
        const value = selected(ref(condition), 7, 9)
        const terminal = result(value, [prefix, branch])
        const initializer = result(ref(chosen), [prefix, branch, ['define', chosen, value, 'required']])
        for (const before of [terminal, initializer]) {
            const after = _joinResults(before)
            assertStructurallySame(after, before)
            assertEq(assertOk(toData(assertOk(evaluate(before, condition, false)))), 9)
            assertEq(assertOk(toData(assertOk(evaluate(after, condition, false)))), 9)
        }
    },
    selectedValuesAndDeferredCapturesKeepTheirOuterArmScope: () => {
        const condition = id(0), outer = id(1), chosen = id(2), recipe = id(3), capture = id(4)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        /** @type {readonly Statement[]} */
        const shadows = [
            ['define', outer, 7, 'required'],
            ['block', [outer], { statements: [], exit: ['yield', [7]] }],
            ['if', [outer], true, result(7), result(8)],
            ['loop', { target, parameters: [], initial: [], results: [outer], body: { statements: [], exit: ['break', target, [7]] } }],
        ]
        const closure = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ref(outer) }], body: { statements: [], exit: ['return', owner, ref(capture)] } }])
        for (const declaration of shadows) {
            for (const deferred of [false, true]) {
                const value = deferred ? ref(recipe) : ref(outer)
                const prefix = /** @type {readonly Statement[]} */ ([['define', outer, 9, 'required'],
                    ...deferred ? /** @type {readonly Statement[]} */ ([['define', recipe, ['array', [ref(outer)]], 'lazy']]) : []])
                for (const left of [false, true]) {
                    const branch = /** @type {Statement} */ (['if', [], ref(condition), left ? normal([declaration]) : normal(), left ? normal() : normal([declaration])])
                    const choice = left ? selected(ref(condition), value, 0) : selected(ref(condition), 0, value)
                    const terminal = result(choice, [...prefix, branch])
                    const initializer = result(ref(chosen), [...prefix, branch, ['define', chosen, choice, 'required']])
                    const deferredChoice = result(ref(chosen), [...prefix, ['define', chosen, choice, 'lazy'], branch])
                    for (const before of [terminal, initializer, deferredChoice]) {
                        const after = _joinResults(before)
                        assertStructurallySame(after, before)
                        const expected = deferred ? [9] : 9
                        assertStructurallySame(assertOk(toData(assertOk(evaluate(before, condition, left)))), expected)
                        assertStructurallySame(assertOk(toData(assertOk(evaluate(after, condition, left)))), expected)
                    }
                }
            }
        }
        const before = result(['()', ref(chosen), []], [
            ['define', outer, 9, 'required'],
            ['if', [], ref(condition), normal([shadows[0]]), normal()],
            ['define', chosen, selected(ref(condition), closure, closure), 'required'],
        ])
        const after = _joinResults(before)
        assertStructurallySame(after, before)
        assertEq(assertOk(toData(assertOk(evaluate(after, condition, true)))), 9)
    },
    localizedRecipesKeepTheBindingValuesAtTheirDeclaration: () => {
        const condition = id(0), outer = id(1), recipe = id(2), chosen = id(3), used = id(4)
        const deferred = /** @type {Statement} */ (['define', recipe, ['array', [ref(outer)]], 'lazy'])
        const prefix = /** @type {Statement} */ (['define', outer, 9, 'required'])
        const choice = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 7, 0), 'required'])
        /** @type {readonly Block[]} */
        const cases = [
            result(['array', [ref(chosen), ref(recipe)]], [prefix, deferred,
                ['if', [outer], ref(condition), result(3), result(4)], choice]),
            result(['array', [ref(chosen), ref(recipe)]], [prefix, deferred, ['define', outer, 3, 'required'],
                ['if', [], ref(condition), normal(), normal()], choice]),
            result(['array', [ref(chosen), ref(used)]], [prefix, deferred,
                ['if', [used], ref(condition), result(ref(recipe), [['define', outer, 3, 'required']]), result(0)], choice]),
            result(['array', [ref(chosen), ref(used)]], [prefix, deferred, ['define', outer, 3, 'required'],
                ['if', [used], ref(condition), result(ref(recipe)), result(0)], choice]),
        ]
        for (const before of cases) {
            const after = _joinResults(before)
            assertEq(after.statements[1], deferred)
            for (const block of [before, after]) {
                assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, true)))), [7, [9]])
            }
        }
    },
    dependentRecipesDoNotCrossReboundPrefixValues: () => {
        const condition = id(0), outer = id(1), selectedValue = id(2), dependent = id(3), chosen = id(4)
        const prefix = /** @type {Statement} */ (['define', outer, 9, 'required'])
        const recipe = /** @type {Statement} */ (['define', selectedValue, selected(ref(condition), 2, 3), 'lazy'])
        const following = /** @type {Statement} */ (['define', dependent, ['array', [ref(selectedValue), ref(outer)]], 'lazy'])
        const consumer = /** @type {Statement} */ (['define', chosen, ref(dependent), 'required'])
        /** @type {readonly Block[]} */
        const cases = [
            result(ref(chosen), [prefix, recipe, following, ['if', [outer], ref(condition), result(4), result(5)], consumer]),
            result(ref(chosen), [prefix, recipe, following, ['define', outer, 4, 'required'], ['if', [], ref(condition), normal(), normal()], consumer]),
            result(ref(chosen), [prefix, ['define', selectedValue, selected(ref(condition), ref(outer), 3), 'lazy'],
                ['define', outer, 4, 'required'], ['if', [], ref(condition), normal(), normal()], ['define', chosen, ref(selectedValue), 'required']]),
            result(ref(chosen), [prefix, ['define', selectedValue, 11, 'required'], following, recipe,
                ['if', [], ref(condition), normal(), normal()], consumer]),
        ]
        for (const [index, before] of cases.entries()) {
            const after = _joinResults(before)
            assertStructurallySame(after, before)
            const expected = index === 2 ? 9 : [index === 3 ? 11 : 2, 9]
            assertStructurallySame(assertOk(toData(assertOk(evaluate(before, condition, true)))), expected)
            assertStructurallySame(assertOk(toData(assertOk(evaluate(after, condition, true)))), expected)
        }
    },
    laterDeclarationsDoNotCaptureEarlierBindingReads: () => {
        const condition = id(0), outer = id(1), chosen = id(2), earlier = id(3)
        const prefix = /** @type {Statement} */ (['define', outer, 9, 'required'])
        const deferred = /** @type {Statement} */ (['define', outer, 3, 'lazy'])
        const consumer = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 7, 0), 'required'])
        /** @type {readonly Block[]} */
        const cases = [
            result(['array', [ref(chosen), ref(earlier)]], [prefix,
                ['if', [earlier], ref(condition), result(ref(outer)), result(0)], consumer, deferred]),
            result(['array', [ref(chosen), ref(earlier)]], [prefix, ['define', earlier, ref(outer), 'required'], deferred,
                ['if', [], ref(condition), normal(), normal()], consumer]),
        ]
        for (const before of cases) {
            const after = _joinResults(before)
            for (const block of [before, after]) {
                assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, true)))), [7, 9])
            }
            assert(after.statements.includes(deferred))
        }
    },
    terminalLoopKeepsItsInternalNormalJoin: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const condition = id(0), parameter = id(1)
        const branch = source(ref(condition), ['+', selected(ref(condition), 2, 3), ref(parameter)])
        assert(branch.exit[0] === 'yield')
        /** @type {Block} */
        const terminal = { statements: [], exit: ['loop', { target, parameters: [parameter], initial: [0], results: [],
            body: { statements: branch.statements, exit: ['continue', target, branch.exit[1]] } }] }
        const after = _joinResults(terminal)
        assert(after.exit[0] === 'loop')
        assertEq(after.statements.length, 0)
        assertEq(after.exit[1].target, target)
        const joined = after.exit[1].body.statements[0]
        assert(joined[0] === 'if')
        assertEq(joined[1].length, 1)
        assertEq(after.exit[1].body.exit[0], 'continue')
    },
    normalResultsRetainOneContinuationAndAllocation: () => {
        const condition = id(0), value = id(1), input = id(2)
        const allocation = /** @type {Value} */ (['array', [7]])
        const payload = /** @type {Value} */ (['array', [ref(input), selected(ref(condition), ['.', ref(value), 0])]])
        const before = source(ref(condition), payload,
            normal([['if', [], ['===', ['.', ref(value), 0], 0], { statements: [], exit: ['throw', 'terminal'] }, normal()]]),
            normal(), [['define', value, allocation, 'lazy']])
        const after = _joinResults(before)
        assertEq(after.statements.length, 1)
        const branch = branchOf(after)
        assertEq(branch[1].length, 1)
        assertEq(branch[3].statements[0][0], 'define')
        const declaration = branch[3].statements[0]
        assert(declaration[0] === 'define')
        assertEq(declaration[1], value)
        assertEq(declaration[2], allocation)
        assertEq(declaration[3], 'required')
        assertEq(branch[4].statements.length, 0)
        assertEq(after.exit[0], 'yield')
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        for (const block of [before, after]) {
            const fn = /** @type {FastFunction} */ ({ target: owner, parameters: [condition, input], rest: null, self: null, captures: [], body: { statements: block.statements, exit: ['return', owner, block.exit[0] === 'yield' ? block.exit[1][0] : undefined] } })
            const graph = fromFast({ statements: [], exit: ['yield', [['function', fn]]] })
            const evaluated = memo(assertOk(identityAnalysis(['()', graph, [true, 3]])))({ args: [] })
            assertStructurallySame(assertOk(toData(assertOk(evaluated))), [3, 7])
        }
    },
    everyExitKeepsItsOwnerAndFollowingValue: () => {
        const condition = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        /** @type {readonly ((value: Value) => Exit)[]} */
        const exits = [value => ['yield', [value]], value => ['break', target, [value]], value => ['continue', target, [value]], value => ['return', owner, value], value => ['throw', value]]
        for (const exit of exits) {
            const before = source(ref(condition), selected(ref(condition), 7), { statements: [], exit: ['throw', 9] }, normal(), [], exit)
            const after = _joinResults(before)
            assertEq(after.exit[0], before.exit[0])
            assertStructurallySame(branchOf(after)[3], before.statements[0][0] === 'if' ? before.statements[0][3] : undefined)
            assertEq(branchOf(after)[1].length, 1)
        }
    },
    multipleResultsAndValuePrefixesRemainOrdered: () => {
        const condition = id(0), kept = id(1)
        const prefix = /** @type {Statement} */ (['define', kept, 4, 'required'])
        const choice = /** @type {Value} */ (['if', ref(condition), result(ref(kept), [prefix]), { statements: [], exit: ['throw', 8] }])
        const after = _joinResults(source(ref(condition), ['array', [choice, selected(ref(condition), 9)]]))
        const branch = branchOf(after)
        assertEq(branch[1].length, 2)
        assert(branch[3].exit[0] === 'yield')
        assertEq(branch[3].exit[1].length, 2)
        assert(branch[3].exit[1][0] instanceof Array && branch[3].exit[1][0][0] === 'block')
    },
    unrelatedTestsAndEarlierWorkKeepTheirRegions: () => {
        const condition = id(0), other = id(0)
        const call = /** @type {Value} */ (['()', ref(other), []])
        const sharedTest = /** @type {Value} */ (['===', ref(condition), 1])
        for (const before of [
            source(ref(condition), selected(ref(other), 7)),
            source(sharedTest, selected(sharedTest, 7)),
            source(true, selected(ref(condition), 7)),
            source(ref(condition), selected(true, 7)),
            source(ref(condition), ['array', [call, selected(ref(condition), 7)]]),
            source(ref(condition), ['array', [['...', ref(other)], selected(ref(condition), 7)]]),
            source(ref(condition), ['if', ref(other), result(selected(ref(condition), 7)), result(0)]),
        ]) { assertStructurallySame(_joinResults(before), before) }
    },
    opaqueValuesAndStatementRegionsKeepTheirOwners: () => {
        const condition = id(0), local = id(1)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null, captures: [{ binding: condition, value: ref(local) }], body: { statements: [], exit: ['return', owner, selected(ref(condition), 7)] } }])
        for (const value of [undefined, ref(local), fn, ['array', []]]) {
            const before = source(ref(condition), /** @type {Value} */ (value))
            assertStructurallySame(_joinResults(before), before)
        }
        const nested = source(ref(condition), selected(ref(condition), 7))
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const wrapped = result(0, [['define', local, 1, 'required'], ['block', [id(2)], nested], ['loop', { target, parameters: [], initial: [], results: [id(3)], body: { ...nested, exit: ['break', target, [selected(ref(condition), 7)]] } }]])
        const after = _joinResults(wrapped)
        assertEq(after.statements.length, 3)
        assertStructurallySame(_joinResults(normal()), normal())
    },
    onlyOneArmsFirstReachedDemandBecomesRequired: () => {
        const condition = id(0), value = id(1), first = id(2), second = id(3)
        const recipe = /** @type {Statement} */ (['define', value, ['array', [7]], 'lazy'])
        const choice = selected(ref(condition), 7, ['.', ref(value), 0])
        const right = normal([['define', first, 1, 'required'], ['define', second, ['.', ref(value), 0], 'required']])
        const after = _joinResults(source(ref(condition), choice, normal(), right, [recipe]))
        const statements = branchOf(after)[4].statements
        assertEq(statements.length, 3)
        assertEq(statements[1][0], 'define')
        assertStructurallySame(statements[1], ['define', value, recipe[0] === 'define' ? recipe[2] : undefined, 'required'])
        const atExit = _joinResults(source(ref(condition), choice, normal(), normal(), [recipe]))
        assertEq(branchOf(atExit)[4].statements[0][0], 'define')
        const afterDeferred = _joinResults(source(ref(condition), choice, normal(), normal([['define', first, ['array', []], 'lazy']]), [recipe]))
        assertEq(branchOf(afterDeferred)[4].statements.length, 2)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const withLoop = normal([['loop', { target, parameters: [id(4)], initial: [ref(value)], results: [], body: { statements: [], exit: ['break', target, []] } }]])
        assertEq(branchOf(_joinResults(source(ref(condition), choice, normal(), withLoop, [recipe])))[4].statements[0][0], 'define')
    },
    lazyAndIndirectFirstUsesRetainMemoStorage: () => {
        const condition = id(0), value = id(1), other = id(2), resultId = id(3)
        const recipe = /** @type {Statement} */ (['define', value, ['array', [7]], 'lazy'])
        const reads = normal([['define', resultId, ref(value), 'lazy']])
        const scoped = normal([['block', [id(4)], result(ref(value))]])
        const guarded = normal([['if', [id(5)], ref(other), result(ref(value)), result(0)]])
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inLoop = normal([['loop', { target, parameters: [], initial: [], results: [id(6)], body: { statements: [], exit: ['break', target, [ref(value)]] } }]])
        for (const arm of [reads, scoped, guarded, inLoop]) {
            const after = _joinResults(source(ref(condition), selected(ref(condition), 0, ref(value)), normal(), arm, [recipe]))
            assert(after.statements.some(statement => statement === recipe))
        }
    },
    recipesRetainOneIdentityAtTheirFirstDemand: () => {
        const condition = id(0), value = id(1), other = id(2)
        const recipe = /** @type {Statement} */ (['define', value, ['array', [7]], 'lazy'])
        for (const before of [
            source(ref(condition), ['array', [ref(value), selected(ref(condition), ref(value))]], normal(), normal(), [recipe]),
            source(ref(condition), selected(ref(condition), ref(value), ref(value)), normal(), normal(), [recipe]),
            source(ref(condition), selected(ref(condition), 7), normal(), normal(), [recipe]),
            source(ref(condition), selected(ref(condition), 7), normal(), normal(), [recipe, ['define', other, ref(value), 'required']]),
            source(ref(value), selected(ref(value), 7), normal(), normal(), [recipe]),
        ]) {
            const definitions = _joinResults(before).statements.filter(statement => statement[0] === 'define' && statement[1] === value)
            assertEq(definitions.length, 1)
            assertEq(definitions[0][0] === 'define' ? definitions[0][2] : undefined, recipe[0] === 'define' ? recipe[2] : undefined)
        }
    },
    sharedSelectedResultsPrecedeFollowingCalls: () => {
        const condition = id(0), value = id(1), chosen = id(2), called = id(3), callee = id(4), ignored = id(5)
        const recipe = /** @type {Statement} */ (['define', value, ['array', [7]], 'lazy'])
        const phi = /** @type {Statement} */ (['define', chosen, selected(ref(condition), ['.', ref(value), 0]), 'lazy'])
        const before = source(ref(condition), ref(chosen), normal([['if', [], ['===', ['.', ref(value), 0], 0], { statements: [], exit: ['throw', 9] }, normal()]]), normal(), [recipe, phi])
        const after = _joinResults({ ...before, statements: [...before.statements, ['define', ignored, 1, 'lazy'], ['define', called, ['()', ref(callee), [ref(chosen)]], 'required']] })
        assertEq(after.statements.length, 3)
        const branch = after.statements[0]
        assert(branch[0] === 'if')
        assertEq(branch[1][0], chosen)
        assertEq(branch[3].statements[0][0], 'define')
        assertEq(after.statements[2][0], 'define')
        assertEq(branchOf(_joinResults(before))[1][0], chosen)
    },
    selectedRecipesCannotCrossEarlierUsesOrWork: () => {
        const condition = id(0), other = id(1), chosen = id(2), used = id(3)
        const phi = /** @type {Statement} */ (['define', chosen, selected(ref(condition), 7), 'lazy'])
        const base = source(ref(condition), ref(chosen), normal(), normal(), [phi])
        const afterEffect = /** @type {Block} */ ({ ...base, statements: [...base.statements, ['define', used, ['()', ref(other), []], 'required']] })
        const afterControl = /** @type {Block} */ ({ ...base, statements: [...base.statements, ['if', [], ref(other), normal(), normal()]] })
        const beforeUse = source(ref(condition), ref(chosen), normal(), normal(), [phi, ['define', used, ref(chosen), 'required']])
        const branchUse = source(ref(condition), ref(chosen), normal([['define', used, ref(chosen), 'required']]), normal(), [phi])
        for (const before of [afterEffect, afterControl, beforeUse, branchUse]) {
            assert(_joinResults(before).statements.some(statement => statement === phi))
        }
    },
    admittedHelperControlKeepsCanonicalSource: () => {
        const text = /** @type {const} */ ('const step=(i,sum)=>i%2===0?["normal",sum+i]:["continue"];export default n=>{let i=0;let sum=0;while(i<n){i=i+1;if(i>1){const c=step(i,sum);if(c[0]==="continue"){continue;}sum=c[1]+10;}else{sum=1;}}return [i,sum];};')
        let graph = moduleGraph(text)
        let canonical = ''
        let fingerprint = ''
        for (let round = 0; round < 4; round = round + 1) {
            const invoked = /** @type {import('../../types.ts').Exp} */ (['()', _defaultExport(graph), [4]])
            assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(invoked)))({ args: [] })))), [4, 27])
            const source = assertOk(tryModuleStringify(graph))
            graph = moduleGraph(source)
            const { root, nodes, scope, shared } = assertOk(identityAnalysis(graph))
            const actual = JSON.stringify({ root, nodes, scope, shared })
            if (round === 0) { fingerprint = actual }
            else {
                assertEq(actual, fingerprint)
                if (round === 1) { canonical = source }
                else { assertEq(source, canonical) }
            }
        }
    },
    deferredPrefixesKeepTheirFailureOrderAcrossRegions: () => {
        const condition = id(0), earlier = id(1), chosen = id(2), use = id(3), output = id(4)
        const earlierRecipe = /** @type {Statement} */ (['define', earlier, fail('earlier'), 'lazy'])
        const choice = selected(ref(condition), fail('selected'), 0)
        const chosenRecipe = /** @type {Statement} */ (['define', chosen, choice, 'lazy'])
        const base = source(ref(condition), ref(use), normal(), normal(), [chosenRecipe])
        const used = /** @type {Block} */ ({ ...base, statements: [...base.statements, ['define', use, ['array', [ref(earlier), ref(chosen)]], 'required']] })
        const before = /** @type {Block} */ ({ ...used, statements: [earlierRecipe, ...used.statements] })
        const inherited = result(ref(output), [earlierRecipe, ['block', [output], used]])
        const extracted = source(ref(condition), ['array', [ref(earlier), choice]], normal(), normal(), [earlierRecipe])
        const localized = source(ref(condition), selected(ref(condition), ref(chosen), 0), normal([
            ['define', use, ['array', [ref(earlier), ref(chosen)]], 'required'],
        ]), normal(), [earlierRecipe, ['define', chosen, fail('selected'), 'lazy']])
        for (const block of [before, inherited, extracted, localized]) {
            for (const actual of [block, _joinResults(block)]) {
                assertEq(assertOk(toData(assertError(evaluate(actual, condition, true)))), 'earlier')
            }
        }
    },
    operandBlocksRetainTheirFirstEvaluation: () => {
        const condition = id(0), local = id(1), other = id(2)
        for (const block of [
            result(selected(ref(condition), 7)),
            result(ref(local), [['define', local, selected(ref(condition), 7), 'required']]),
        ]) {
            const after = _joinResults(source(ref(condition), ['block', block]))
            assertEq(branchOf(after)[1].length, 1)
        }
        for (const block of [
            { statements: [], exit: /** @type {const} */ (['throw', 8]) },
            result(selected(ref(condition), 7), [['define', local, ['()', ref(other), []], 'required']]),
            result(selected(ref(condition), 7), [['define', local, 1, 'lazy']]),
            result(selected(ref(condition), 7), [['if', [], ref(other), normal(), normal()]]),
        ]) {
            const before = source(ref(condition), ['block', /** @type {Block} */ (block)])
            assertStructurallySame(_joinResults(before), before)
        }
    },
    deferredCaptureCallsKeepEarlierFailuresAndFunctionBoundaries: () => {
        const condition = id(0), earlier = id(1), chosen = id(2), closure = id(3), use = id(4), captureA = id(5), captureB = id(6)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const throwOwner = /** @type {const} */ ({ kind: 'function', index: 1 })
        const thrower = /** @type {Value} */ (['function', { target: throwOwner, parameters: [], rest: null, self: null, captures: [], body: { statements: [], exit: ['throw', 'earlier'] } }])
        const callee = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null, captures: [
            { binding: captureA, value: ref(earlier) }, { binding: captureB, value: ref(chosen) },
        ], body: { statements: [], exit: ['return', owner, ref(captureB)] } }])
        const prefix = /** @type {readonly Statement[]} */ ([
            ['define', earlier, ['()', thrower, []], 'lazy'],
            ['define', chosen, selected(ref(condition), fail('selected'), 0), 'lazy'],
            ['define', closure, callee, 'lazy'],
        ])
        const base = source(ref(condition), ref(use), normal(), normal(), prefix)
        const before = /** @type {Block} */ ({ ...base, statements: [...base.statements, ['define', use, ['()', ref(closure), []], 'required']] })
        for (const block of [before, _joinResults(before)]) {
            assertEq(assertOk(toData(assertError(evaluate(block, condition, true)))), 'earlier')
        }
    },
    deferredDependencyChecksShareTheirVisitedBindings: () => {
        const condition = id(0), shared = id(1), left = id(2), right = id(3), chosen = id(4), used = id(5)
        const before = source(ref(condition), ref(chosen), normal(), normal(), [
            ['define', shared, ['array', [7]], 'lazy'],
            ['define', left, ref(shared), 'lazy'], ['define', right, ref(shared), 'lazy'],
            ['define', chosen, selected(ref(condition), 9), 'lazy'],
            ['define', used, ['array', [ref(left), ref(right)]], 'required'],
        ])
        assertEq(branchOf(_joinResults(before))[1][0], chosen)
    },
    snapshotsCaptureTheSelectedNormalResult: () => {
        /** @type {readonly (readonly [string, readonly number[]])[]} */
        const cases = [
            ['let i=0;let sum=0;let current=()=>0;while(i<4){i=i+1;if(i>1){switch(i%2){case 0:{sum=sum+i;break;}default:{continue;}}sum=sum+10;}else{sum=1;}const snapshot=sum;current=()=>snapshot;}return [i,sum,current()];', [4, 27, 27]],
            ['let i=0;let current=()=>0;while(i<4){i=i+1;let sum=0;if(i>1){switch(i%2){case 0:{sum=sum+i;break;}default:{continue;}}sum=sum+10;}else{sum=1;}const snapshot=sum;current=()=>snapshot;}return [i,current()];', [4, 14]],
        ]
        for (const [body, expected] of cases) {
            for (const eager of [true, false]) {
                let graph = moduleGraph(`export default ${eager ? `(()=>{${body}})()` : `()=>{${body}}`};`)
                let stable = ''
                let canonical = ''
                for (let round = 0; round < 7; round = round + 1) {
                    const exported = _defaultExport(graph)
                    const invoked = eager ? exported : /** @type {import('../../types.ts').Exp} */ (['()', exported, []])
                    assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(invoked)))({ args: [] })))), expected)
                    const text = assertOk(tryModuleStringify(graph))
                    graph = moduleGraph(text)
                    const { root, nodes, scope, shared } = assertOk(identityAnalysis(graph))
                    const actual = JSON.stringify({ root, nodes, scope, shared })
                    if (round === 0) { stable = actual }
                    else {
                        assertEq(actual, stable)
                        if (round === 1) { canonical = text }
                        else { assertEq(text, canonical) }
                    }
                }
            }
        }
    },
    existingJoinedBindingsStayAfterTheirDefiningArms: () => {
        const condition = id(0), joined = id(1), later = id(2)
        const branch = /** @type {Statement} */ (['if', [joined], ref(condition), result(1), result(2)])
        const value = selected(ref(condition), ['+', ref(joined), 1], ['+', ref(joined), 2])
        const direct = result(value, [branch])
        const shared = result(ref(later), [branch, ['define', later, value, 'lazy']])
        for (const before of [direct, shared]) {
            const after = _joinResults(before)
            assertStructurallySame(after, before)
            for (const block of [before, after]) {
                assertEq(assertOk(toData(assertOk(evaluate(block, condition, true)))), 2)
                assertEq(assertOk(toData(assertOk(evaluate(block, condition, false)))), 4)
            }
        }
    },
    dependentRecipesStayDeferredAfterRecoveredResults: () => {
        const condition = id(0), joined = id(1), later = id(2), alias = id(3)
        const prefix = /** @type {readonly Statement[]} */ ([
            ['define', joined, selected(ref(condition), 1, 2), 'lazy'],
            ['define', later, fail('deferred'), 'lazy'],
            ['define', alias, ['array', [ref(joined), ref(later)]], 'lazy'],
        ])
        const before = source(ref(condition), ['array', [ref(joined), selected(ref(condition), ref(alias), 0)]], normal(), normal(), prefix)
        const after = _joinResults(before)
        const branch = after.statements.findIndex(statement => statement[0] === 'if')
        const dependent = after.statements.findIndex(statement => statement[0] === 'define' && statement[1] === alias)
        assert(branch >= 0 && dependent > branch)
        const declaration = after.statements[dependent]
        assert(declaration[0] === 'define')
        assertEq(declaration[3], 'lazy')
        for (const block of [before, after]) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(block, condition, false)))), [2, 0])
            assertEq(assertOk(toData(assertError(evaluate(block, condition, true)))), 'deferred')
        }
    },
})
