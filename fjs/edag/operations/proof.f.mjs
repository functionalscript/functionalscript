/**
 * The shared dispatcher threads an interpreter's immutable state through only
 * demanded operands. Operands here use Amnesia, while the state records each
 * demand so evaluation order and failure propagation remain observable.
 *
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { Closure, EdagValue, Runtime } from '../value/types.ts'
 * @import { Outcome } from '../value/call/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Context, Evaluator } from './types.ts'
 */

import { conditional } from '../testlib.f.js'
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { invokerWith, noBoolean, noIn, operation, staticCall } from './module.f.mjs'
import { read } from '../value/property/module.f.js'
import runtimeEdag from '../../js/runtime/gen.edag.js'
import { noRefMap, noStatic, staticIds, staticPath } from '../module.f.js'
import { isNative } from '../../js/static/module.f.js'
import { invoke, invokeWith, vm } from '../amnesia/module.f.mjs'
import { settle } from '../value/call/module.f.js'

/** @type {Context} */
const context = { frame: ['F'], args: [10, 20], fixed: [4], rest: ['[]', [5]] }
/** @type {Evaluator<Exp, readonly Exp[]>} */
const evaluator = {
    context,
    operand: (e, state) => [[...state, e], vm(context)(e)],
    tail: (e, state) => [[...state, e], vm(context)(e)],
    expression: e => e,
    invoke,
}
const dispatch = operation(evaluator)

/** The node's outcome with the call it leaves, if one, made. @type {(e: ExpOp, state: readonly Exp[]) => readonly [readonly Exp[], import('../value/control/types.ts').ValueResult]} */
const run = (e, state) => {
    const [next, outcome] = dispatch(e, state)
    return [next, settle(invoke)(outcome)]
}

/** @type {(e: ExpOp, expected: EdagValue) => void} */
const eq = (e, expected) => { assertStructurallySame(run(e, [])[1], ['ok', expected]) }
/** @type {(e: ExpOp, expected?: EdagValue) => void} */
const failure = (e, expected = ['undefined']) => { assertStructurallySame(run(e, [])[1], ['error', expected]) }
/** @type {import('../types.ts').Function} */
const identity = ['=>', 1, [], ['arg', 0]]

/** A runtime whose `in` is a function of two parameters with the body given. @type {(body: Exp) => Runtime} */
const inRuntime = body => ['{}', [[':', 'in', ['=>', 2, [], body]]]]

/** A runtime whose Boolean conversion has the supplied body. @type {(body: Exp) => Runtime} */
const booleanRuntime = body => ['{}', [[':', 'Boolean', ['=>', 1, [], body]]]]

/** A node evaluated under the executor's context with the runtime given, or none. @type {(runtime: Runtime | undefined, node: Exp) => unknown} */
const under = (runtime, node) => vm({ ...context, runtime })(node)
/** @type {import('../types.ts').Object} */
const throws = ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'conversion']]]]]

export const proof = /** @type {const} */ ({
    booleanConversion: () => {
        const echo = booleanRuntime(['arg', 0])
        assertStructurallySame(under(echo, ['Boolean', 7]), ['ok', 7])
        assertStructurallySame(under(booleanRuntime(false), ['Boolean', 7]), ['ok', false])
        assertStructurallySame(under(booleanRuntime(['throw', 'runtime body']), ['Boolean', 7]), ['error', 'runtime body'])
        assertStructurallySame(under(booleanRuntime(['throw', 'runtime body']), ['Boolean', ['throw', 'operand']]), ['error', 'operand'])
        failure(['Boolean', 7], noBoolean)
        failure(['Boolean', ['throw', 'operand']], 'operand')
        for (const missing of [/** @type {Runtime} */ (['{}', []]), /** @type {Runtime} */ (['{}', [[':', 'Boolean', 0]]])]) {
            assertStructurallySame(under(missing, ['Boolean', 7]), ['error', noBoolean])
        }

        const evaluate = operation({ ...evaluator, context: { ...context, runtime: echo }, invoke: invokeWith(echo) })
        const operand = /** @type {const} */ (['+', 2, 3])
        const [next, outcome] = evaluate(['Boolean', operand], [])
        assertStructurallySame(next, [operand])
        assertStructurallySame(settle(invokeWith(echo))(outcome), ['ok', 5])

        const real = /** @type {Runtime} */ (assertOk(read(vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))), 'runtime')))
        for (const [source, expected] of /** @type {readonly (readonly [Exp, boolean])[]} */ ([
            [null, false], [['undefined'], false], [false, false], [0, false], [-0, false],
            [NaN, false], [0n, false], ['', false],
            [true, true], [1, true], [-1, true], [Infinity, true], [1n, true], ['0', true],
            [['[]', []], true], [['{}', []], true], [['=>', 0, [], ['throw', 'not called']], true],
            [['Object.entries'], true],
        ])) {
            assertStructurallySame(under(real, ['Boolean', source]), ['ok', expected])
        }
        const conversionHooks = /** @type {const} */ (['{}', [
            [':', 'valueOf', ['=>', 0, [], ['throw', 'valueOf must not run']]],
            [':', 'toString', ['=>', 0, [], ['throw', 'toString must not run']]],
        ]])
        assertStructurallySame(under(real, ['Boolean', conversionHooks]), ['ok', true])
    },
    fromCharCode: () => {
        eq(['String.fromCharCode'], ['String.fromCharCode'])
        eq(['.', ['String.fromCharCode'], 'length'], 1)
        eq(['String', ['String.fromCharCode']], 'function fromCharCode() { [native code] }')
        eq(['===', ['String.fromCharCode'], ['String.fromCharCode']], true)
        eq(['()', ['String.fromCharCode'], []], '')
        eq(['()', ['String.fromCharCode'], [5, 6]], '\u0005\u0006')
        eq(['()', ['String.fromCharCode'], [0xd800, 0xdc00, -1, 0x1_0041, 65.9, NaN, Infinity]], '\ud800\udc00\uffffAA\u0000\u0000')
        eq(['()', ['String.fromCharCode'], [true, null, ['undefined'], '66', ['[]', [67]]]], '\u0001\u0000\u0000BC')
        failure(['()', ['String.fromCharCode'], [65, 1n]])
    },
    mathMin: {
        numbers: () => {
            for (const [args, expected] of /** @type {readonly (readonly [readonly Exp[], number])[]} */ ([
                [[], Infinity], [[1], 1], [[Infinity], Infinity],
                [[4, 1, 2, 3], 1], [[-2, -4, -3], -4],
                [[Infinity, 1, -Infinity, 2], -Infinity], [[NaN], NaN],
                [[NaN, 1, -Infinity], NaN], [[1, NaN, 2], NaN], [[-Infinity, NaN], NaN],
                [[0], 0], [[0, 0], 0], [[-0], -0], [[0, -0], -0], [[-0, 0], -0],
                [[-5e-324, 0], -5e-324], [[-5e-324, 5e-324], -5e-324],
                [[0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000], 0x1f_ffff_ffff_ffff],
                [[1.7976931348623157e308, -1.7976931348623157e308], -1.7976931348623157e308],
            ])) { eq(['()', ['Math.min'], args], expected) }
        },
        conversion: () => {
            eq(['()', ['Math.min'], [' -0 ', false, null, true, ' 0x10 ', ['[]', [9]], ['[]', [25n]]]], -0)
            eq(['()', ['Math.min'], [['undefined']]], NaN)
            eq(['()', ['Math.min'], [['{}', []]]], NaN)
            eq(['()', ['Math.min'], [['[]', []]]], 0)
            const fallback = /** @type {const} */ (['{}', [
                [':', 'valueOf', ['=>', 0, [], ['{}', []]]],
                [':', 'toString', ['=>', 0, [], '-12']],
            ]])
            eq(['()', ['Math.min'], [3, fallback, 4]], -12)
            const first = /** @type {const} */ (['{}', [
                [':', 'valueOf', ['=>', 0, [], -8]],
                [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]],
            ]])
            eq(['()', ['Math.min'], [first, 2, 3]], -8)
            const right = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'right']]]]])
            const bigintObject = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]])
            failure(['()', ['Math.min'], [1n, right]])
            failure(['()', ['Math.min'], [throws, right]], 'conversion')
            failure(['()', ['Math.min'], [1, 2, right]], 'right')
            failure(['()', ['Math.min'], [NaN, right]], 'right')
            failure(['()', ['Math.min'], [-Infinity, right]], 'right')
            failure(['()', ['Math.min'], [NaN, 1n]])
            failure(['()', ['Math.min'], [-Infinity, bigintObject]])
            failure(['()', ['Math.min'], [bigintObject, right]])
            failure(['()', ['Math.min'], [throws, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.min'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.min'], ['Math.min'])
            eq(['.', ['Math.min'], 'length'], 2)
            eq(['String', ['Math.min']], 'function min() { [native code] }')
            eq(['===', ['Math.min'], ['Math.min']], true)
            eq(['===', ['Math.min'], ['Math.max']], false)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.min'], [2, 1, 3]]), ['ok', 1])
        },
    },
    mathMax: {
        numbers: () => {
            for (const [args, expected] of /** @type {readonly (readonly [readonly Exp[], number])[]} */ ([
                [[], -Infinity], [[1], 1], [[-Infinity], -Infinity],
                [[1, 4, 2, 3], 4], [[-4, -2, -3], -2],
                [[-Infinity, 1, Infinity, 2], Infinity], [[NaN], NaN],
                [[NaN, 1, Infinity], NaN], [[1, NaN, 2], NaN], [[Infinity, NaN], NaN],
                [[-0], -0], [[-0, -0], -0], [[0, -0], 0], [[-0, 0], 0],
                [[-5e-324, -0], -0], [[-5e-324, 5e-324], 5e-324],
                [[0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000], 0x20_0000_0000_0000],
                [[-1.7976931348623157e308, 1.7976931348623157e308], 1.7976931348623157e308],
            ])) { eq(['()', ['Math.max'], args], expected) }
        },
        conversion: () => {
            eq(['()', ['Math.max'], [' -0 ', false, null, true, ' 0x10 ', ['[]', [9]], ['[]', [25n]]]], 25)
            eq(['()', ['Math.max'], [['undefined']]], NaN)
            eq(['()', ['Math.max'], [['{}', []]]], NaN)
            eq(['()', ['Math.max'], [['[]', []]]], 0)
            const fallback = /** @type {const} */ (['{}', [
                [':', 'valueOf', ['=>', 0, [], ['{}', []]]],
                [':', 'toString', ['=>', 0, [], '12']],
            ]])
            eq(['()', ['Math.max'], [3, fallback, 4]], 12)
            const first = /** @type {const} */ (['{}', [
                [':', 'valueOf', ['=>', 0, [], 8]],
                [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]],
            ]])
            eq(['()', ['Math.max'], [first, 2, 3]], 8)
            const right = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'right']]]]])
            const bigintObject = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]])
            failure(['()', ['Math.max'], [1n, right]])
            failure(['()', ['Math.max'], [throws, right]], 'conversion')
            failure(['()', ['Math.max'], [1, 2, right]], 'right')
            failure(['()', ['Math.max'], [NaN, right]], 'right')
            failure(['()', ['Math.max'], [Infinity, right]], 'right')
            failure(['()', ['Math.max'], [NaN, 1n]])
            failure(['()', ['Math.max'], [Infinity, bigintObject]])
            failure(['()', ['Math.max'], [bigintObject, right]])
            failure(['()', ['Math.max'], [throws, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.max'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.max'], ['Math.max'])
            eq(['.', ['Math.max'], 'length'], 2)
            eq(['String', ['Math.max']], 'function max() { [native code] }')
            eq(['===', ['Math.max'], ['Math.max']], true)
            eq(['===', ['Math.max'], ['Math.imul']], false)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.max'], [1, 3, 2]]), ['ok', 3])
        },
    },
    mathSqrt: {
        numbers: () => {
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, NaN],
                [0, 0], [-0, -0], [1, 1], [4, 2], [2, 1.4142135623730951],
                [-1, NaN], [-5e-324, NaN], [5e-324, 2.2227587494850775e-162],
                [1.7976931348623157e308, 1.3407807929942596e154],
            ]) { eq(['()', ['Math.sqrt'], [value]], expected) }
            eq(['()', ['Math.sqrt'], []], NaN)
        },
        conversion: () => {
            for (const [value, expected] of /** @type {readonly (readonly [Exp, number])[]} */ ([
                ['', 0], [' -0 ', -0], [' 0x10 ', 4], ['Infinity', Infinity], ['bad', NaN],
                [true, 1], [false, 0], [null, 0], [['undefined'], NaN],
                [['[]', []], 0], [['[]', [9]], 3], [['[]', [16n]], 4], [['{}', []], NaN],
                [['{}', [[':', 'valueOf', ['=>', 0, [], 25]], [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]]]], 5],
                [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '36']]]], 6],
            ])) { eq(['()', ['Math.sqrt'], [value]], expected) }
            eq(['()', ['Math.sqrt'], [16, throws]], 4)
            failure(['()', ['Math.sqrt'], [throws, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.sqrt'], [1n]])
            failure(['()', ['Math.sqrt'], [['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]]]])
            failure(['()', ['Math.sqrt'], [throws]], 'conversion')
            failure(['()', ['Math.sqrt'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.sqrt'], ['Math.sqrt'])
            eq(['.', ['Math.sqrt'], 'length'], 1)
            eq(['String', ['Math.sqrt']], 'function sqrt() { [native code] }')
            eq(['===', ['Math.sqrt'], ['Math.sqrt']], true)
            eq(['===', ['Math.sqrt'], ['Math.abs']], false)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.sqrt'], [4]]), ['ok', 2])
        },
    },
    mathCeil: {
        numbers: () => {
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 1], [-0.5, -0],
                [1.9, 2], [-1.9, -1], [5e-324, 1], [-5e-324, -0],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, -1.7976931348623157e308],
            ]) { eq(['()', ['Math.ceil'], [value]], expected) }
            eq(['()', ['Math.ceil'], []], NaN)
        },
        conversion: () => {
            for (const [value, expected] of /** @type {readonly (readonly [Exp, number])[]} */ ([
                ['', 0], [' -0 ', -0], [' -0.5 ', -0], [' 0x10 ', 16], ['Infinity', Infinity], ['bad', NaN],
                [true, 1], [false, 0], [null, 0], [['undefined'], NaN],
                [['[]', []], 0], [['[]', [8.9]], 9], [['[]', [8n]], 8], [['{}', []], NaN],
                [['{}', [[':', 'valueOf', ['=>', 0, [], 2.9]], [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]]]], 3],
                [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '-3.9']]]], -3],
            ])) { eq(['()', ['Math.ceil'], [value]], expected) }
            eq(['()', ['Math.ceil'], [4.9, throws]], 5)
            failure(['()', ['Math.ceil'], [throws, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.ceil'], [1n]])
            failure(['()', ['Math.ceil'], [['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]]]])
            failure(['()', ['Math.ceil'], [throws]], 'conversion')
            failure(['()', ['Math.ceil'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.ceil'], ['Math.ceil'])
            eq(['.', ['Math.ceil'], 'length'], 1)
            eq(['String', ['Math.ceil']], 'function ceil() { [native code] }')
            eq(['===', ['Math.ceil'], ['Math.ceil']], true)
            eq(['===', ['Math.ceil'], ['Math.floor']], false)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.ceil'], [-1.9]]), ['ok', -1])
        },
    },
    mathImul: {
        numbers: () => {
            for (const [left, right, expected] of [
                [2, 3, 6], [-2, 3, -6], [0, -1, 0], [-0, 1, 0],
                [0xffff_ffff, 5, -5], [0x8000_0000, -1, -0x8000_0000],
                [0x7fff_ffff, 2, -2], [0x1_0000_0001, 2, 2],
                [0x20_0000_0000_0002, 3, 6], [-1.9, 2.9, -2],
                [NaN, 3, 0], [Infinity, 2, 0], [-Infinity, 2, 0], [5e-324, 3, 0],
            ]) { eq(['()', ['Math.imul'], [left, right]], expected) }
            eq(['()', ['Math.imul'], []], 0)
            eq(['()', ['Math.imul'], [5]], 0)
        },
        conversion: () => {
            eq(['()', ['Math.imul'], [' 0xffff ', ['[]', [2]]]], 0x1_fffe)
            eq(['()', ['Math.imul'], [true, ['[]', [8n]]]], 8)
            eq(['()', ['Math.imul'], [null, ['undefined']]], 0)
            eq(['()', ['Math.imul'], [['{}', []], 3]], 0)
            eq(['()', ['Math.imul'], [3, ['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '4']]]]]], 12)
            eq(['()', ['Math.imul'], [3, 4, throws]], 12)
            failure(['()', ['Math.imul'], [throws, 4, ['throw', 'argument']]], 'argument')
            const right = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'right']]]]])
            // A failed left conversion prevents the right; even zero requires converting the right.
            failure(['()', ['Math.imul'], [throws, right]], 'conversion')
            failure(['()', ['Math.imul'], [1n, right]])
            failure(['()', ['Math.imul'], [0, right]], 'right')
            failure(['()', ['Math.imul'], [3, 1n]])
            const bigintObject = /** @type {const} */ (['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]])
            failure(['()', ['Math.imul'], [3, bigintObject]])
            failure(['()', ['Math.imul'], [bigintObject, right]])
            failure(['()', ['Math.imul'], [3, ['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.imul'], ['Math.imul'])
            eq(['.', ['Math.imul'], 'length'], 2)
            eq(['String', ['Math.imul']], 'function imul() { [native code] }')
            eq(['===', ['Math.imul'], ['Math.imul']], true)
            eq(['===', ['Math.imul'], ['Math.sqrt']], false)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.imul'], [2, 3]]), ['ok', 6])
        },
    },
    mathAbs: {
        numbers: () => {
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, Infinity],
                [0, 0], [-0, 0], [0.5, 0.5], [-0.5, 0.5],
                [1.9, 1.9], [-1.9, 1.9], [5e-324, 5e-324], [-5e-324, 5e-324],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [-0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, 1.7976931348623157e308],
            ]) { eq(['()', ['Math.abs'], [value]], expected) }
            eq(['()', ['Math.abs'], []], NaN)
        },
        conversion: () => {
            for (const [value, expected] of /** @type {readonly (readonly [Exp, number])[]} */ ([
                ['', 0], [' -0 ', 0], [' -0.5 ', 0.5], [' 0x10 ', 16], ['-Infinity', Infinity], ['bad', NaN],
                [true, 1], [false, 0], [null, 0], [['undefined'], NaN],
                [['[]', []], 0], [['[]', [-8.9]], 8.9], [['[]', [-8n]], 8], [['{}', []], NaN],
                [['{}', [[':', 'valueOf', ['=>', 0, [], -2.9]], [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]]]], 2.9],
                [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '-3.9']]]], 3.9],
            ])) { eq(['()', ['Math.abs'], [value]], expected) }
            eq(['()', ['Math.abs'], [-4.9, throws]], 4.9)
            failure(['()', ['Math.abs'], [-4.9, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.abs'], [1n]])
            failure(['()', ['Math.abs'], [['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]]]])
            failure(['()', ['Math.abs'], [throws]], 'conversion')
            failure(['()', ['Math.abs'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.abs'], ['Math.abs'])
            eq(['.', ['Math.abs'], 'length'], 1)
            eq(['String', ['Math.abs']], 'function abs() { [native code] }')
            eq(['===', ['Math.abs'], ['Math.abs']], true)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.abs'], [-1.9]]), ['ok', 1.9])
        },
    },
    mathFloor: {
        numbers: () => {
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 0], [-0.5, -1],
                [1.9, 1], [-1.9, -2], [5e-324, 0], [-5e-324, -1],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, -1.7976931348623157e308],
            ]) { eq(['()', ['Math.floor'], [value]], expected) }
            eq(['()', ['Math.floor'], []], NaN)
        },
        conversion: () => {
            for (const [value, expected] of /** @type {readonly (readonly [Exp, number])[]} */ ([
                ['', 0], [' -0 ', -0], [' -0.5 ', -1], [' 0x10 ', 16], ['Infinity', Infinity], ['bad', NaN],
                [true, 1], [false, 0], [null, 0], [['undefined'], NaN],
                [['[]', []], 0], [['[]', [8.9]], 8], [['[]', [8n]], 8], [['{}', []], NaN],
                [['{}', [[':', 'valueOf', ['=>', 0, [], 2.9]], [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]]]], 2],
                [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '-3.9']]]], -4],
            ])) { eq(['()', ['Math.floor'], [value]], expected) }
            eq(['()', ['Math.floor'], [4.9, throws]], 4)
            failure(['()', ['Math.floor'], [4.9, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.floor'], [1n]])
            failure(['()', ['Math.floor'], [['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]]]])
            failure(['()', ['Math.floor'], [throws]], 'conversion')
            failure(['()', ['Math.floor'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.floor'], ['Math.floor'])
            eq(['.', ['Math.floor'], 'length'], 1)
            eq(['String', ['Math.floor']], 'function floor() { [native code] }')
            eq(['===', ['Math.floor'], ['Math.floor']], true)
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.floor'], [-1.9]]), ['ok', -2])
        },
    },
    mathTrunc: {
        numbers: () => {
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 0], [-0.5, -0],
                [1.9, 1], [-1.9, -1], [5e-324, 0], [-5e-324, -0],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
            ]) { eq(['()', ['Math.trunc'], [value]], expected) }
            eq(['()', ['Math.trunc'], []], NaN)
        },
        conversion: () => {
            for (const [value, expected] of /** @type {readonly (readonly [Exp, number])[]} */ ([
                ['', 0], [' -0.5 ', -0], [' 0x10 ', 16], ['Infinity', Infinity], ['bad', NaN],
                [true, 1], [false, 0], [null, 0], [['undefined'], NaN],
                [['[]', []], 0], [['[]', [8.9]], 8], [['[]', [8n]], 8], [['{}', []], NaN],
                [['{}', [[':', 'valueOf', ['=>', 0, [], 2.9]], [':', 'toString', ['=>', 0, [], ['throw', 'unreached']]]]], 2],
                [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '-3.9']]]], -3],
            ])) { eq(['()', ['Math.trunc'], [value]], expected) }
            // Only the first argument is converted, while every argument expression runs.
            eq(['()', ['Math.trunc'], [4.9, throws]], 4)
            failure(['()', ['Math.trunc'], [4.9, ['throw', 'argument']]], 'argument')
            failure(['()', ['Math.trunc'], [1n]])
            failure(['()', ['Math.trunc'], [['{}', [[':', 'valueOf', ['=>', 0, [], 1n]]]]]])
            failure(['()', ['Math.trunc'], [throws]], 'conversion')
            failure(['()', ['Math.trunc'], [['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], ['[]', []]]]]]]])
        },
        nativeFunction: () => {
            eq(['Math.trunc'], ['Math.trunc'])
            eq(['.', ['Math.trunc'], 'length'], 1)
            eq(['String', ['Math.trunc']], 'function trunc() { [native code] }')
            eq(['===', ['Math.trunc'], ['Math.trunc']], true)
            // Native binding is independent of the common runtime's static lookup.
            const throwing = /** @type {Runtime} */ (['{}', [[':', 'static', ['=>', 1, [], ['throw', 'unused runtime']]]]])
            assertStructurallySame(under(throwing, ['()', ['Math.trunc'], [1.9]]), ['ok', 1])
        },
    },
    bigintConversion: () => {
        eq(['BigInt', '9007199254740993'], 9_007_199_254_740_993n)
        eq(['BigInt', ['[]', [7]]], 7n)
        eq(['BigInt', ['[]', []]], 0n)
        eq(['BigInt', ['{}', [[':', 'valueOf', ['=>', 0, [], 9]]]]], 9n)
        eq(['BigInt', ['{}', [[':', 'valueOf', ['=>', 0, [], ['{}', []]]], [':', 'toString', ['=>', 0, [], '12']]]]], 12n)
        failure(['BigInt', 1.5])
        failure(['BigInt', ['[]', [1, 2]]])
        failure(['BigInt', ['{}', []]])
        failure(['BigInt', throws], 'conversion')
        failure(['BigInt', ['throw', 'operand']], 'operand')
    },
    // `self` is the function being invoked, the same value every read, so
    // a body calls itself through it and compares it to itself as one;
    // outside a function there is none, and the evaluator throws
    self: () => {
        /** @type {Exp} */
        const fact = ['=>', 1, [], ['?:', ['<', ['arg', 0], 2], 1, ['*', ['arg', 0], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]
        eq(['()', fact, [5]], 120)
        eq(['()', ['=>', 0, [], ['===', ['self'], ['self']]], []], true)
        // a nested function reaches its parent's `self` through a slot
        eq(['()', ['=>', 1, [], ['?:', ['arg', 0], ['()', ['=>', 0, [['self']], ['()', ['frame', 0], [0]]], []], 'base']], [1]], 'base')
        failure(['self'])
    },
    operators: () => {
        eq(['!', 0], true)
        eq(['~', 0], -1)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
        eq(['typeof', 1n], 'bigint')
        // `instanceof Array`: an array's own tag and nothing else, never a
        // throw — `null`, `undefined`, an object and a function included
        eq(['instanceof', ['[]', []], 'Array'], true)
        eq(['instanceof', ['[]', [1, ['[]', []]]], 'Array'], true)
        eq(['instanceof', ['{}', []], 'Array'], false)
        eq(['instanceof', null, 'Array'], false)
        eq(['instanceof', ['undefined'], 'Array'], false)
        eq(['instanceof', 'a', 'Array'], false)
        eq(['instanceof', 1, 'Array'], false)
        eq(['instanceof', identity, 'Array'], false)
        eq(['+', '5'], 5)
        eq(['-', 5], -5)
        eq(['+', 2, 3], 5)
        eq(['-', 2, 3], -1)
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['!==', 2, 3], true)
        eq(['<', 2, 3], true)
        eq(['<=', 3, 3], true)
        eq(['>', 2, 3], false)
        eq(['>=', 3, 3], true)
        eq(['&', 6, 3], 2)
        eq(['|', 6, 3], 7)
        eq(['^', 6, 3], 5)
        eq(['<<', 1, 3], 8)
        eq(['>>', -8, 1], -4)
        eq(['>>>', -1, 31], 1)
        eq(conditional("&&", 0, 1), 0)
        eq(conditional("&&", 2, 1), 1)
        eq(conditional("||", 0, 1), 1)
        eq(conditional("||", 2, 1), 2)
        eq(conditional("??", null, 1), 1)
        eq(conditional("??", 0, 1), 0)
        eq(['?:', true, 1, 2], 1)
        eq(['?:', false, 1, 2], 2)
        eq([',', [1, 2]], 2)
        eq([',', []], ['undefined'])
    },
    context: () => {
        eq(['undefined'], ['undefined'])
        eq(['frame', 0], 'F')
        eq(['args'], ['[]', [10, 20]])
        eq(['arg', 0], 4)
        eq(['rest'], ['[]', [5]])
    },
    containers: () => {
        eq(['[]', [1, ['...', ['[]', [2, 3]]]]], ['[]', [1, 2, 3]])
        eq(['{}', [[':', 'a', 1], ['...', ['{}', [[':', 'b', 2]]]]]], ['{}', [[':', 'a', 1], [':', 'b', 2]]])
        eq(['{}', [[':', 1, 2]]], ['{}', [[':', '1', 2]]])
        failure(['[]', [['...', null]]])
        failure(['{}', [['...', ['throw', 'spread']]]], 'spread')
        failure(['{}', [[':', ['{}', [[':', 'toString', ['=>', 0, [], ['throw', 'key']]]]], 1]]], 'key')
        failure(['{}', [[':', 'key', ['throw', 'value']]]], 'value')
    },
    reads: () => {
        const object = /** @type {const} */ (['{}', [[':', 'a', 7]]])
        eq(['.', object, 'a'], 7)
        eq(['()', ['entry'], [object, 'a']], 7)
        eq(['?.', null, 'a'], ['undefined'])
        eq(['?.', object, 'a'], 7)
        eq(['?.', ['{}', [[':', 'a', object]]], 'a', ['|.', 'a']], 7)
        eq(['()', ['entry'], [object, 1]], ['undefined'])
        failure(['()', ['entry'], [null, 'a']])
        eq(['()', ['hasEntry'], [object, 'a']], true)
        eq(['()', ['hasEntry'], [object, 1]], false)
        eq(['()', ['hasEntry'], [['{}', [[':', 'u', ['undefined']]]], 'u']], true)
        failure(['()', ['hasEntry'], [null, 'a']])
        // the empty reference map is vocabulary only: its read is refused
        failure(['refMap'], noRefMap)
        failure(['()', ['refMap'], [object]], noRefMap)
        eq(['()', ['slice'], ['abc', 1]], 'bc')
        eq(['()', ['slice'], [['{}', [[':', 'slice', ['=>', 0, [], 7]]]], 1]], 7)
        failure(['()', ['slice'], [null, 1]])
        failure(['()', ['slice'], [['{}', []], 1]])
        eq(['()', ['charCodeAt'], ['abc', 2]], 0x63)
        failure(['()', ['charCodeAt'], [null, 0]])
        failure(['.', null, 'a', ['|()', []]])
    },
    memberPresent: () => {
        for (const value of [null, ['undefined']]) {
            for (const name of ['field', 'toString']) {
                eq(['memberPresent', ['{}', [[':', name, /** @type {Exp} */ (value)]]], name], false)
            }
        }
        for (const value of [0, false, '', identity]) {
            eq(['memberPresent', ['{}', [[':', 'field', /** @type {Exp} */ (value)]]], 'field'], true)
        }
        eq(['memberPresent', ['{}', []], 'missing'], false)
        eq(['memberPresent', ['{}', []], 'toString'], true)
        eq(['memberPresent', ['[]', []], 'length'], true)
        eq(['memberPresent', ['[]', [0]], 0], true)
        eq(['memberPresent', ['[]', [null]], ['Number', '0']], false)
        eq(['memberPresent', ['[]', [['undefined']]], 0], false)
        eq(['memberPresent', ['[]', []], 0], false)
        eq(['memberPresent', '', 'length'], true)
        eq(['memberPresent', 'abc', ['Number', '1']], true)
        eq(['memberPresent', 'abc', 3], false)
        eq(['memberPresent', identity, 'length'], true)
        eq(['memberPresent', ['entry'], 'length'], true)
        eq(['memberPresent', ['Object.entries'], 'length'], true)
        eq(['memberPresent', 'abc', 'slice'], true)
        eq(['memberPresent', 'abc', 'startsWith'], false)
        eq(['memberPresent', 'abc', 'codePointAt'], false)
        failure(['memberPresent', null, 'field'])
        failure(['memberPresent', ['undefined'], 'field'])
        // A false answer does not stop an ordinary call's argument region;
        // a selected optional region can use it to skip that region.
        eq([',', [['memberPresent', ['{}', []], 'missing'], 7]], 7)
        eq(['?:', ['memberPresent', ['{}', []], 'missing'], ['throw', 'skipped'], 7], 7)
        failure([',', [['memberPresent', null, 'missing'], 7]])
    },
    // The entry check: the runtime's `in` body called with the key, read
    // from the node, and the evaluated operand, in that order; its answer
    // or its throw is the node's, the operand's failure comes first, and
    // an executor with no runtime, or a runtime without the body, refuses
    // the operator by name.
    inOperator: () => {
        const echo = inRuntime(['[]', [['arg', 0], ['arg', 1]]])
        assertStructurallySame(under(echo, ['in', 'x', 5]), ['ok', ['[]', ['x', 5]]])
        assertStructurallySame(under(echo, ['in', '', ['{}', []]]), ['ok', ['[]', ['', ['{}', []]]]])
        assertStructurallySame(under(inRuntime(['throw', 'not an object']), ['in', 'x', 1]), ['error', 'not an object'])
        assertStructurallySame(under(inRuntime(['throw', 'asked']), ['in', 'x', ['throw', 'operand']]), ['error', 'operand'])
        failure(['in', 'x', 5], noIn)
        for (const missing of [/** @type {Runtime} */ (['{}', []]), /** @type {Runtime} */ (['{}', [[':', 'in', 0]]])]) {
            assertStructurallySame(under(missing, ['in', 'x', 5]), ['error', noIn])
        }
        // the language's own runtime, `fjs/js/runtime`, answers it as the
        // record specifies: an enumerable own entry of an object, an array
        // or a function, one holding `undefined` included; neither a
        // `length` nor a function's properties; and a throw on a primitive
        const real = /** @type {Runtime} */ (assertOk(read(vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))), 'runtime')))
        assertStructurallySame(under(real, ['in', 'x', ['{}', [[':', 'x', 1]]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'x', ['{}', [[':', 'x', ['undefined']]]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'y', ['{}', [[':', 'x', 1]]]]), ['ok', false])
        assertStructurallySame(under(real, ['in', '0', ['[]', [7]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', '1', ['[]', [7]]]), ['ok', false])
        assertStructurallySame(under(real, ['in', 'length', ['[]', [7]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'length', ['=>', 0, [], 1]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'length', ['{}', []]]), ['ok', false])
        assertStructurallySame(under(real, ['in', 'length', ['{}', [[':', 'length', 0]]]]), ['ok', true])
        for (const primitive of /** @type {readonly Exp[]} */ ([null, ['undefined'], 1, 'abc', true, 1n])) {
            assertStructurallySame(under(real, ['in', 'x', primitive]), ['error', 'in: not an object'])
        }
        assertStructurallySame(under(real, ['in', '0', 'abc']), ['error', 'in: not an object'])
    },
    memberRuntime: () => {
        /** @type {(answer: Exp) => Runtime} */
        const runtime = answer => ['{}', [[':', 'dot', ['=>', 2, [], answer]]]]
        /** @type {(runtime: Runtime, node: Exp, expected: EdagValue) => void} */
        const check = (runtime, node, expected) => {
            assertStructurallySame(vm({ ...context, runtime })(node), ['ok', expected])
        }
        /** @type {(runtime: Runtime, node: Exp, expected: EdagValue) => void} */
        const refuses = (runtime, node, expected) => {
            assertStructurallySame(vm({ ...context, runtime })(node), ['error', expected])
        }
        for (const answer of [null, 0, false, '', ['{}', []], ['=>', 0, [], ['throw', 'argument-stage']]]) {
            // Runtime answers have the existing undefined-only presence
            // test; a null answer is present, unlike a stored own null.
            check(runtime(/** @type {Exp} */ (answer)), ['memberPresent', 'abc', 'startsWith'], true)
        }
        const absent = runtime(['undefined'])
        check(absent, ['memberPresent', 'abc', 'startsWith'], false)
        check(absent, ['memberPresent', 'abc', 'slice'], true)
        for (const missing of [/** @type {Runtime} */ (['{}', []]), /** @type {Runtime} */ (['{}', [[':', 'dot', 0]]])]) {
            check(missing, ['memberPresent', 'abc', 'startsWith'], false)
            check(missing, ['memberPresent', 'abc', 'slice'], true)
        }
        const throwing = runtime(['throw', 'lookup'])
        refuses(throwing, ['memberPresent', 'abc', 'startsWith'], 'lookup')
        refuses(throwing, ['memberPresent', 'abc', 'slice'], 'lookup')
        refuses(throwing, [',', [['memberPresent', 'abc', 'startsWith'], 7]], 'lookup')
        check(throwing, ['memberPresent', 'abc', 'length'], true)
        check(throwing, ['memberPresent', 'abc', 'missing'], false)
        for (const value of [null, ['undefined'], 0]) {
            check(throwing, ['memberPresent', ['{}', [[':', 'toString', /** @type {Exp} */ (value)]]], 'toString'], value === 0)
        }
        const receiverDependent = runtime(['?:', ['===', ['arg', 0], 'abc'], ['=>', 0, [], ['throw', 'argument-stage']], ['undefined']])
        check(receiverDependent, ['memberPresent', 'abc', 'startsWith'], true)
        check(receiverDependent, ['memberPresent', 'other', 'startsWith'], false)
        // A provider may execute the receiver-stage body, but the query
        // never invokes the argument-stage callable that body returns.
        refuses(runtime(['()', ['=>', 1, [], ['throw', 'receiver-stage']], [['arg', 0]]]), ['memberPresent', 'abc', 'startsWith'], 'receiver-stage')
        check(runtime(['=>', 0, [], ['throw', 'argument-stage']]), ['memberPresent', 'abc', 'startsWith'], true)
    },
    memberStaticRead: () => {
        // A pre-established static receiver still needs its runtime body
        // when its length is read; the query performs that read first.
        /** @type {(runtime: Runtime | undefined) => import('../value/control/types.ts').ValueResult} */
        const query = runtime => vm({ frame: [['Object.is']], args: [], runtime })(['memberPresent', ['frame', 0], 'length'])
        assertStructurallySame(query(undefined), ['error', noStatic('Object.is')])
        assertStructurallySame(query(['{}', []]), ['error', noStatic('Object.is')])
        assertStructurallySame(query(['{}', [[':', 'static', ['=>', 1, [], ['throw', 'static-read']]]]]), ['error', 'static-read'])
        assertStructurallySame(query(['{}', [[':', 'static', ['=>', 1, [], ['=>', 0, [], 0]]]]]), ['ok', true])
    },
    memberEvaluationOrder: () => {
        const stop = /** @type {const} */ (['throw', 'receiver'])
        const key = /** @type {const} */ (['Number', 0])
        assertStructurallySame(run(['memberPresent', stop, key], [])[0], [stop])
        assertStructurallySame(run(['memberPresent', null, key], [])[0], [null, key])
        const conversion = /** @type {const} */ (['Number', ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'key']]]]]])
        assertStructurallySame(run(['memberPresent', null, conversion], []), [[null, conversion], ['error', 'key']])
        // The optional receiver guard belongs outside the query and its
        // computed key, so neither is reached on the skipped path.
        assertStructurallySame(run(['?:', false, ['memberPresent', null, conversion], 7], [])[0], [false, 7])
    },
    // A static function is a value whether called or not, the node, one
    // function by its name; the body the runtime's `static` answers for its id
    // answers its call, with the static as the body's `self`,
    // and its `length`, and its text is its name's. With no runtime, or
    // none at the path, the dispatcher fails naming it at the read — every
    // static with a body alike — and the invoker at the call.
    objectIs: () => {
        failure(['()', ['Object.is'], [1, 1]], noStatic('Object.is'))
        failure(['Object.is'], 'no binding for the static Object.is')
        // a `static` that throws is the call's throw, asked for the body
        // directly, as the executors ask after the read
        /** @type {EdagValue} */
        const throwing = ['{}', [[':', 'static', ['=>', 1, [], ['throw', 'boom']]]]]
        const asked = invokeWith(throwing)
        assertEq(assertError(settle(asked)(staticCall(throwing, ['Object.is'], ['[]', []], () => { throw 'unreached' }, asked))), 'boom')
        const throwingRead = operation({ ...evaluator, context: { ...context, runtime: throwing }, invoke: asked })
        assertStructurallySame(throwingRead(['Object.is'], []), [[], ['error', 'boom']])
        for (const id of staticIds.filter(id => !isNative(staticPath(id)))) { failure([id], noStatic(id)) }
        /** @type {Context} */
        const withRuntime = {
            ...context,
            runtime: ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Object.is', ['=>', 2, [], ['[]', [['===', ['arg', 0], ['arg', 1]], ['self'], ['rest']]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]],
        }
        const invokeBound = invokeWith(withRuntime.runtime)
        const bound = operation({ ...evaluator, context: withRuntime, invoke: invokeBound, operand: (e, state) => [[...state, e], vm(withRuntime)(e)] })
        /** @type {(e: ExpOp, expected: EdagValue) => void} */
        const boundEq = (e, expected) => { assertStructurallySame(settle(invokeBound)(bound(e, [])[1]), ['ok', expected]) }
        boundEq(['()', ['Object.is'], ['a', 'a', 'b']], ['[]', [true, ['Object.is'], ['[]', ['b']]]])
        boundEq(['Object.is'], ['Object.is'])
        boundEq(['.', ['Object.is'], 'length'], 2)
        boundEq(['.', ['Object.is'], 'name'], ['undefined'])
        boundEq(['String', ['Object.is']], 'function is() { [native code] }')
        boundEq(['===', ['Object.is'], ['Object.is']], true)
        // the static read, bound; its call, through an invoker without the
        // runtime, is the same failure
        assertStructurallySame(settle(invoke)(bound(['()', ['Object.is'], ['a', 'a']], [])[1]), ['error', noStatic('Object.is')])
    },
    // A logarithm static runs the body supplied by the runtime, including
    // its argument binding and metadata. This synthetic body returns its
    // arguments so the dispatch contract is independent of numerical tests.
    mathLog2: () => {
        /** @type {Runtime} */
        const runtime = ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Math.log2', ['=>', 1, [], ['[]', [['arg', 0], ['self'], ['rest']]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]]
        assertStructurallySame(under(runtime, ['Math.log2']), ['ok', ['Math.log2']])
        assertStructurallySame(under(runtime, ['()', ['Math.log2'], [8, 9]]), ['ok', ['[]', [8, ['Math.log2'], ['[]', [9]]]]])
        assertStructurallySame(under(runtime, ['()', ['Math.log2'], []]), ['ok', ['[]', [['undefined'], ['Math.log2'], ['[]', []]]]])
        assertStructurallySame(under(runtime, ['.', ['Math.log2'], 'length']), ['ok', 1])
        assertStructurallySame(under(runtime, ['String', ['Math.log2']]), ['ok', 'function log2() { [native code] }'])
        assertStructurallySame(under(runtime, ['===', ['Math.log2'], ['Math.log2']]), ['ok', true])
        failure(['Math.log2'], noStatic('Math.log2'))
        failure(['()', ['Math.log2'], [8]], noStatic('Math.log2'))
        assertStructurallySame(under(['{}', []], ['Math.log2']), ['error', noStatic('Math.log2')])
    },
    // `Object.entries` is the dispatcher's own, with no runtime: a static
    // like every other, called natively on its first argument.
    objectEntries: () => {
        eq(['Object.entries'], ['Object.entries'])
        eq(['===', ['Object.entries'], ['Object.entries']], true)
        eq(['()', ['Object.entries'], [['{}', [[':', 'b', 1], [':', '0', 2]]]]], ['[]', [['[]', ['0', 2]], ['[]', ['b', 1]]]])
        eq(['.', ['Object.entries'], 'length'], 1)
        eq(['String', ['Object.entries']], 'function entries() { [native code] }')
        failure(['()', ['Object.entries'], [null]])
        failure(['()', ['Object.entries'], []])
    },
    // Keys are a runtime body over native entries and the shared array map,
    // with static identity, arity and text supplied by the existing protocol.
    objectKeys: () => {
        const runtime = assertOk(read(vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))), 'runtime'))
        assert(runtime instanceof Array && runtime[0] === '{}')
        /** @type {(node: Exp) => ValueResult} */
        const evaluate = node => vm({ ...context, runtime })(node)
        const keys = /** @type {const} */ (['Object.keys'])
        assertStructurallySame(evaluate(['()', keys, [['{}', [
            [':', '10', 1], [':', '2', 2], [':', 'present', ['undefined']], [':', '__proto__', 3],
        ]]]]), ['ok', ['[]', ['2', '10', 'present', '__proto__']]])
        assertStructurallySame(evaluate(['()', keys, ['😀a']]), ['ok', ['[]', ['0', '1', '2']]])
        assertStructurallySame(evaluate(['[]', [
            ['===', keys, ['Object.keys']], ['typeof', keys], ['.', keys, 'length'], ['String', keys],
        ]]), ['ok', ['[]', [true, 'function', 1, 'function keys() { [native code] }']]])
        /** @type {readonly Exp[]} */
        const emptyInputs = [0, true, 1n, ['[]', []], ['{}', []], ['=>', 0, [], 1]]
        for (const input of emptyInputs) { assertStructurallySame(evaluate(['()', keys, [input]]), ['ok', ['[]', []]]) }
        assertError(evaluate(['()', keys, [null]]))
        assertError(evaluate(['()', keys, [['undefined']]]))
        assertError(evaluate(['()', keys, []]))
        failure(keys, noStatic('Object.keys'))
    },
    calls: () => {
        const at = /** @type {const} */ (['[]', [42]])
        eq(['()', identity, [1]], 1)
        eq(['.', at, 'at', ['|()', [0]]], 42)
        eq(['.', at, 'at', ['|?.()', [0], ['|.', 'toFixed', ['|()', [1]]]]], '42.0')
        eq(['?.', at, 'at', ['|()', [0]]], 42)
        eq(['?.', at, 'at', ['|?.()', [0]]], 42)
        eq(['?.', null, 'at', ['|.', 'x']], ['undefined'])
        eq(['?.', ['{}', [[':', 'f', null]]], 'f', ['|?.()', [0], ['|.', 'x']]], ['undefined'])
        eq(['?.()', null, [0]], ['undefined'])
        eq(['?.()', identity, [3]], 3)
        eq(['?.()', ['=>', 1, [], ['{}', [[':', 'y', ['arg', 0]]]]], [3], ['|.', 'y']], 3)
        eq(['?.()', ['=>', 0, [], identity], [], ['|()', [7]]], 7)
        eq(['?.', ['{}', [[':', 'f', identity]]], 'f', ['|?.()', [8]]], 8)
        eq(['.', ['{}', [[':', 'toString', ['=>', 0, [], 'own']]]], 'toString', ['|()', []]], 'own')
        failure(['?.', null, 'a', ['|!()', []]])
        failure(['?.', ['{}', []], 'a', ['|!()', []]])
        failure(['()', 1, [2]])
        failure(['?.()', identity, [['throw', 9]]], 9)
    },
    lambda: () => {
        const f = assertOk(run(['=>', 0, ['captured'], ['frame', 0]], [])[1])
        assertStructurallySame(f, ['=>', 0, ['captured'], ['frame', 0]])
        eq(['()', ['=>', 0, ['captured'], ['frame', 0]], []], 'captured')
        eq(['()', ['=>', 0, [], ['rest']], [1, 2]], ['[]', [1, 2]])
        // Sharing policy survives a call and a builtin callback invocation.
        const child = /** @type {const} */ (['[]', []])
        const body = /** @type {const} */ (['===', child, child])
        eq(['()', ['=>', 0, [], body], []], false)
        const runtime = assertOk(read(vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))), 'runtime'))
        assert(runtime instanceof Array && runtime[0] === '{}')
        assertStructurallySame(under(runtime, ['.', ['[]', [1]], 'map', ['|()', [['=>', 0, [], body]]]]), ['ok', ['[]', [false]]])
    },
    failures: () => {
        failure(['throw', 1], 1)
        failure(['throw', ['throw', 2]], 2)
        failure(['+', 0n])
        failure(['+', throws, 1], 'conversion')
        failure(['+', 1, throws], 'conversion')
        failure(['!', ['throw', 1]], 1)
        failure([',', [1, ['throw', 2], 3]], 2)
    },
    // `invokerWith` is an executor given only its `run`: a closure is run
    // under its invocation's context — its frame, its bindings, itself as
    // `self` and the runtime; a static's body found in the runtime is run
    // with the static as `self`; the helpers and an intrinsic are answered
    // in place; and a call a body leaves is made in its place.
    invokerWith: () => {
        /** The context echoed for `'echo'`, a call left for `'tail'`, every other body walked by Amnesia. @type {(fn: Closure, context: Context) => Outcome} */
        const echo = (fn, context) =>
            fn[3] === 'echo' ? ['ok', ['[]', [['[]', context.frame], ['[]', context.args], ['[]', context.fixed ?? []], context.rest ?? ['[]', []], context.self ?? null, context.runtime ?? null]]]
            : fn[3] === 'tail' ? ['call', ['=>', 1, ['g'], 'echo'], [7], ['[]', [8]]]
            : vm(context)(fn[3])
        /** @type {Closure} */
        const f = ['=>', 1, ['captured'], 'echo']
        const bare = invokerWith(echo)(undefined)
        assertStructurallySame(bare(f, [1], ['[]', [2]]), ['ok', ['[]', [['[]', ['captured']], ['[]', []], ['[]', [1]], ['[]', [2]], f, null]]])
        assertStructurallySame(bare(['=>', 0, [], 'tail'], [], ['[]', []]), ['ok', ['[]', [['[]', ['g']], ['[]', []], ['[]', [7]], ['[]', [8]], ['=>', 1, ['g'], 'echo'], null]]])
        assertStructurallySame(bare(['entry'], [['{}', [[':', 'a', 1]]], 'a'], ['[]', []]), ['ok', 1])
        assertStructurallySame(bare(['hasEntry'], [['{}', [[':', 'a', 1]]], 'b'], ['[]', []]), ['ok', false])
        assertStructurallySame(bare(['slice'], ['abcd', 1, 3], ['[]', []]), ['ok', 'bc'])
        assertStructurallySame(bare(['Object.is'], [], ['[]', []]), ['error', noStatic('Object.is')])
        /** @type {EdagValue} */
        const runtime = ['{}', [[':', 'static', ['=>', 1, [], ['=>', 2, [], 'echo']]]]]
        assertStructurallySame(invokerWith(echo)(runtime)(['Object.is'], [], ['[]', [1, 2, 3]]), ['ok', ['[]', [['[]', []], ['[]', []], ['[]', [1, 2]], ['[]', [3]], ['Object.is'], runtime]]])
    },
    evaluationOrder: () => {
        const [state, result] = run(['+', 1, 2], ['already'])
        assertStructurallySame(state, ['already', 1, 2])
        assertStructurallySame(result, ['ok', 3])
        assertStructurallySame(run(conditional("&&", 0, ['throw', 1]), [])[0], [0, 0])
        assertStructurallySame(run(['?:', true, 1, ['throw', 2]], [])[0], [true, 1])
        const stop = /** @type {const} */ (['throw', 1])
        assertEq(run(['+', stop, 2], [])[0].length, 1)
        assertStructurallySame(run(['+', throws, 2], [])[0], [throws, 2])
        assertStructurallySame(run(['[]', [1, stop, 3]], [])[0], [1, stop])
        assertStructurallySame(run(['{}', [[':', 'a', 1], [':', 'b', stop]]], [])[0], ['a', 1, 'b', stop])
        assertStructurallySame(run(['?.', null, 'a', ['|!()', [2]]], [])[0], [null, 2])
    },
})
