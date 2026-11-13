/**
 * Primitive captures cross the generated JavaScript callable boundary. Pure
 * proofs inspect EDAG values; they cannot load emitted modules or call their
 * ordinary host closures. Every source version is parsed before native use.
 * @import { Exp } from '../../../edag/types.ts'
 */

import { throws } from 'node:assert/strict'
import { Buffer } from 'node:buffer'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { _primitiveCaptureCases, _primitiveCaptureGraphs, _widePrimitiveCaptureGraph } from '../primitive_captures.proof.f.mjs'
import { tryFunctionText, tryStringify } from '../module.f.mjs'

/** Eight real source writes/readbacks; no graph or text identity is promised.
 * @type {(root: Exp) => readonly string[]}
 */
const sources = root => {
    let current = root
    /** @type {readonly string[]} */
    let found = []
    for (let cycle = 0; cycle < 8; cycle += 1) {
        const source = assertOk(tryStringify(current))
        current = _defaultExport(unresolved(assertOk(parse('/native-primitive-captures.f.mjs')(source))).edag)
        found = [...found, source]
    }
    return found
}

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default

export const proof = /** @type {const} */ ({
    undefinedSequenceKeepsItsClosureAcrossEightReadbacks: async () => {
        for (const source of sources(_primitiveCaptureGraphs.todo)) {
            const value = await load(source)
            assertEq(value[0], undefined)
            assertEq(value[1](), undefined)
            assertEq(value[1].length, 0)
        }
    },
    primitiveCapturesKeepExactNativeValuesAndArity: async () => {
        for (const [value, expected] of _primitiveCaptureCases) {
            for (const source of sources(['=>', 0, [value, value], ['[]', [['frame', 1], ['frame', 0]]]])) {
                const fn = await load(source)
                assertEq(fn.length, 0)
                const result = fn()
                assert(Object.is(result[0], expected))
                assert(Object.is(result[1], expected))
            }
        }
    },
    wideCaptureFactoriesKeepCallableArityAndSelfIdentity: async () => {
        for (const width of [17, 32]) {
            for (const retainedSelf of [false, true]) {
                for (const source of sources(_widePrimitiveCaptureGraph(width, retainedSelf))) {
                    const fn = await load(source)
                    assertEq(fn.length, 0)
                    const result = fn()
                    const offset = retainedSelf ? 1 : 0
                    assertEq(result.length, width + offset)
                    if (retainedSelf) { assertEq(result[0], fn) }
                    for (let index = 0; index < width; index += 1) {
                        assertEq(result[index + offset], index + 1)
                    }
                }
            }
        }
    },
    widePrimitiveCapturesKeepDeepSelfTailIdentity: async () => {
        const captured = _widePrimitiveCaptureGraph(32, true)
        assert(captured instanceof Array && captured[0] === '=>')
        /** @type {Exp} */
        const graph = ['=>', 1, captured[2], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1]]], captured[3],
        ]]
        for (const source of sources(graph)) {
            assert(source.includes('while('), source)
            const fn = await load(source)
            assertEq(fn.length, 1)
            const result = fn(100_001)
            assertEq(result[0], fn)
            assertStructurallySame(result.slice(1), Array.from({ length: 32 }, (_, index) => index + 1))
        }
    },
    mixedCapturePositionsKeepSharedAndDistinctAllocations: async () => {
        for (const source of sources(_primitiveCaptureGraphs.ordered)) {
            const fn = await load(source)
            const first = fn()
            const second = fn()
            assertEq(first[1], first[7])
            assert(first[0] !== first[1])
            assertEq(first[0], second[0])
            assertEq(first[1], second[1])
            assert(Object.is(first[2], -0))
            assertStructurallySame(first, [[], [], -0, 'first', 17n, false, null, []])
        }
    },
    captureFailuresRemainRequiredAndSelected: async () => {
        for (const source of sources(_primitiveCaptureGraphs.required)) {
            const choose = await load(source)
            assertEq(choose(false), 0)
            throws(() => choose(true))
        }
    },
    computedCapturesKeepTheirRequiredPrefix: async () => {
        for (const source of sources(_primitiveCaptureGraphs.computed)) {
            const choose = await load(source)
            assertEq(choose(false, 1n), 0)
            assertEq(choose(true, 2)(), 7)
            throws(() => choose(true, 1n))
        }
    },
    invocationCapturesRetainTheirOriginalSnapshots: async () => {
        for (const source of sources(_primitiveCaptureGraphs.snapshots)) {
            const make = await load(source)
            const before = make(2)
            const after = make(5)
            const first = before()
            const second = after()
            assertStructurallySame(first, [7, 2, [2], [2], 7])
            assertStructurallySame(second, [7, 5, [5], [5], 7])
            assertEq(first[2], first[3])
            assertEq(second[2], second[3])
            assert(first[2] !== second[2])
            assertEq(first[2], before()[2])
        }
    },
    primitiveCapturesKeepSelfTailCallsInWhile: async () => {
        /** @type {Exp} */
        const graph = ['=>', 1, [7], ['?:', ['>', ['arg', 0], 0], ['()', ['self'], [['-', ['arg', 0], 1]]], ['frame', 0]]]
        for (const source of sources(graph)) {
            assert(source.includes('while('), source)
            const fn = await load(source)
            assertEq(fn.length, 1)
            assertEq(fn(0), 7)
            assertEq(fn(100_001), 7)
        }
    },
    functionTextKeepsExternalCapturePositions: async () => {
        /** @type {Exp} */
        const graph = ['=>', 1, [7, ['[]', []], 9], ['[]', [['frame', 2], ['frame', 0], ['frame', 1], ['arg', 0]]]]
        const text = assertOk(tryFunctionText(graph))
        assertEq(text, '($3)=>[$2,$0,$1,$3]')
        const fn = await load(`const $0=7;const $1=[];const $2=9;export default ${text};`)
        const first = fn(4)
        const second = fn(5)
        assertStructurallySame(first, [9, 7, [], 4])
        assertStructurallySame(second, [9, 7, [], 5])
        assertEq(first[2], second[2])
    },
})
