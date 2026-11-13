/**
 * Fixed-parameter tail transitions preserve invocation values and ordinary calls.
 *
 * @import { Exp, Args } from '../../types.ts'
 * @import { BindingId, Function as FastFunction } from '../../../js/ast/types.ts'
 * @import { Function as PreparedFunction } from '../../../js/ast/prepare/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { analysis, identityAnalysis } from '../../analysis/module.f.mjs'
import { functionFromAnalysis, toFast } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { prepareFunction } from '../../../js/ast/prepare/module.f.mjs'
import { evaluate, failure, flat } from '../../from_fast/member_returns/proof.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body } from '../../from_fast/proof.f.mjs'

/** @type {(index: number) => Exp} */
const arg = index => ['arg', index]

/** @type {(args: Args) => Exp} */
const recur = args => ['()', ['self'], args]

/** @type {(graph: Exp) => FastFunction} */
export const _tailFunction = graph => {
    const table = assertOk(identityAnalysis(graph))
    assert(table.root instanceof Array)
    return functionFromAnalysis(table, table.root[1])
}

/** The first normalized graph is the conversion's documented canonical form. @type {(graph: Exp) => Exp} */
const stable = graph => {
    let current = fromFast(assertOk(toFast(graph)))
    const first = flat(current)
    for (let generation = 0; generation < 7; generation += 1) {
        current = fromFast(assertOk(toFast(current)))
        assertStructurallySame(flat(current), first)
    }
    return current
}

/** @type {(fn: Exp, args: Args) => unknown} */
const run = (fn, args) => evaluate(['()', stable(fn), args])

/** @type {(fn: FastFunction) => boolean} */
const loops = fn => fn.body.statements.some(statement => statement[0] === 'loop')

/** The selected recursive call reads this invocation's fresh self binding. @type {(fn: PreparedFunction, previous: BindingId) => void} */
const preparedSelfCall = (fn, previous) => {
    assert(fn.self !== null && fn.self !== previous)
    assertEq(fn.self.index, previous.index)
    const exit = fn.body.exit
    assert(exit[0] === 'return')
    assertEq(exit[1], fn.target)
    const value = exit[2]
    assert(value instanceof Array && value[0] === 'if')
    const selected = value[2].exit
    assert(selected[0] === 'yield' && selected[1].length === 1)
    const call = selected[1][0]
    assert(call instanceof Array && call[0] === '()')
    const callee = call[1]
    assert(callee instanceof Array && callee[0] === 'ref')
    assertEq(callee[1], fn.self)
}

export const proof = /** @type {const} */ ({
    eitherConditionalArmCanReturnAnArbitraryBase: () => {
        for (const [base, expected] of /** @type {readonly (readonly [Exp, unknown])[]} */ ([
            ['done', 'done'], [['undefined'], undefined], [['[]', [4, 5]], [4, 5]], [['{}', [[':', 'value', 7]]], { value: 7 }],
        ])) {
            for (const inverted of /** @type {const} */ ([false, true])) {
                const test = /** @type {Exp} */ ([inverted ? '<=' : '>', arg(0), 0])
                const call = recur([['-', arg(0), 1]])
                const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', test, inverted ? base : call, inverted ? call : base]])
                assert(loops(_tailFunction(fn)))
                assertStructurallySame(run(fn, [3]), expected)
            }
        }
    },
    bothConditionalArmsAndNestedTestsHaveTailTransitions: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0],
            ['?:', ['===', ['%', arg(0), 2], 0], recur([['-', arg(0), 2], ['+', arg(1), 2]]), recur([['-', arg(0), 1], ['+', arg(1), 1]])],
            ['[]', [arg(0), arg(1)]]]])
        assert(loops(_tailFunction(fn)))
        assertStructurallySame(run(fn, [7, 0]), [0, 7])
        assertStructurallySame(run(fn, [8, 0]), [0, 8])
    },
    finalCommaPrefixesRunAtTheirOriginalIterations: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], [',', [
            ['[]', [arg(0)]],
            ['?:', ['>', arg(0), 0], [',', [['{}', [[':', 'count', arg(0)]]], recur([['-', arg(0), 1], ['+', arg(1), arg(0)]])]], arg(1)],
        ]]])
        assert(loops(_tailFunction(fn)))
        assertEq(run(fn, [4, 0]), 10)
        const failedPrefix = /** @type {Exp} */ (['=>', 1, [], [',', [
            ['?:', ['===', arg(0), 1], ['throw', 'later iteration prefix'], 0],
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), 'done'],
        ]]])
        assert(loops(_tailFunction(failedPrefix)))
        failure(['()', fromFast(assertOk(toFast(failedPrefix))), [3]])
    },
    swappedAndDependentArgumentsReadOneOldParameterSnapshot: () => {
        const fn = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], arg(2), ['+', arg(1), arg(2)]]), ['[]', [arg(1), arg(2)]]]])
        const normalized = _tailFunction(fn)
        assert(loops(normalized))
        assertEq(normalized.parameters.length, 3)
        assertStructurallySame(run(fn, [3, 1, 2]), [5, 8])
        assertStructurallySame(run(fn, [0, 1, 2]), [1, 2])
    },
    initialArgumentsKeepMissingExtraSpreadAndFailureEvaluation: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], arg(1)]), arg(1)]])
        assert(loops(_tailFunction(fn)))
        assertEq(run(fn, [0]), undefined)
        assertEq(run(fn, [2, 9, 7]), 9)
        assertEq(run(fn, [['...', ['[]', [2, 8]]]]), 8)
        failure(['()', fromFast(assertOk(toFast(fn))), [0, 9, ['throw', 'extra initial argument']]])
        failure(['()', fromFast(assertOk(toFast(fn))), [0, ['throw', 'required initial argument']]])
    },
    zeroParameterTailCandidateKeepsTheEmptyInputSignature: () => {
        const fn = /** @type {Exp} */ (['=>', 0, [], ['?:', false, recur([]), 7]])
        const normalized = _tailFunction(fn)
        assert(loops(normalized))
        assertEq(normalized.parameters.length, 0)
        assertEq(prepareFunction(normalized).parameters.length, 0)
        assertEq(run(fn, []), 7)
        assertEq(run(fn, [8]), 7)
        failure(['()', fromFast(assertOk(toFast(fn))), [['throw', 'zero parameter initial argument']]])
    },
    missingAndExtraRecursiveArgumentsUseTheFixedInvocationSignature: () => {
        const missing = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['[]', [arg(0), arg(1)]]]])
        const extra = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], 7]), arg(0)]])
        const spread = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['...', ['[]', [['-', arg(0), 1]]]]]), arg(0)]])
        for (const fn of [missing, extra, spread]) {
            const normalized = _tailFunction(fn)
            assert(loops(normalized))
            assertEq(normalized.self, null)
            assertEq(evaluate(['.', stable(fn), 'length']), fn instanceof Array && fn[0] === '=>' ? fn[1] : -1)
        }
        assertStructurallySame(run(missing, [1, 9]), [0, undefined])
        assertEq(run(extra, [3]), 0)
        assertEq(run(spread, [3]), 0)
        const failingExtra = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], ['throw', 'recursive extra argument']]), 0]])
        failure(['()', fromFast(assertOk(toFast(failingExtra))), [1]])
    },
    spreadArgumentsExpandEmptyMultipleAndMixedInputs: () => {
        const mixed = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0], recur([
            ['...', ['[]', []]], ['-', arg(0), 1], ['...', ['[]', [['+', arg(1), 1]]]], ['...', ''],
        ]), arg(1)]])
        assert(loops(_tailFunction(mixed)))
        assertEq(run(mixed, [3, 4]), 7)
        const short = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1]]]]]), ['[]', [arg(0), arg(1), arg(2)]]]])
        assert(loops(_tailFunction(short)))
        assertStructurallySame(run(short, [3, 8, 9]), [0, undefined, undefined])
        const empty = /** @type {Exp} */ (['=>', 2, [], ['?:', ['===', arg(0), ['undefined']],
            ['[]', [arg(0), arg(1)]], recur([['...', ['[]', []]]])]])
        assert(loops(_tailFunction(empty)))
        assertStructurallySame(run(empty, [1, 2]), [undefined, undefined])
        const strings = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['...', 'ab']]), ['[]', [arg(1), arg(2)]]]])
        assert(loops(_tailFunction(strings)))
        assertStructurallySame(run(strings, [2, 8, 9]), ['a', 'b'])
    },
    expandedExtraValuesRetainFailuresAndSkippedRegions: () => {
        const invalid = /** @type {readonly Exp[]} */ ([null, 1, true, ['undefined'], ['{}', []], ['throw', 'spread argument']])
        for (const input of invalid) {
            const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
                recur([['-', arg(0), 1], ['...', input]]), 7]])
            assert(loops(_tailFunction(fn)))
            assertEq(run(fn, [0]), 7)
            failure(['()', stable(fn), [1]])
        }
        const extra = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1], ['throw', 'unused expanded extra']]]]]), 7]])
        assert(loops(_tailFunction(extra)))
        assertEq(run(extra, [0]), 7)
        failure(['()', stable(extra), [1]])
        const later = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1]]]], ['throw', 'later ordinary extra']]), 7]])
        assert(loops(_tailFunction(later)))
        assertEq(run(later, [0]), 7)
        failure(['()', stable(later), [1]])
        const zero = /** @type {Exp} */ (['=>', 0, [], recur([['...', null]])])
        assert(loops(_tailFunction(zero)))
        failure(['()', stable(zero), []])
    },
    spreadTransitionsRetainSwapsCapturesAndArity: () => {
        const swapped = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1], arg(2), arg(1)]]], ['...', ['[]', [7, 8]]]]), ['[]', [arg(1), arg(2)]]]])
        assert(loops(_tailFunction(swapped)))
        assertStructurallySame(run(swapped, [3, 1, 2]), [2, 1])
        assertEq(evaluate(['.', stable(swapped), 'length']), 3)
        const saved = /** @type {Exp} */ (['=>', 0, [arg(0)], ['frame', 0]])
        const captured = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['...', ['[]', [saved]]]]), ['()', arg(1), []]]])
        assert(loops(_tailFunction(captured)))
        assertEq(run(captured, [3, null]), 1)
        assertEq(evaluate(['.', stable(captured), 'length']), 2)
    },
    spreadArgumentsRetainLocalSharingAndFreshIterations: () => {
        const local = /** @type {Exp} */ (['[]', [arg(0)]])
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', ['.', local, 0], 0],
            recur([['-', arg(0), 1], ['...', ['[]', [['[]', [arg(1), local, local]]]]]]), ['[]', [arg(1), local, local]]]])
        assert(loops(_tailFunction(fn)))
        const values = run(fn, [2, null])
        assert(values instanceof Array && values[0] instanceof Array)
        assertEq(values[1], values[2])
        assertEq(values[0][1], values[0][2])
        assert(values[1] !== values[0][1])
        assertStructurallySame(values[1], [0])
        assertStructurallySame(values[0][1], [1])
    },
    spreadCallsRetainRestValuesAndNonTailEvaluationBoundaries: () => {
        const rest = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1], 'recursive rest']]]]), ['rest']]])
        assert(loops(_tailFunction(rest)))
        assert(_tailFunction(rest).rest !== null && _tailFunction(rest).self === null)
        assertStructurallySame(run(rest, [2, 'initial rest']), ['recursive rest'])
        const call = recur([['...', ['[]', [['-', arg(0), 1]]]]])
        const ordinary = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], ['+', call, 1], 0]])
        assert(!loops(_tailFunction(ordinary)))
        assert(_tailFunction(ordinary).self !== null)
        assertEq(run(ordinary, [3]), 3)
        const established = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            ['?:', ['===', call, 0], call, 1], 0]])
        assert(!loops(_tailFunction(established)))
        assert(_tailFunction(established).self !== null)
        assertEq(run(established, [3]), 0)
    },
    absentRecursiveParametersAreUndefinedAtEveryInvocation: () => {
        const fn = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1]]), ['[]', [arg(0), arg(1), arg(2)]]]])
        assert(loops(_tailFunction(fn)))
        assertStructurallySame(run(fn, [3, 8, 9]), [0, undefined, undefined])
        assertStructurallySame(run(fn, [0, 8, 9]), [0, 8, 9])
        const empty = /** @type {Exp} */ (['=>', 2, [], ['?:', ['===', arg(0), ['undefined']], ['[]', [arg(0), arg(1)]], recur([])]])
        assert(loops(_tailFunction(empty)))
        assertStructurallySame(run(empty, [1, 2]), [undefined, undefined])
    },
    extraArgumentsRunOnlyOnReachedTransitionsAndStillFail: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0], recur([
            ['-', arg(0), 1], arg(1), ['?:', ['===', arg(0), 1], ['throw', 'last transition extra'], ['[]', [arg(0)]]],
        ]), arg(1)]])
        assert(loops(_tailFunction(fn)))
        assertEq(run(fn, [0, 9]), 9)
        failure(['()', stable(fn), [3, 9]])
        const zero = /** @type {Exp} */ (['=>', 0, [], ['?:', false, recur([['throw', 'skipped zero-parameter extra']]), 7]])
        assert(loops(_tailFunction(zero)))
        assertEq(_tailFunction(zero).parameters.length, 0)
        assertEq(run(zero, []), 7)
        const failingZero = /** @type {Exp} */ (['=>', 0, [], recur([['throw', 'required zero-parameter extra']])])
        assert(loops(_tailFunction(failingZero)))
        failure(['()', stable(failingZero), []])
        const failingPrefix = /** @type {Exp} */ (['=>', 1, [], recur([['throw', 'required fixed argument'], 4])])
        assert(loops(_tailFunction(failingPrefix)))
        failure(['()', stable(failingPrefix), []])
        const badCapture = /** @type {Exp} */ (['=>', 0, [['throw', 'unused extra capture']], 1])
        const failingClosure = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([0, badCapture]), 7]])
        assert(loops(_tailFunction(failingClosure)))
        assertEq(run(failingClosure, [0]), 7)
        failure(['()', stable(failingClosure), [1]])
    },
    mixedArgumentCountsKeepSimultaneousValuesAndIterationSetup: () => {
        const fn = /** @type {Exp} */ (['=>', 3, [], ['?:', ['>', arg(0), 0], ['?:', ['===', ['%', arg(0), 2], 0],
            recur([['-', arg(0), 1], arg(2), ['+', arg(1), arg(2)], ['[]', [arg(1), arg(2)]]]),
            recur([['-', arg(0), 1], arg(2)])], ['[]', [arg(1), arg(2)]]]])
        assert(loops(_tailFunction(fn)))
        assertStructurallySame(run(fn, [2, 1, 2]), [3, undefined])
        assertStructurallySame(run(fn, [1, 1, 2]), [2, undefined])
        const setup = /** @type {Exp} */ (['=>', 2, [], [',', [['.', arg(1), 'x'],
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), 7]]]])
        assert(loops(_tailFunction(setup)))
        assertEq(run(setup, [0, ['{}', [[':', 'x', 1]]]]), 7)
        failure(['()', stable(setup), [1, ['{}', [[':', 'x', 1]]]]])
    },
    mismatchedArgumentCapturesKeepTheCreatingIteration: () => {
        const saved = /** @type {Exp} */ (['=>', 0, [arg(0)], ['frame', 0]])
        for (const fixed of /** @type {const} */ ([2, 3])) {
            const next = /** @type {Args} */ (fixed === 2 ? [['-', arg(0), 1], saved, ['[]', [arg(1)]]] : [['-', arg(0), 1], saved])
            const fn = /** @type {Exp} */ (['=>', fixed, [], ['?:', ['>', arg(0), 0], recur(next), ['()', arg(1), []]]])
            assert(loops(_tailFunction(fn)))
            assertEq(run(fn, [3, null]), 1)
            assertEq(evaluate(['.', stable(fn), 'length']), fixed)
        }
    },
    discardedArgumentReadsKeepTheirOwnersAndFirstNormalizedGraph: () => {
        const local = /** @type {Exp} */ (['[]', [arg(0)]])
        const lazy = /** @type {Exp} */ (['[]', [arg(0)]])
        const failed = /** @type {Exp} */ (['[]', [['throw', 'lazy extra allocation']]])
        const captured = /** @type {Exp} */ (['=>', 1, [['[]', [7]]], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['[]', [arg(0)]], ['frame', 0]]), 29]])
        const required = /** @type {Exp} */ (['=>', 1, [], [',', [local, ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['[]', [arg(0)]], local]), 29]]]])
        const deferred = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], ['?:', true,
            recur([['-', arg(0), 1], ['[]', [arg(0)]], lazy]), ['===', lazy, lazy]], 29]])
        const trailingRead = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['[]', [arg(0)]], arg(0)]), 29]])
        for (const fn of [captured, required, deferred, trailingRead]) {
            assert(loops(_tailFunction(fn)))
            assertEq(run(fn, [3]), 29)
            assertEq(run(fn, [0]), 29)
        }
        const failedDeferred = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], ['?:', true,
            recur([['-', arg(0), 1], ['[]', [arg(0)]], failed]), ['===', failed, failed]], 29]])
        assert(loops(_tailFunction(failedDeferred)))
        assertEq(run(failedDeferred, [0]), 29)
        failure(['()', stable(failedDeferred), [1]])
        const failedBeforeRead = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['[]', [arg(0)]], ['throw', 'second extra'], arg(0)]), 29]])
        assert(loops(_tailFunction(failedBeforeRead)))
        failure(['()', stable(failedBeforeRead), [1]])
    },
    restReadsSeeTheRecursiveInvocationInsteadOfTheInitialRest: () => {
        const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['rest']]])
        const normalized = _tailFunction(fn)
        assert(loops(normalized))
        assert(normalized.rest !== null && normalized.self === null)
        const prepared = prepareFunction(normalized)
        assertEq(prepared.rest, normalized.rest)
        assertEq(prepared.self, normalized.self)
        assertStructurallySame(run(fn, [2, 7, 8]), [])
        assertStructurallySame(run(fn, [0, 7, 8]), [7, 8])
    },
    restArraysAreFreshPerIterationAndSharedWithinIt: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['rest'], ['...', ['rest']]]),
            ['[]', [arg(1), ['rest'], ['rest'], ['===', arg(1), ['rest']]]]]])
        const normalized = _tailFunction(fn)
        assert(loops(normalized))
        assertEq(normalized.parameters.length, 2)
        assert(normalized.rest !== null)
        const values = run(fn, [3, null, 7, 8])
        assert(values instanceof Array)
        assertStructurallySame(values, [[7, 8], [7, 8], [7, 8], false])
        assertEq(values[1], values[2])
        assert(values[0] !== values[1])
        const fresh = run(fn, [0, null, 7, 8])
        assert(fresh instanceof Array)
        assertEq(fresh[1], fresh[2])
        assert(values[1] !== fresh[1])
    },
    restCapturesRetainTheCreatingInvocation: () => {
        const saved = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], saved, arg(0)]), ['[]', [['()', arg(1), []], ['rest']]]]])
        assert(loops(_tailFunction(fn)))
        assertStructurallySame(run(fn, [3, null, 99]), [[2], [1]])
    },
    loweredRestParameterSetupRunsAgainEachIteration: () => {
        const input = /** @type {Exp} */ (['.', ['rest'], 0])
        const value = /** @type {Exp} */ (['?:', ['===', input, ['undefined']], ['[]', []], input])
        const defaults = /** @type {Exp} */ (['=>', 1, [], [',', [value,
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], ['undefined'], value]),
                ['[]', [value, ['.', ['rest'], 1], ['===', value, ['.', ['rest'], 1]]]]],
        ]]])
        assert(loops(_tailFunction(defaults)))
        const values = run(defaults, [2])
        assert(values instanceof Array)
        assertStructurallySame(values, [[], [], false])
        assert(values[0] !== values[1])
        const failedDefault = /** @type {Exp} */ (['?:', ['===', input, ['undefined']], ['throw', 'required default'], input])
        const failing = /** @type {Exp} */ (['=>', 1, [], [',', [failedDefault,
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), 7],
        ]]])
        assert(loops(_tailFunction(failing)))
        assertEq(run(failing, [0, 9]), 7)
        failure(['()', stable(failing), [1, 9]])
        const item = /** @type {Exp} */ (['.', input, 0])
        const pattern = /** @type {Exp} */ (['=>', 1, [], [',', [item,
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), item],
        ]]])
        assert(loops(_tailFunction(pattern)))
        assertEq(run(pattern, [0, ['[]', [9]]]), 9)
        failure(['()', stable(pattern), [1, ['[]', [9]]]])
    },
    restInvocationsKeepMissingArgumentsSpreadsAndFailures: () => {
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0],
            recur([['...', ['[]', [['-', arg(0), 1]]]]]), ['[]', [arg(1), ['rest']]]]])
        assert(loops(_tailFunction(fn)))
        assertStructurallySame(run(fn, [3, 8, 9]), [undefined, []])
        assertStructurallySame(run(fn, [0, 8, 9]), [8, [9]])
        const failing = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([0, ['throw', 'required rest argument']]), ['rest']]])
        assert(loops(_tailFunction(failing)))
        assertStructurallySame(run(failing, [0]), [])
        failure(['()', stable(failing), [1]])
        const invalid = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([0, ['...', null]]), ['rest']]])
        assert(loops(_tailFunction(invalid)))
        assertStructurallySame(run(invalid, [0]), [])
        failure(['()', stable(invalid), [1]])
    },
    zeroAndSixteenFixedParametersRetainTheirRestAndArity: () => {
        const zero = /** @type {Exp} */ (['=>', 0, [], ['?:', ['>', ['.', ['rest'], 0], 0],
            recur([['-', ['.', ['rest'], 0], 1], ['...', ['()', ['slice'], [['rest'], 1]]]]), ['rest']]])
        const normalizedZero = _tailFunction(zero)
        assert(loops(normalizedZero))
        assertEq(normalizedZero.parameters.length, 0)
        assert(normalizedZero.rest !== null)
        assertEq(evaluate(['.', stable(zero), 'length']), 0)
        assertStructurallySame(run(zero, [3, 7, 8]), [0, 7, 8])
        const many = /** @type {Exp} */ (['=>', 16, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ...Array.from({ length: 15 }, (_, index) => arg(index + 1)), ['...', ['rest']]]),
            ['[]', [arg(15), ['rest']]]]])
        const normalized = _tailFunction(many)
        assert(loops(normalized))
        assertEq(normalized.parameters.length, 16)
        assert(normalized.rest !== null)
        const loop = normalized.body.statements[0]
        assert(loop[0] === 'loop')
        assertEq(loop[1].parameters.length, 17)
        assertEq(evaluate(['.', stable(many), 'length']), 16)
        assertStructurallySame(run(many, [3, ...Array.from({ length: 15 }, (_, index) => index + 1), 99]), [15, [99]])
    },
    restTailLoopsKeepRemainingSelfIdentityAndNonTailCalls: () => {
        const mixed = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 1],
            recur([['-', arg(0), 1], ['...', ['rest']]]), ['?:', ['===', arg(0), 1], ['+', recur([0]), 10], ['.', ['rest'], 'length']]]])
        const normalized = _tailFunction(mixed)
        assert(loops(normalized))
        assert(normalized.rest !== null && normalized.self !== null)
        assertEq(run(mixed, [3, 7, 8]), 10)
        const returned = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['...', ['rest']]]), ['[]', [['self'], ['rest']]]]])
        const graph = stable(returned)
        assert(_tailFunction(returned).self !== null)
        assertEq(evaluate(['===', ['.', ['()', graph, [3, 7]], 0], graph]), true)
        const call = recur([['-', arg(0), 1]])
        const established = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0],
            ['?:', ['===', call, 0], call, 1], ['.', ['rest'], 'length']]])
        assert(!loops(_tailFunction(established)))
        assert(_tailFunction(established).rest !== null && _tailFunction(established).self !== null)
        assertEq(run(established, [3]), 0)
    },
    capturedParametersKeepTheirIterationAndOuterValueSnapshots: () => {
        const captured = /** @type {Exp} */ (['[]', [4]])
        const closure = /** @type {Exp} */ (['=>', 0, [arg(0), ['frame', 0]], ['[]', [['frame', 0], ['frame', 1]]]])
        const fn = /** @type {Exp} */ (['=>', 2, [captured], ['?:', ['>', arg(0), 0],
            recur([['-', arg(0), 1], ['[]', [arg(1), closure]]]), arg(1)]])
        assert(loops(_tailFunction(fn)))
        const history = /** @type {Exp} */ (['()', stable(fn), [3, null]])
        const previous = /** @type {Exp} */ (['.', history, 0])
        const oldest = /** @type {Exp} */ (['.', previous, 0])
        const values = evaluate(['[]', [['()', ['.', history, 1], []], ['()', ['.', previous, 1], []], ['()', ['.', oldest, 1], []]]])
        assert(values instanceof Array && values[0] instanceof Array && values[1] instanceof Array && values[2] instanceof Array)
        assertStructurallySame(values, [[1, [4]], [2, [4]], [3, [4]]])
        assertEq(values[0][1], values[1][1])
        assertEq(values[1][1], values[2][1])
    },
    localAllocationsAndEscapedFunctionsAreFreshEveryIteration: () => {
        const local = /** @type {Exp} */ (['{}', [[':', 'count', arg(0)]]])
        const closure = /** @type {Exp} */ (['=>', 0, [local], ['frame', 0]])
        const fn = /** @type {Exp} */ (['=>', 2, [], [',', [local,
            ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], ['[]', [arg(1), local, local, closure]]]), arg(1)],
        ]]])
        assert(loops(_tailFunction(fn)))
        const history = /** @type {Exp} */ (['()', stable(fn), [3, null]])
        const previous = /** @type {Exp} */ (['.', history, 0])
        const values = evaluate(['[]', [['.', history, 1], ['.', history, 2], ['()', ['.', history, 3], []], ['.', previous, 1], ['()', ['.', previous, 3], []], ['===', ['.', history, 3], ['.', previous, 3]]]])
        assert(values instanceof Array)
        assertStructurallySame(values, [{ count: 1 }, { count: 1 }, { count: 1 }, { count: 2 }, { count: 2 }, false])
        assertEq(values[0], values[1])
        assertEq(values[0], values[2])
        assertEq(values[3], values[4])
        assert(values[0] !== values[3])
    },
    sharedLazyValuesResetOncePerIterationAndFreshInvocation: () => {
        const local = /** @type {Exp} */ (['[]', [arg(0)]])
        const fn = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', ['.', local, 0], 0],
            recur([['-', arg(0), 1], ['[]', [arg(1), local, local]]]), ['[]', [arg(1), local, local]]]])
        assert(loops(_tailFunction(fn)))
        const normalized = stable(fn)
        const first = /** @type {Exp} */ (['()', normalized, [2, null]])
        const second = /** @type {Exp} */ (['()', normalized, [2, null]])
        const values = evaluate(['[]', [['.', first, 1], ['.', first, 2], ['.', ['.', first, 0], 1], ['.', second, 1]]])
        assert(values instanceof Array)
        assertStructurallySame(values, [[0], [0], [1], [0]])
        assertEq(values[0], values[1])
        assert(values[0] !== values[2] && values[0] !== values[3])
    },
    nonTailSelfValuesAndCallsRetainTheirFunctionBinding: () => {
        const returned = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['self']]])
        const normalized = _tailFunction(returned)
        assert(loops(normalized))
        assert(normalized.self !== null)
        const graph = stable(returned)
        assertEq(evaluate(['===', ['()', graph, [3]], graph]), true)
        const called = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 1], recur([['-', arg(0), 1]]),
            ['?:', ['===', arg(0), 1], ['+', recur([0]), 10], 2]]])
        assert(loops(_tailFunction(called)))
        assert(_tailFunction(called).self !== null)
        assertEq(run(called, [3]), 12)
    },
    establishedRecursiveResultsRemainOrdinaryReads: () => {
        const call = recur([['-', arg(0), 1]])
        const returned = /** @type {Exp} */ (['?:', ['===', call, 0], call, 1])
        for (const arm of /** @type {readonly Exp[]} */ ([returned, [',', [call, returned]]])) {
            const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], arm, 0]])
            assert(!loops(_tailFunction(fn)))
            assert(_tailFunction(fn).self !== null)
            assertEq(run(fn, [4]), 0)
        }
    },
    aSharedCallWithOnlyTerminalDemandsBecomesOneTransition: () => {
        const call = recur([['-', arg(0), 1]])
        const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], ['?:', ['===', ['%', arg(0), 2], 0], call, call], 'done']])
        assert(loops(_tailFunction(fn)))
        assertEq(_tailFunction(fn).self, null)
        assertEq(run(fn, [5]), 'done')
    },
    nestedFunctionBodiesOwnTheirSelfCalls: () => {
        const child = /** @type {Exp} */ (['=>', 1, [arg(0)], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['frame', 0]]])
        const fn = /** @type {Exp} */ (['=>', 1, [], child])
        const normalized = _tailFunction(fn)
        assert(!loops(normalized))
        assertEq(normalized.self, null)
        assertEq(evaluate(['()', ['()', stable(fn), [9]], [3]]), 9)
        const skippedOuter = /** @type {Exp} */ (['=>', 1, [], ['?:', false, recur([0]), child]])
        assertEq(evaluate(['()', ['()', stable(skippedOuter), [8]], [2]]), 8)
    },
    rawAndGraphPreparationRetainArityCapturesAndSelfOwnership: () => {
        const count = id(0), a = id(0), b = id(0), self = id(0), captured = id(0)
        const source = /** @type {FastFunction} */ ({ target, parameters: [count, a, b], rest: null, self,
            captures: [{ binding: captured, value: ['array', [4]] }], body: body(['return', target, ['?:', ['>', ref(count), 0],
                ['()', ref(self), [['-', ref(count), 1], ref(b), ['+', ref(a), ref(b)]]], ['array', [ref(a), ref(b), ref(captured)]]]]) })
        const raw = prepareFunction(source)
        assertEq(raw.target, target)
        assertEq(raw.parameters, source.parameters)
        preparedSelfCall(raw, self)
        assertEq(raw.rest, null)
        assertEq(raw.captures[0].binding, captured)
        const graph = fromFast(result(['function', source]))
        const normalized = _tailFunction(graph)
        assert(loops(normalized))
        const prepared = prepareFunction(normalized)
        assertEq(prepared.parameters.length, 3)
        assertEq(prepared.parameters, normalized.parameters)
        assertEq(prepared.self, null)
        assertEq(prepared.rest, null)
        assertEq(prepared.captures.length, 1)
        assertEq(prepared.captures[0].binding, normalized.captures[0].binding)
        const restored = stable(graph)
        assertEq(evaluate(['.', restored, 'length']), 3)
        assertStructurallySame(evaluate(['()', restored, [3, 1, 2]]), [5, 8, [4]])
        const rest = id(0)
        const restSource = /** @type {FastFunction} */ ({ ...source, rest, body: body(['return', target, ['?:', ['>', ref(count), 0],
            ['()', ref(self), [['-', ref(count), 1], ref(b), ['+', ref(a), ref(b)]]], ['array', [ref(rest), ref(captured)]]]]) })
        const rawRest = prepareFunction(restSource)
        assertEq(rawRest.rest, rest)
        preparedSelfCall(rawRest, self)
        assertEq(rawRest.parameters, source.parameters)
        const restGraph = fromFast(result(['function', restSource]))
        const normalRest = _tailFunction(restGraph)
        assert(loops(normalRest))
        assert(normalRest.rest !== null && normalRest.self === null)
        const preparedRest = prepareFunction(normalRest)
        assertEq(preparedRest.rest, normalRest.rest)
        assertEq(preparedRest.self, normalRest.self)
        assertEq(preparedRest.captures.length, 1)
        assertStructurallySame(evaluate(['()', stable(restGraph), [1, 1, 2, 9]]), [[], [4]])
    },
    establishedCanonicalLoopsRoundTripWithoutChangingTheirRoot: () => {
        const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['<', arg(0), 4], recur([['+', arg(0), 1]]), arg(0)]])
        const restored = stable(fn)
        assertStructurallySame(assertOk(analysis(restored)), assertOk(analysis(fn)))
        assertEq(evaluate(['()', restored, [0]]), 4)
    },
})
