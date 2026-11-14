/** @import { Exp } from '../../edag/types.ts' */

import { assert, assertEq, assertStructurallySame, assertNotNullish } from '../../asserts/module.f.js'
import { _moduleExports } from '../../compiler/edag/module.f.mjs'
import { allowedCalls } from '../prototype/module.f.js'
import { isNative, statics as staticPaths } from '../static/module.f.js'
import { isStatic as isStaticNode } from '../../edag/module.f.js'
import { member, runtime, statics } from './module.f.js'
import edag from './gen.edag.js'

const { entries, values } = Object

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The member table by name, for a proof that walks it. @type {Readonly<Record<string, (self: unknown) => unknown>>} */
const members = member

/** The static table by id, for a proof that walks it, each entry called as a body is, on two arguments — `Object.entries`, the built-in itself, by `natives` alone. @type {Readonly<Record<string, (a: unknown, b: unknown) => unknown>>} */
const table = /** @type {Readonly<Record<string, (a: unknown, b: unknown) => unknown>>} */ (/** @type {unknown} */ (statics))

/** The host's own globals, each static path read from them by its keys. @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */
const host = /** @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */ (/** @type {unknown} */ ({ Object, Number, String, Math }))

/**
 * Statics with their own oracle proofs: structural results, entry-shaped
 * arguments, and a numerical approximation needing an accuracy bound.
 * @type {readonly string[]}
 */
const separatelyProved = ['Object.fromEntries', 'Object.keys', 'Object.values', 'Math.log2']

/**
 * Correctly rounded log2 and the output's ULP, computed from the exact
 * binary64 input with mpmath at 100 decimal digits. Literal references
 * make the oracle independent of both this kernel and the host's log2.
 * Near 1 the output is tiny, so an absolute or input-relative tolerance
 * would hide large numerical errors. See README.md for the method.
 * @type {readonly (readonly [number, number, number])[]}
 */
const logarithms = [
    [0.9999999999999999, -1.6017132519074588e-16, 2.465190328815662e-32],
    [1.0000000000000002, 3.203426503814917e-16, 4.930380657631324e-32],
    [1.9999999999999998, 0.9999999999999999, 1.1102230246251565e-16],
    [2.0000000000000004, 1.0000000000000002, 2.220446049250313e-16],
    [0.1, -3.321928094887362, 4.440892098500626e-16],
    [0.3, -1.7369655941662063, 2.220446049250313e-16],
    [0.7, -0.5145731728297583, 1.1102230246251565e-16],
    [1.1, 0.13750352374993502, 2.7755575615628914e-17],
    [1.2, 0.2630344058337938, 5.551115123125783e-17],
    [1.4, 0.48542682717024166, 5.551115123125783e-17],
    [1.5, 0.5849625007211562, 1.1102230246251565e-16],
    [1.7, 0.765534746362977, 1.1102230246251565e-16],
    [2.3, 1.2016338611696504, 2.220446049250313e-16],
    [3, 1.584962500721156, 2.220446049250313e-16],
    [7, 2.807354922057604, 4.440892098500626e-16],
    [10, 3.321928094887362, 4.440892098500626e-16],
    [1.4142135623730951, 0.5000000000000001, 1.1102230246251565e-16],
    [1.414213562373095, 0.4999999999999999, 5.551115123125783e-17],
    [1.4142135623730954, 0.5000000000000003, 1.1102230246251565e-16],
    [0.7071067811865476, -0.4999999999999999, 5.551115123125783e-17],
    [1e-300, -996.5784284662087, 1.1368683772161603e-13],
    [1e-100, -332.19280948873626, 5.684341886080802e-14],
    [1e100, 332.19280948873626, 5.684341886080802e-14],
    [1e300, 996.5784284662087, 1.1368683772161603e-13],
    [5e-324, -1074, 2.2737367544323206e-13],
    [1e-323, -1073, 2.2737367544323206e-13],
    [1.5e-323, -1072.415037499279, 2.2737367544323206e-13],
    [2.2250738585072014e-308, -1022, 1.1368683772161603e-13],
    [2.225073858507201e-308, -1022, 1.1368683772161603e-13],
    [1.7976931348623157e308, 1024, 2.2737367544323206e-13],
    [1.2891833470499138e262, 870.711618318191, 1.1368683772161603e-13],
]

const array = /** @type {readonly unknown[]} */ ([])
const object = {}
const f = () => 1

/** The chain steps a node holds, anywhere in it: a member call, a guarded step, an optional call. @type {(node: unknown) => readonly unknown[]} */
const steps = node => node instanceof Array
    ? [...(['|()', '|?.()', '|!()', '|.', '?.', '?.()'].includes(/** @type {string} */ (node[0])) ? [node[0]] : []), ...node.flatMap(steps)]
    : []

/** The static-function nodes a node holds, anywhere in it, a shared node as often as it is reached: the table, which the `static` function captures and the `statics` export is, twice. @type {(node: unknown) => readonly (readonly [string])[]} */
const staticNodes = node => node instanceof Array
    ? [...(isStaticNode(node) ? [node] : []), ...node.flatMap(staticNodes)]
    : []

/** Inspect an export after its required initialization prefix. @type {(node: unknown, key: string) => unknown} */
const at = (node, key) => _moduleExports(/** @type {Exp} */ (node)).find(([, name]) => name === key)?.[2]

/**
 * Every type, with the values the static functions part on: the zeros and
 * `NaN`, the infinities, fractions, the bounds of the safe integers and
 * the first integers past them, the largest double and the least, numeric
 * strings, the bigint zeros, and a container and a function beside a
 * second one of the same shape. A static body is called on every pair, so
 * a two-argument function meets every combination and a one-argument one
 * every value, its second argument ignored as the host ignores it.
 *
 * @type {readonly unknown[]}
 */
const samples = [
    NaN, 0, -0, 1, -1, 0.5, -0.5, 1.5, -1.5, Infinity, -Infinity,
    0x1f_ffff_ffff_ffff, -0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000, -0x20_0000_0000_0000,
    1e100, 1.7976931348623157e308, -1.7976931348623157e308, 5e-324, -5e-324,
    0n, -0n, 1n, -1n,
    '', '0', '1', 'a', 'NaN', 'Infinity',
    true, false, null, undefined,
    array, [], [1], [NaN], object, {}, f, () => 1,
]

export const proof = /** @type {const} */ ({
    min: {
        numbers: () => {
            const min = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.min'])
            assertEq(min, Math.min)
            assertEq(runtime.static('Math.min'), min)
            assertEq(min.length, 2)
            for (const [args, expected] of /** @type {const} */ ([
                [[], Infinity], [[-Infinity], -Infinity], [[Infinity], Infinity],
                [[0], 0], [[-0], -0], [[0, 0, 0], 0],
                [[-0, 0], -0], [[0, -0], -0], [[0, 0, -0], -0],
                [[-3, -2, -1], -3], [[5, 2, 4, 3], 2],
                [[5e-324, -5e-324, 0], -5e-324],
                [[-1.7976931348623157e308, Infinity], -1.7976931348623157e308],
                [[NaN], NaN], [[NaN, -Infinity, 1], NaN], [[-Infinity, 1, NaN], NaN],
            ])) { assert(Object.is(min(...args), expected), args) }
        },
        conversion: () => {
            const min = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.min'])
            for (const value of ['', ' -0 ', ' -1.9 ', ' 0xffff ', '-Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(min(value, -3, 2), Math.min(/** @type {number} */ (value), -3, 2)), value)
                assert(Object.is(min(-3, 2, value), Math.min(-3, 2, /** @type {number} */ (value))), value)
            }
            assertEq(min({ valueOf: () => -9, toString: () => { throw 'unreached' } }, 3, 5), -9)
            assertEq(min(-1, 0, { valueOf: () => ({}), toString: () => '-16' }), -16)
        },
    },
    max: {
        numbers: () => {
            const max = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.max'])
            assertEq(max, Math.max)
            assertEq(runtime.static('Math.max'), max)
            assertEq(max.length, 2)
            for (const [args, expected] of /** @type {const} */ ([
                [[], -Infinity], [[-Infinity], -Infinity], [[Infinity], Infinity],
                [[0], 0], [[-0], -0], [[-0, -0, -0], -0],
                [[-0, 0], 0], [[0, -0], 0], [[-0, -0, 0], 0],
                [[-3, -2, -1], -1], [[5, 2, 4, 3], 5],
                [[5e-324, -5e-324, 0], 5e-324],
                [[1.7976931348623157e308, -Infinity], 1.7976931348623157e308],
                [[NaN], NaN], [[NaN, Infinity, 1], NaN], [[Infinity, 1, NaN], NaN],
            ])) { assert(Object.is(max(...args), expected), args) }
        },
        conversion: () => {
            const max = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.max'])
            for (const value of ['', ' -0 ', ' -1.9 ', ' 0xffff ', 'Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(max(value, -3, 2), Math.max(/** @type {number} */ (value), -3, 2)), value)
                assert(Object.is(max(-3, 2, value), Math.max(-3, 2, /** @type {number} */ (value))), value)
            }
            assertEq(max({ valueOf: () => 9, toString: () => { throw 'unreached' } }, 3, 5), 9)
            assertEq(max(-1, 0, { valueOf: () => ({}), toString: () => '16' }), 16)
        },
    },
    sqrt: {
        numbers: () => {
            const sqrt = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.sqrt'])
            assertEq(sqrt, Math.sqrt)
            assertEq(runtime.static('Math.sqrt'), sqrt)
            assertEq(sqrt.length, 1)
            assert(Object.is(sqrt(), NaN))
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, NaN],
                [0, 0], [-0, -0], [-1, NaN], [-5e-324, NaN],
                [1, 1], [4, 2], [0.25, 0.5], [2, 1.4142135623730951],
                [5e-324, 2.2227587494850775e-162],
                [1.7976931348623157e308, 1.3407807929942596e154],
            ]) { assert(Object.is(sqrt(value), expected), value) }
        },
        conversion: () => {
            const sqrt = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.sqrt'])
            for (const value of ['', ' -0 ', ' 0.25 ', ' 0x10 ', '-Infinity', 'bad', true, false, null, undefined, [], [9], [9n], [[4]], {}, () => 1]) {
                assert(Object.is(sqrt(value), Math.sqrt(/** @type {number} */ (value))), value)
            }
            assertEq(sqrt({ valueOf: () => 9, toString: () => { throw 'unreached' } }), 3)
            assertEq(sqrt({ valueOf: () => ({}), toString: () => '16' }), 4)
            assertEq(sqrt(25, { valueOf: () => { throw 'unused' } }), 5)
        },
    },
    ceil: {
        numbers: () => {
            const ceil = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.ceil'])
            assertEq(ceil, Math.ceil)
            assertEq(runtime.static('Math.ceil'), ceil)
            assertEq(ceil.length, 1)
            assert(Object.is(ceil(), NaN))
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 1], [-0.5, -0],
                [1.9, 2], [-1.9, -1], [5e-324, 1], [-5e-324, -0],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, -1.7976931348623157e308],
            ]) { assert(Object.is(ceil(value), expected), value) }
        },
        conversion: () => {
            const ceil = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.ceil'])
            for (const value of ['', ' -0 ', ' -0.5 ', ' 0x10 ', 'Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(ceil(value), Math.ceil(/** @type {number} */ (value))), value)
            }
            assertEq(ceil({ valueOf: () => 2.9, toString: () => { throw 'unreached' } }), 3)
            assertEq(ceil({ valueOf: () => ({}), toString: () => '-3.9' }), -3)
            assertEq(ceil(4.9, { valueOf: () => { throw 'unused' } }), 5)
        },
    },
    imul: {
        numbers: () => {
            const imul = /** @type {(a?: unknown, b?: unknown, unused?: unknown) => number} */ (statics['Math.imul'])
            assertEq(imul, Math.imul)
            assertEq(runtime.static('Math.imul'), imul)
            assertEq(imul.length, 2)
            assert(Object.is(imul(), 0))
            assert(Object.is(imul(1), 0))
            for (const [a, b, expected] of [
                [NaN, 1, 0], [Infinity, 1, 0], [-Infinity, 1, 0],
                [0, -1, 0], [-0, 1, 0], [-0.5, 1, 0],
                [1.9, -2.9, -2], [-3, 5, -15],
                [0xffff_ffff, 5, -5], [0x8000_0000, 1, -0x8000_0000],
                [0x8000_0000, 2, 0], [0xffff_ffff, 0xffff_ffff, 1],
                [0x1_0000_0001, 5, 5], [-0x1_0000_0001, 5, -5],
                [0x1f_ffff_ffff_ffff, 2, -2],
                [1.7976931348623157e308, 1, 0], [5e-324, 1, 0],
            ]) { assert(Object.is(imul(a, b), expected), [a, b]) }
        },
        conversion: () => {
            const imul = /** @type {(a?: unknown, b?: unknown, unused?: unknown) => number} */ (statics['Math.imul'])
            for (const value of ['', ' -0 ', ' -1.9 ', ' 0xffff ', 'Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(imul(value, 5), Math.imul(/** @type {number} */ (value), 5)), value)
                assert(Object.is(imul(5, value), Math.imul(5, /** @type {number} */ (value))), value)
            }
            assertEq(imul({ valueOf: () => 2.9, toString: () => { throw 'unreached' } }, 3), 6)
            assertEq(imul(3, { valueOf: () => ({}), toString: () => '-3.9' }), -9)
            assertEq(imul(4, 5, { valueOf: () => { throw 'unused' } }), 20)
        },
    },
    abs: {
        numbers: () => {
            const abs = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.abs'])
            assertEq(abs, Math.abs)
            assertEq(runtime.static('Math.abs'), abs)
            assertEq(abs.length, 1)
            assert(Object.is(abs(), NaN))
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, Infinity],
                [0, 0], [-0, 0], [0.5, 0.5], [-0.5, 0.5],
                [1.9, 1.9], [-1.9, 1.9], [5e-324, 5e-324], [-5e-324, 5e-324],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [-0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, 1.7976931348623157e308],
            ]) { assert(Object.is(abs(value), expected), value) }
        },
        conversion: () => {
            const abs = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.abs'])
            for (const value of ['', ' -0 ', ' -0.5 ', ' 0x10 ', '-Infinity', 'bad', true, false, null, undefined, [], [-8.9], [-8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(abs(value), Math.abs(/** @type {number} */ (value))), value)
            }
            assertEq(abs({ valueOf: () => -2.9, toString: () => { throw 'unreached' } }), 2.9)
            assertEq(abs({ valueOf: () => ({}), toString: () => '-3.9' }), 3.9)
            assertEq(abs(-4.9, { valueOf: () => { throw 'unused' } }), 4.9)
        },
    },
    floor: {
        numbers: () => {
            const floor = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.floor'])
            assertEq(floor, Math.floor)
            assertEq(runtime.static('Math.floor'), floor)
            assertEq(floor.length, 1)
            assert(Object.is(floor(), NaN))
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 0], [-0.5, -1],
                [1.9, 1], [-1.9, -2], [5e-324, 0], [-5e-324, -1],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
                [-1.7976931348623157e308, -1.7976931348623157e308],
            ]) { assert(Object.is(floor(value), expected), value) }
        },
        conversion: () => {
            const floor = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.floor'])
            for (const value of ['', ' -0 ', ' -0.5 ', ' 0x10 ', 'Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(floor(value), Math.floor(/** @type {number} */ (value))), value)
            }
            assertEq(floor({ valueOf: () => 2.9, toString: () => { throw 'unreached' } }), 2)
            assertEq(floor({ valueOf: () => ({}), toString: () => '-3.9' }), -4)
            assertEq(floor(4.9, { valueOf: () => { throw 'unused' } }), 4)
        },
    },
    trunc: {
        numbers: () => {
            const trunc = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.trunc'])
            assertEq(trunc, Math.trunc)
            assertEq(runtime.static('Math.trunc'), trunc)
            assertEq(trunc.length, 1)
            assert(Object.is(trunc(), NaN))
            for (const [value, expected] of [
                [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
                [0, 0], [-0, -0], [0.5, 0], [-0.5, -0],
                [1.9, 1], [-1.9, -1], [5e-324, 0], [-5e-324, -0],
                [0x20_0000_0000_0000, 0x20_0000_0000_0000],
                [1.7976931348623157e308, 1.7976931348623157e308],
            ]) { assert(Object.is(trunc(value), expected), value) }
        },
        conversion: () => {
            const trunc = /** @type {(value?: unknown, unused?: unknown) => number} */ (statics['Math.trunc'])
            for (const value of ['', ' -0.5 ', ' 0x10 ', 'Infinity', 'bad', true, false, null, undefined, [], [8.9], [8n], [[-1.9]], {}, () => 1]) {
                assert(Object.is(trunc(value), Math.trunc(/** @type {number} */ (value))), value)
            }
            assertEq(trunc({ valueOf: () => 2.9, toString: () => { throw 'unreached' } }), 2)
            assertEq(trunc({ valueOf: () => ({}), toString: () => '-3.9' }), -3)
            assertEq(trunc(4.9, { valueOf: () => { throw 'unused' } }), 4)
        },
    },
    log2: {
        specialCases: () => {
            const body = statics['Math.log2']
            assertEq(body.length, Math.log2.length)
            assertEq(runtime.static('Math.log2'), body)
            assert(Object.is(body(), NaN))
            for (const value of [NaN, -1, -Infinity, 0, -0, 1, Infinity]) {
                assert(Object.is(body(value), Math.log2(value)), value)
            }
            assertEq(1 / body(1), Infinity)
        },
        conversion: () => {
            const body = statics['Math.log2']
            for (const value of ['', '8', ' 0x10 ', 'Infinity', 'bad', true, false, null, undefined, [], [8], [8n], [[8]], {}, () => 1]) {
                assert(Object.is(body(value), Math.log2(/** @type {number} */ (value))), value)
            }
            const value = /** @type {const} */ ({ valueOf: () => 8, toString: () => { throw 'toString must not be reached' } })
            assertEq(body(value), 3)
            assertEq(body({ valueOf: () => ({}), toString: () => '16' }), 4)
            // Extra arguments do not undergo numerical conversion.
            assertEq(table['Math.log2'](8, { valueOf: () => { throw 'unused' } }), 3)
        },
        powersOfTwo: () => {
            // Every representable positive power, including all subnormals.
            for (let exponent = -1074; exponent <= 1023; exponent = exponent + 1) {
                assertEq(statics['Math.log2'](2 ** exponent), exponent, exponent)
            }
        },
        highPrecision: () => {
            for (const [input, expected, ulp] of logarithms) {
                const actual = statics['Math.log2'](input)
                const difference = actual - expected
                assert(-2 * ulp <= difference && difference <= 2 * ulp, [input, actual, expected, ulp])
            }
        },
    },
    boolean: () => {
        assertEq(runtime.Boolean.length, 1)
        for (const value of samples) { assertEq(runtime.Boolean(value), Boolean(value)) }
        const conversionHooks = /** @type {const} */ ({
            valueOf: () => { throw 'valueOf must not run' },
            toString: () => { throw 'toString must not run' },
        })
        assertEq(runtime.Boolean(conversionHooks), true)
        assertStructurallySame(at(at(edag, 'runtime'), 'Boolean'),
            ['=>', 1, [], ['!', ['!', ['arg', 0]]]])
    },
    concat: () => {
        const onArray = assertNotNullish(member.concat([1]))
        assertStructurallySame(onArray(), [1])
        assertStructurallySame(onArray(undefined, [2, [3]], 4), [1, undefined, 2, [3], 4])
        const onString = assertNotNullish(member.concat('a'))
        assertEq(onString(), 'a')
        assertEq(onString('b', 1n, null, undefined), 'ab1nullundefined')
        for (const self of samples.filter(value => !(value instanceof Array) && typeof value !== 'string')) {
            assertEq(member.concat(self), undefined, self)
        }
        const own = () => 7
        assertEq(runtime.dot({ concat: own }, 'concat'), own)
        assertEq(runtime.dot({ concat: undefined }, 'concat'), undefined)
        assertEq(typeof runtime.dot([], 'concat'), 'function')
        assertEq(typeof runtime.dot('', 'concat'), 'function')
    },
    map: () => {
        const input = /** @type {const} */ ([1, undefined, 3])
        /** @type {(value: unknown, index: number, receiver: readonly unknown[]) => readonly unknown[]} */
        const callback = (value, index, receiver) => [value, index, receiver]
        const body = assertNotNullish(member.map(input))
        assertEq(body.length, 1)
        assertStructurallySame(body(callback), input.map(callback))
        assertEq(member.map({}), undefined)
        assertEq(runtime.dot(input, 'map') === undefined, false)
    },
    fromCharCode: () => {
        const { fromCharCode } = String
        assertEq(statics['String.fromCharCode'], fromCharCode)
        assertEq(fromCharCode.length, 1)
        assertEq(fromCharCode(5, 6), '\u0005\u0006')
        assertEq(fromCharCode(), '')
        assertEq(fromCharCode(0xd800, 0xffff, 0x1_0041, -1), '\ud800\uffffA\uffff')
    },
    // `Boolean`, `static`, `dot` and `in` are the runtime's four functions; every key `member` holds
    // is a name `allowedCalls` admits — the same claim `./types.ts` makes at
    // the type level — and every entry is a body of the receiver alone,
    // answering `undefined` or a function.
    // The reference map's maker is the body of `../ref_map`, a new empty
    // map on each call.
    referenceMap: () => {
        const key = /** @type {const} */ ({})
        const [, map] = runtime.refMap()(key, 1)
        assertEq(map(key)[0], 1)
        assert(runtime.refMap() !== runtime.refMap())
    },
    keys: () => {
        assertEq(Object.keys(runtime).toSorted().join(), 'Boolean,dot,in,refMap,static')
        for (const [name, entry] of entries(members)) {
            assert(allowed.includes(name), name)
            assertEq(entry.length, 1)
            for (const self of samples) {
                const stage = entry(self)
                assert(stage === undefined || typeof stage === 'function', [name, self])
            }
        }
        assert(values(members).length > 0)
    },
    // Every key of the static table is an admitted id and every entry a
    // function — a body, or at a native path the built-in itself — and
    // `static` answers the entry by id, reading the table as the object
    // literal it is: an id the table lacks, an inherited name and a bare
    // namespace answer `undefined`, which an executor refuses by name.
    staticIds: () => {
        for (const [id, entry] of entries(statics)) {
            assert(isStaticNode([id]), id)
            assertEq(typeof entry, 'function')
            assertEq(runtime.static(id), entry, id)
        }
        for (const id of ['Object.assign', 'Math.cbrt', 'toString', 'constructor', 'Boolean', 'Object', 'is', '']) { assertEq(runtime.static(id), undefined, id) }
    },
    // Every admitted static but a native is bound, and each body answers as
    // the host's own built-in at the same path — its `length`, and its answer on every
    // pair of values — so a body is the built-in, value for value, and not
    // only on the cases written out for it. The built-in is called both
    // ways JavaScript calls it: as a method of its namespace, `Object.is(a,
    // b)`, and detached, `this` undefined, as `const { is } = Object;
    // is(a, b)` calls it — destructuring being sugar for the read, an
    // admitted static must answer alike either way
    // (`../static/module.f.js`), and a built-in that reads `this` throws
    // here on every engine the suite runs on.
    host: () => {
        for (const [namespaceName, name] of staticPaths.filter(path => !isNative(path) && !separatelyProved.includes(path.join('.')))) {
            const body = table[`${namespaceName}.${name}`]
            const namespace = host[namespaceName]
            const detached = namespace[name]
            assertEq(body.length, detached.length, [namespaceName, name])
            for (const a of samples) {
                for (const b of samples) {
                    const expected = body(a, b)
                    assertEq(namespace[name](a, b), expected, [namespaceName, name, 'method', a, b])
                    assertEq(detached(a, b), expected, [namespaceName, name, 'detached', a, b])
                }
            }
        }
    },
    // A native static has no body here, every executor binding it itself:
    // the section holds the built-in itself at the path, so the table is
    // complete as a value, and the host's own built-in answers alike
    // detached and on its namespace, as `host` checks a body's:
    // The natives read no `this`; compare their successful coercion inputs.
    natives: () => {
        for (const [namespaceName, name] of staticPaths.filter(isNative)) {
            assertEq(table[`${namespaceName}.${name}`], host[namespaceName][name], [namespaceName, name])
            const namespace = /** @type {Readonly<Record<string, (a: unknown) => unknown>>} */ (host[namespaceName])
            const detached = namespace[name]
            for (const a of samples.filter(a => a !== null && a !== undefined && (namespaceName === 'Object' || typeof a !== 'bigint'))) {
                assertStructurallySame(detached(a), namespace[name](a), [namespaceName, name, a])
            }
        }
    },
    // `Object.fromEntries` answers as the host's own on arrays of entries,
    // method and detached: the same keys in the same order, a key written
    // twice at its first position with its last value, each key converted,
    // a missing value `undefined`, `__proto__` an own key, and an entry that
    // is an object read by index. The order is compared through `entries`,
    // which lists it.
    fromEntries: () => {
        const body = /** @type {(a: unknown) => object} */ (statics['Object.fromEntries'])
        const fromEntries = /** @type {(a: unknown) => object} */ (Object.fromEntries)
        assertEq(body.length, fromEntries.length)
        /** @type {readonly unknown[]} */
        const cases = [
            [], [['a', 1]], [['b', 1], ['10', 2], ['2', 3], ['b', 4]],
            [[1, 'n'], [true, 'b'], [undefined, 'u'], [null, 'z'], [2n, 'g']],
            [['a']], [['__proto__', 1]], [{ 0: 'a', 1: 1 }], [array, object, f],
            entries({ x: 1, y: [2] }),
        ]
        for (const c of cases) {
            const expected = entries(body(c))
            assertStructurallySame(expected, entries(Object.fromEntries(/** @type {Iterable<readonly [PropertyKey, unknown]>} */ (c))), c)
            assertStructurallySame(expected, entries(fromEntries(c)), c)
        }
        assert(body([]) !== body([]))
    },
    // `Object.keys` projects native entries through the shared mapper. Its
    // fresh arrays compare structurally with the host, detached or called on
    // the namespace; extra arguments are ignored in both forms.
    objectKeys: () => {
        const body = table['Object.keys']
        const { keys } = Object
        assertEq(body.length, keys.length)
        /** @type {readonly {}[]} */
        const cases = [
            ...samples.filter(value => value !== null && value !== undefined),
            { b: 1, '10': 2, '2': 3, a: undefined, ['__proto__']: 4, '01': 5, '': 6 },
            { ['constructor']: undefined, length: 1 }, [undefined], 'a😀', '\ud800',
        ]
        for (const input of cases) {
            const expected = Object.keys(input)
            assertStructurallySame(body(input, undefined), expected, input)
            assertStructurallySame(body(input, 'ignored'), keys(input), input)
        }
        assertStructurallySame(body({ b: 1, '10': 2, '2': 3, a: undefined, ['__proto__']: 4 }, undefined), ['2', '10', 'b', 'a', '__proto__'])
        assertStructurallySame(body('a😀', undefined), ['0', '1', '2'])
        const input = /** @type {const} */ ({ a: 1 })
        assert(body(input, undefined) !== body(input, undefined))
        assertEq(runtime.static('Object.keys'), statics['Object.keys'])
    },
    // Projection keeps undefined entries and identities while copying the array.
    objectValues: () => {
        const body = table['Object.values']
        assertEq(body.length, values.length)
        /** @type {readonly {}[]} */
        const cases = [
            ...samples.filter(value => value !== null && value !== undefined),
            { b: 1, '10': 2, '2': 3, a: undefined, ['__proto__']: 4, '01': 5, '': 6 },
            { ['constructor']: undefined, length: 1 }, [undefined], 'a😀', '\ud800',
            { object, array, f },
        ]
        for (const input of cases) {
            assertStructurallySame(body(input, undefined), Object.values(input), input)
            assertStructurallySame(body(input, 'ignored'), values(input), input)
        }
        assertStructurallySame(body({ b: 1, '10': 2, '2': 3, a: undefined, ['__proto__']: 4 }, undefined), [3, 2, 1, undefined, 4])
        assertStructurallySame(body('a😀', undefined), ['a', '\ud83d', '\ude00'])
        const input = /** @type {const} */ ({ object, array, f })
        const first = /** @type {readonly unknown[]} */ (body(input, undefined))
        assert(first !== body(input, undefined))
        assertEq(first[0], object)
        assertEq(first[1], array)
        assertEq(first[2], f)
        assertEq(runtime.static('Object.values'), statics['Object.values'])
    },
    // The two values `===` reads the other way, which `Object.is` exists
    // for, and none of the four predicates converting its argument, are the
    // cases `host` must not miss; they are in `samples`, and pinned here too.
    edges: () => {
        assertEq(statics['Object.is'](0, -0), false)
        assertEq(statics['Object.is'](NaN, NaN), true)
        assertEq(statics['Object.is'](array, []), false)
        assertEq(statics['Number.isInteger']('1'), false)
        assertEq(statics['Number.isSafeInteger'](0x20_0000_0000_0000), false)
        assertEq(statics['Number.isNaN']('NaN'), false)
        assertEq(statics['Number.isFinite']('1'), false)
    },
    // The member bodies, on the host. `String.prototype.startsWith`
    // is a string's alone, `undefined` on every other receiver, and its
    // algorithm case by case — the search converted, the position clamped
    // and truncated, an empty search found anywhere.
    startsWith: () => {
        const { startsWith } = member
        for (const self of samples.filter(v => typeof v !== 'string')) { assertEq(startsWith(self), undefined, self) }
        /** @type {(self: string) => (search: unknown, at: unknown) => boolean} */
        const on = self => /** @type {(search: unknown, at: unknown) => boolean} */ (startsWith(self))
        assertEq(on('abc')('ab', undefined), true)
        assertEq(on('abc')('bc', undefined), false)
        assertEq(on('abc')('bc', 1), true)
        assertEq(on('abc')('c', 2.9), true)
        assertEq(on('abc')('a', -1), true)
        assertEq(on('abc')('a', NaN), true)
        assertEq(on('abc')('', 9), true)
        assertEq(on('abc')('', Infinity), true)
        assertEq(on('abc')('c', Infinity), false)
        assertEq(on('ab')('abc', undefined), false)
        assertEq(on('12')(1, undefined), true)
        assertEq(on('undefinedx')(undefined, undefined), true)
        // the host's own, on every sample pair but a bigint position, which
        // throws on both, as `host` checks a static
        for (const a of samples) {
            for (const b of samples.filter(v => typeof v !== 'bigint')) {
                assertEq(on('abc')(a, b), 'abc'.startsWith(/** @type {string} */ (a), /** @type {number} */ (b)), [a, b])
            }
        }
    },
    // `String.prototype.codePointAt` is a string's alone, and its algorithm
    // case by case: a pair's code point where a lead surrogate is followed
    // by a trail, the code unit itself otherwise — a lone surrogate, a
    // trail, a lead at the end — and `undefined` outside the string, the
    // position truncated, `NaN` and `undefined` the first.
    codePointAt: () => {
        const { codePointAt } = member
        for (const self of samples.filter(v => typeof v !== 'string')) { assertEq(codePointAt(self), undefined, self) }
        /** @type {(self: string) => (at: unknown) => number | undefined} */
        const on = self => /** @type {(at: unknown) => number | undefined} */ (codePointAt(self))
        assertEq(on('abc')(1), 0x62)
        assertEq(on('abc')(1.9), 0x62)
        assertEq(on('abc')(undefined), 0x61)
        assertEq(on('abc')(NaN), 0x61)
        assertEq(on('abc')('2'), 0x63)
        assertEq(on('abc')(3), undefined)
        assertEq(on('abc')(-1), undefined)
        assertEq(on('abc')(-0.5), 0x61)
        assertEq(on('abc')(Infinity), undefined)
        assertEq(on('')(0), undefined)
        assertEq(on('\u{1F600}')(0), 0x1_f600)
        assertEq(on('\u{1F600}')(1), 0xde00)
        assertEq(on('\ud83da')(0), 0xd83d)
        assertEq(on('a\ud83d')(1), 0xd83d)
        assertEq(on('\ude00\ud83d')(0), 0xde00)
        assertEq(on('\udbff\udfff')(0), 0x10_ffff)
        assertEq(on('\ud800\udc00')(0), 0x1_0000)
        // the host's own, on every sample but a bigint position, which
        // throws on both
        for (const s of ['abc', '\u{1F600}', 'a\u{1F600}b', '\ud83d', '']) {
            for (const a of samples.filter(v => typeof v !== 'bigint')) {
                assertEq(on(s)(a), s.codePointAt(/** @type {number} */ (a)), [s, a])
            }
        }
    },
    // The dispatcher, on the host: an own enumerable property first,
    // whatever it holds — a field, an element, a character, an own
    // `undefined` — then the member body's answer for the receiver, then
    // `undefined`; a `length`, a function's properties and every inherited
    // name are no entry.
    dot: () => {
        const { dot } = runtime
        const f = () => 1
        assertEq(dot({ startsWith: f }, 'startsWith'), f)
        assertEq(dot({ x: 0 }, 'x'), 0)
        assertEq(dot({ x: undefined }, 'x'), undefined)
        // an own `undefined` under a member name wins too, as in JavaScript,
        // where the call throws; `hasEntry` is what finds it
        assertEq(dot({ startsWith: undefined }, 'startsWith'), undefined)
        assertEq(dot([f], '0'), f)
        assertEq(dot('abc', '1'), 'b')
        assertEq(dot([1], 'length'), undefined)
        assertEq(dot(f, 'length'), undefined)
        assertEq(dot({}, 'toString'), undefined)
        assertEq(dot({}, 'constructor'), undefined)
        assertEq(dot(members, 'constructor'), undefined)
        assertEq(typeof dot('abc', 'startsWith'), 'function')
        assertEq(typeof dot('abc', 'codePointAt'), 'function')
        assertEq(dot(1, 'codePointAt'), undefined)
        assertEq(/** @type {(search: unknown) => boolean} */ (dot('abc', 'startsWith'))('ab'), true)
        for (const self of samples.filter(v => typeof v !== 'string' && v !== null && v !== undefined)) { assertEq(dot(self, 'startsWith'), undefined, self) }
        assertEq(dot('abc', 'slice'), undefined)
        // the core rule of DESIGN.md §13, on the compiled EDAG: the body of
        // `dot` holds no chain step — no member call, no optional chain —
        // since an executor runs it to answer those; the two helpers and a
        // `()` of a function value are what it uses.
        const compiled = /** @type {readonly unknown[]} */ (at(at(edag, 'runtime'), 'dot'))
        const [tag, length, , body] = compiled
        assertEq(`${tag}/${length}`, '=>/2')
        assertEq(steps(body).join(), '')
        assertEq(JSON.stringify(body).includes('["()"'), true)
    },
    // The operator's body, on the host: `"k" in o` for a key no prototype
    // supplies is the host's own `in` — an enumerable own entry of an
    // object, an array or a function, an own `undefined` included, and
    // nothing else — on every such key and every sample that is no
    // primitive, `length` among them, which an array and a function own
    // without enumerating it and the body reads as the read does. Where a
    // prototype would answer, which the parser refuses as a key, the body
    // and the host part: `toString` of anything and `name` of a function
    // are no entry here and found there.
    in: () => {
        const has = runtime.in
        assertEq(has.length, 2)
        /** @type {readonly string[]} */
        const keys = ['x', '0', '1', '', 'in', 'if', 'hasOwnProperty_', '__proto', 'NaN', 'undefined', 'length']
        /** @type {readonly unknown[]} */
        const receivers = [
            ...samples.filter(v => v !== null && typeof v === 'object' || typeof v === 'function'),
            { x: 1 }, { x: undefined }, { '': 0, in: 0, if: 0, undefined: 0 }, { ['__proto__']: 1 }, [undefined], [, 1], { length: 0 },
        ]
        for (const self of receivers) {
            for (const key of keys) { assertEq(has(key, self), key in /** @type {object} */ (self), [key, self]) }
        }
        assertEq(has('x', { x: undefined }), true)
        assertEq(has('0', [undefined]), true)
        assertEq(has('0', [, 1]), false)
        assertEq(has('toString', {}), false)
        assertEq(has('length', []), true)
        assertEq(has('length', f), true)
        assertEq(has('length', {}), false)
        assertEq(has('name', f), false)
        assertEq(has('__proto__', {}), false)
        assertEq(has('__proto__', { ['__proto__']: 1 }), true)
        // the body is the compiled EDAG's, no chain step in it, as `dot`'s
        const compiled = /** @type {readonly unknown[]} */ (at(at(edag, 'runtime'), 'in'))
        const [tag, length, , body] = compiled
        assertEq(`${tag}/${length}`, '=>/2')
        assertEq(steps(body).join(), '')
    },
    // The core may not use what it defines, and the whole module is the
    // core: no body and no initializer holds a member call, an optional
    // chain or a static function the runtime defines — a native is reached
    // through an intrinsic, `slice` in `found` and `charCodeAt` in
    // `codePointAt`, called as a function. Native static bindings are read
    // once: `Object.entries` is shared by its own table entry and the keys
    // and values bodies, which call that captured native and the shared map function
    // directly. Neither needs a runtime lookup, so the module can be
    // evaluated with no runtime, and NaNVM can hold it as a value whose
    // bodies never name it (`../runtime/README.md`, "How NaNVM finds
    // it"). The intrinsic is there, as a node, where the member call was.
    // An absence is a finding only of a detector that sees: each is shown
    // a node it is for, first.
    core: () => {
        assertEq(steps([['|()', ['=>', 0, [], 1], []]]).join(), '|()')
        assertEq(staticNodes([['Object.is']]).join(), 'Object.is')
        assertEq(steps(edag).join(), '')
        const natives = staticPaths.filter(isNative)
        // Only native static nodes are present, one binding per native even
        // when a body captures the same binding as its static-table entry.
        assertEq([...new Set(staticNodes(edag))].map(node => node[0]).join(), natives.map(path => path.join('.')).join())
        for (const path of natives) {
            assertEq(JSON.stringify(at(at(edag, 'statics'), path.join('.'))), JSON.stringify([path.join('.')]))
        }
        assertEq(JSON.stringify(edag).includes('["slice"]'), true)
        assertEq(JSON.stringify(edag).includes('["charCodeAt"]'), true)
    },
    throw: {
        minBigint: () => { table['Math.min'](1n, 0) },
        minBigintAfterNaN: () => { table['Math.min'](NaN, 1n) },
        minBigintAfterInfinity: () => { table['Math.min'](-Infinity, 1n) },
        minBigintLast: () => {
            const min = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.min'])
            min(0, 0, 1n)
        },
        minBigintPrimitive: () => { table['Math.min']({ valueOf: () => 1n }, 0) },
        minBigintPrimitiveAfterNaN: () => { table['Math.min'](NaN, { valueOf: () => 1n }) },
        minBigintPrimitiveLast: () => {
            const min = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.min'])
            min(NaN, -Infinity, { valueOf: () => 1n })
        },
        minConversionAfterNaN: () => { table['Math.min'](NaN, { valueOf: () => { throw 'conversion' } }) },
        minConversionAfterInfinity: () => { table['Math.min'](-Infinity, { valueOf: () => { throw 'conversion' } }) },
        minNoPrimitive: () => { table['Math.min'](0, { valueOf: () => ({}), toString: () => [] }) },
        maxBigint: () => { table['Math.max'](1n, 0) },
        maxBigintAfterNaN: () => { table['Math.max'](NaN, 1n) },
        maxBigintAfterInfinity: () => { table['Math.max'](Infinity, 1n) },
        maxBigintLast: () => {
            const max = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.max'])
            max(0, 0, 1n)
        },
        maxBigintPrimitive: () => { table['Math.max']({ valueOf: () => 1n }, 0) },
        maxBigintPrimitiveAfterNaN: () => { table['Math.max'](NaN, { valueOf: () => 1n }) },
        maxBigintPrimitiveLast: () => {
            const max = /** @type {(...values: readonly unknown[]) => number} */ (statics['Math.max'])
            max(NaN, Infinity, { valueOf: () => 1n })
        },
        maxConversionAfterNaN: () => { table['Math.max'](NaN, { valueOf: () => { throw 'conversion' } }) },
        maxConversionAfterInfinity: () => { table['Math.max'](Infinity, { valueOf: () => { throw 'conversion' } }) },
        maxNoPrimitive: () => { table['Math.max'](0, { valueOf: () => ({}), toString: () => [] }) },
        sqrtBigint: () => { table['Math.sqrt'](1n, undefined) },
        sqrtBigintPrimitive: () => { table['Math.sqrt']({ valueOf: () => 1n }, undefined) },
        sqrtConversion: () => { table['Math.sqrt']({ valueOf: () => { throw 'conversion' } }, undefined) },
        sqrtNoPrimitive: () => { table['Math.sqrt']({ valueOf: () => ({}), toString: () => [] }, undefined) },
        ceilBigint: () => { table['Math.ceil'](1n, undefined) },
        ceilBigintPrimitive: () => { table['Math.ceil']({ valueOf: () => 1n }, undefined) },
        ceilConversion: () => { table['Math.ceil']({ valueOf: () => { throw 'conversion' } }, undefined) },
        ceilNoPrimitive: () => { table['Math.ceil']({ valueOf: () => ({}), toString: () => [] }, undefined) },
        imulBigintLeft: () => { table['Math.imul'](1n, 1) },
        imulBigintRight: () => { table['Math.imul'](1, 1n) },
        imulBigintPrimitiveLeft: () => { table['Math.imul']({ valueOf: () => 1n }, 1) },
        imulBigintPrimitiveRight: () => { table['Math.imul'](1, { valueOf: () => 1n }) },
        imulConversionLeft: () => { table['Math.imul']({ valueOf: () => { throw 'conversion' } }, 0) },
        imulConversionRight: () => { table['Math.imul'](0, { valueOf: () => { throw 'conversion' } }) },
        imulNoPrimitive: () => { table['Math.imul']({ valueOf: () => ({}), toString: () => [] }, 0) },
        absBigint: () => { table['Math.abs'](1n, undefined) },
        absBigintPrimitive: () => { table['Math.abs']({ valueOf: () => 1n }, undefined) },
        absConversion: () => { table['Math.abs']({ valueOf: () => { throw 'conversion' } }, undefined) },
        absNoPrimitive: () => { table['Math.abs']({ valueOf: () => ({}), toString: () => [] }, undefined) },
        floorBigint: () => { table['Math.floor'](1n, undefined) },
        floorBigintPrimitive: () => { table['Math.floor']({ valueOf: () => 1n }, undefined) },
        floorConversion: () => { table['Math.floor']({ valueOf: () => { throw 'conversion' } }, undefined) },
        floorNoPrimitive: () => { table['Math.floor']({ valueOf: () => ({}), toString: () => [] }, undefined) },
        truncBigint: () => { table['Math.trunc'](1n, undefined) },
        truncBigintPrimitive: () => { table['Math.trunc']({ valueOf: () => 1n }, undefined) },
        truncConversion: () => { table['Math.trunc']({ valueOf: () => { throw 'conversion' } }, undefined) },
        truncNoPrimitive: () => { table['Math.trunc']({ valueOf: () => ({}), toString: () => [] }, undefined) },
        log2Bigint: () => { statics['Math.log2'](1n) },
        log2BigintPrimitive: () => { statics['Math.log2']({ valueOf: () => 1n }) },
        log2Conversion: () => { statics['Math.log2']({ valueOf: () => { throw 'conversion' } }) },
        log2NoPrimitive: () => { statics['Math.log2']({ valueOf: () => ({}), toString: () => [] }) },
        // The detached call `host` makes is a real one: a built-in that
        // builds with `this` as its constructor, which no static may be,
        // throws called so.
        detachedThis: () => {
            const { from } = Uint8Array
            from([1])
        },
        // A bigint position is the `TypeError` `ToNumber` throws.
        bigintPosition: () => { member.startsWith('abc')?.('a', 0n) },
        bigintCodePointPosition: () => { member.codePointAt('abc')?.(0n) },
        // The search is converted through its own `toString`, whose throw
        // is the call's; which of two throws wins is pinned where the
        // executors run the body, in `nanvm/corpus` and `vm/runtime.rs`.
        searchConversion: () => { member.startsWith('abc')?.({ toString: () => { throw 'A' } }, 0) },
        // a nullish receiver is the executor's throw, before `dot` is asked
        nullishReceiver: () => { runtime.dot(null, 'x') },
        // `in` throws on `null`, `undefined` and every primitive, as the
        // host's `TypeError` does — a string's index too, which `hasEntry`
        // alone would answer `true`, and is why the body is not the helper.
        inNull: () => { runtime.in('x', null) },
        inUndefined: () => { runtime.in('x', undefined) },
        inString: () => { runtime.in('0', 'abc') },
        inNumber: () => { runtime.in('x', 1) },
        inBoolean: () => { runtime.in('x', true) },
        inBigint: () => { runtime.in('x', 1n) },
        // `Object.fromEntries` of an entry that is not an object throws, as
        // the host's `TypeError` does…
        fromEntriesEntry: () => { statics['Object.fromEntries']([['a', 1], 2]) },
        // …and so does a value that is not an array, even one the host
        // iterates: the language admits no other iterable as entries.
        fromEntriesNotArray: () => { statics['Object.fromEntries']('') },
        objectKeysNull: () => { table['Object.keys'](null, undefined) },
        objectKeysUndefined: () => { table['Object.keys'](undefined, undefined) },
        objectValuesNull: () => { table['Object.values'](null, undefined) },
        objectValuesUndefined: () => { table['Object.values'](undefined, undefined) },
    },
})
