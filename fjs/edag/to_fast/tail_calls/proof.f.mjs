/**
 * Fixed-parameter tail transitions preserve invocation values and ordinary calls.
 *
 * @import { Exp, Args } from '../../types.ts'
 * @import { Function as FastFunction } from '../../../js/ast/types.ts'
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
    for (let generation = 0; generation < 7; ++generation) {
        current = fromFast(assertOk(toFast(current)))
        assertStructurallySame(flat(current), first)
    }
    return current
}

/** @type {(fn: Exp, args: Args) => unknown} */
const run = (fn, args) => evaluate(['()', stable(fn), args])

/** @type {(fn: FastFunction) => boolean} */
const loops = fn => fn.body.statements.some(statement => statement[0] === 'loop')

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
    nonMatchingRecursiveCallsKeepTheirOrdinaryInvocationBoundary: () => {
        const missing = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['[]', [arg(0), arg(1)]]]])
        const extra = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], 7]), arg(0)]])
        const spread = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['...', ['[]', [['-', arg(0), 1]]]]]), arg(0)]])
        for (const fn of [missing, extra, spread]) {
            const normalized = _tailFunction(fn)
            assert(!loops(normalized))
            assert(normalized.self !== null)
        }
        assertStructurallySame(run(missing, [1, 9]), [0, undefined])
        assertEq(run(extra, [3]), 0)
        assertEq(run(spread, [3]), 0)
        const failingExtra = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1], ['throw', 'recursive extra argument']]), 0]])
        failure(['()', fromFast(assertOk(toFast(failingExtra))), [1]])
    },
    restReadsSeeTheRecursiveInvocationInsteadOfTheInitialRest: () => {
        const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], recur([['-', arg(0), 1]]), ['rest']]])
        const normalized = _tailFunction(fn)
        assert(!loops(normalized))
        assert(normalized.rest !== null && normalized.self !== null)
        const prepared = prepareFunction(normalized)
        assertEq(prepared.rest, normalized.rest)
        assertEq(prepared.self, normalized.self)
        assertStructurallySame(run(fn, [2, 7, 8]), [])
        assertStructurallySame(run(fn, [0, 7, 8]), [7, 8])
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
    aSharedLazyCallDemandDoesNotBecomeAnotherTransition: () => {
        const call = recur([['-', arg(0), 1]])
        const fn = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', arg(0), 0], ['?:', ['===', ['%', arg(0), 2], 0], call, call], 'done']])
        assert(!loops(_tailFunction(fn)))
        assert(_tailFunction(fn).self !== null)
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
        assertEq(raw.self, self)
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
        assertEq(rawRest.self, self)
        assertEq(rawRest.parameters, source.parameters)
        const restGraph = fromFast(result(['function', restSource]))
        const normalRest = _tailFunction(restGraph)
        assert(!loops(normalRest))
        assert(normalRest.rest !== null && normalRest.self !== null)
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
