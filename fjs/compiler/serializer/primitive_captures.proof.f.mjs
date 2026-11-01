/**
 * Source readback preserves primitive capture values and their evaluation.
 * Repeated writes establish semantic behavior, without a graph/hash fixed point.
 * @import { Exp } from '../../edag/types.ts'
 * @import { Primitive } from '../../media/datajs/types.ts'
 * @import { ValueResult } from '../../edag/value/control/types.ts'
 * @import { Values } from '../../edag/value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { invoke, memo } from '../../edag/memo/module.f.mjs'
import { call } from '../../edag/value/call/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { _defaultExport, unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tryFunctionText, tryStringify } from './module.f.mjs'

/** Shared immutable fixtures also cross the native callable boundary.
 * @type {readonly (readonly [Exp, Primitive])[]}
 */
export const _primitiveCaptureCases = [
    [['undefined'], undefined], [null, null], [false, false], [true, true],
    [0, 0], [-0, -0], [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
    [17n, 17n], [-17n, -17n], ['', ''], ['capture\n"value', 'capture\n"value'],
]

/** @type {Exp} */
const sequence = [',', [['[]', []], ['undefined']]]
/** Equal containers deliberately retain distinct allocation identities. @type {Exp} */
const first = ['[]', []]
/** @type {Exp} */
const second = ['[]', []]

/** @type {{ readonly todo: Exp; readonly ordered: Exp; readonly required: Exp; readonly computed: Exp; readonly snapshots: Exp }} */
export const _primitiveCaptureGraphs = {
    todo: ['[]', [sequence, ['=>', 0, [sequence], ['frame', 0]]]],
    ordered: ['=>', 0, [false, 'first', first, 17n, null, second, -0], ['[]', [
        ['frame', 5], ['frame', 2], ['frame', 6], ['frame', 1],
        ['frame', 3], ['frame', 0], ['frame', 4], ['frame', 2],
    ]]],
    required: ['=>', 1, [], ['?:', ['arg', 0], ['=>', 0, [7, ['throw', 9]], ['[]', [['frame', 0], ['frame', 1]]]], 0]],
    computed: ['=>', 2, [], ['?:', ['arg', 0], ['=>', 0, [[',', [['+', ['arg', 1], 1], 7]]], ['frame', 0]], 0]],
    snapshots: ['=>', 1, [], ['=>', 0, [7, ['arg', 0], ['[]', [['arg', 0]]], 7], ['[]', [
        ['frame', 0], ['frame', 1], ['frame', 2], ['frame', 2], ['frame', 3],
    ]]]],
}

/** Every declared capture remains observable, including an optional self value.
 * @type {(width: number, retainedSelf?: boolean) => Exp}
 */
export const _widePrimitiveCaptureGraph = (width, retainedSelf = false) => ['=>', 0,
    Array.from({ length: width }, (_, index) => index + 1),
    ['[]', [...retainedSelf ? [/** @type {const} */ (['self'])] : [], ...Array.from({ length: width }, /** @returns {Exp} */ (_, index) => ['frame', index])]],
]

/** Eight actual serialize/parse cycles, preserving each resulting program.
 * @type {(root: Exp) => readonly Exp[]}
 */
const versions = root => {
    /** @type {readonly Exp[]} */
    let found = [root]
    let current = root
    for (let cycle = 0; cycle < 8; cycle += 1) {
        const text = assertOk(tryStringify(current))
        const module = unresolved(assertOk(parse('/primitive-captures.f.mjs')(text)))
        assertEq(module.imports.length, 0)
        current = _defaultExport(module.edag)
        found = [...found, current]
    }
    return found
}

/** @type {(root: Exp) => ValueResult} */
const evaluate = root => memo(assertOk(identityAnalysis(root)))({ args: [] })
/** @type {(root: ValueResult, args?: Values) => ValueResult} */
const invokeValue = (root, args = []) => call(root, args.map(value => () => ok(value)), invoke)
/** @type {(value: ValueResult) => unknown} */
const data = value => assertOk(toData(assertOk(value)))

export const proof = /** @type {const} */ ({
    sharedUndefinedSequenceSurvivesEightReadbacks: () => {
        for (const graph of versions(_primitiveCaptureGraphs.todo)) {
            const value = evaluate(graph)
            assertEq(data(read(value, '0')), undefined)
            assertEq(data(invokeValue(read(value, '1'))), undefined)
        }
    },
    repeatedPrimitiveCapturesPreserveTheirExactValue: () => {
        for (const [value, expected] of _primitiveCaptureCases) {
            for (const graph of versions(['=>', 0, [value, value], ['[]', [['frame', 1], ['frame', 0]]]])) {
                const returned = invokeValue(evaluate(graph))
                assert(Object.is(data(read(returned, '0')), expected))
                assert(Object.is(data(read(returned, '1')), expected))
            }
        }
    },
    wideCaptureSignaturesKeepTheirValuesAndSelfIdentity: () => {
        for (const width of [17, 32]) {
            for (const retainedSelf of [false, true]) {
                for (const graph of versions(_widePrimitiveCaptureGraph(width, retainedSelf))) {
                    const fn = evaluate(graph)
                    const result = invokeValue(fn)
                    const offset = retainedSelf ? 1 : 0
                    assertEq(data(read(result, 'length')), width + offset)
                    if (retainedSelf) { assertEq(assertOk(read(result, '0')), assertOk(fn)) }
                    for (let index = 0; index < width; index += 1) {
                        assertEq(data(read(result, String(index + offset))), index + 1)
                    }
                }
            }
        }
    },
    capturePositionsKeepMixedPrimitivesAndAllocationIdentity: () => {
        for (const graph of versions(_primitiveCaptureGraphs.ordered)) {
            const fn = evaluate(graph)
            const returned = invokeValue(fn)
            assertEq(assertOk(read(returned, '1')), assertOk(read(returned, '7')))
            assert(assertOk(read(returned, '0')) !== assertOk(read(returned, '1')))
            assertEq(assertOk(read(returned, '0')), assertOk(read(invokeValue(fn), '0')))
            assert(Object.is(data(read(returned, '2')), -0))
            assertStructurallySame(data(returned), [[], [], -0, 'first', 17n, false, null, []])
        }
    },
    captureFailureRunsOnlyWhenTheClosureIsConstructed: () => {
        for (const graph of versions(_primitiveCaptureGraphs.required)) {
            const choose = evaluate(graph)
            assertEq(data(invokeValue(choose, [false])), 0)
            assertError(invokeValue(choose, [true]))
        }
    },
    computedPrimitiveCapturesRetainReachedPrefixWork: () => {
        for (const graph of versions(_primitiveCaptureGraphs.computed)) {
            const choose = evaluate(graph)
            assertEq(data(invokeValue(choose, [false, 1n])), 0)
            assertEq(data(invokeValue(invokeValue(choose, [true, 2]))), 7)
            assertError(invokeValue(choose, [true, 1n]))
        }
    },
    invocationCapturesKeepTheirSnapshotsAndSharedAllocation: () => {
        for (const graph of versions(_primitiveCaptureGraphs.snapshots)) {
            const make = evaluate(graph)
            const before = invokeValue(make, [2])
            const after = invokeValue(make, [5])
            const first = invokeValue(before)
            const second = invokeValue(after)
            assertStructurallySame(data(first), [7, 2, [2], [2], 7])
            assertStructurallySame(data(second), [7, 5, [5], [5], 7])
            assertEq(assertOk(read(first, '2')), assertOk(read(first, '3')))
            assertEq(assertOk(read(second, '2')), assertOk(read(second, '3')))
            assert(assertOk(read(first, '2')) !== assertOk(read(second, '2')))
            assertEq(assertOk(read(first, '2')), assertOk(read(invokeValue(before), '2')))
        }
    },
    functionTextKeepsPositionalExternalSlots: () => {
        /** @type {Exp} */
        const result = ['[]', [['frame', 2], ['frame', 0], ['frame', 1], ['arg', 0]]]
        const firstText = assertOk(tryFunctionText(['=>', 1, [7, ['[]', []], 7], result]))
        const secondText = assertOk(tryFunctionText(['=>', 1, [null, false, 17n], result]))
        assertEq(firstText, secondText)
        assertEq(firstText, '($3)=>[$2,$0,$1,$3]')
    },
})
