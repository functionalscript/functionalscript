import { assert, assertEq } from '../../asserts/module.f.js'
import {
    functionText, stringEquals, stringLess, strictEquals, toBoolean, toNumber, toNumeric,
    toPrimitive, toPropertyKey, toString, typeOf,
} from './module.f.js'

/** A function value. @type {(a: unknown) => unknown} */
const f = a => a

const a = [1]
const o = { a: 1 }

/** Values of every kind, with the edge cases of each operation. */
const values = [
    undefined, null, true, false,
    0, -0, NaN, 1, -1.5, Infinity, -Infinity,
    '', 'a', 'ab', 'b', 'B', '\u{1F600}', '\uffff', '0', 'false',
    0n, 1n, -1n, 0x1_0000_0000_0000_0000n,
    a, [1], [], o, { a: 1 }, {}, f, () => 0,
]

/**
 * Values every coercion converts without a throw: {@link values} but the
 * bigints, which `ToNumber` refuses, and objects with conversion methods of
 * their own.
 */
const convertible = /** @type {readonly unknown[]} */ ([
    ...values.filter(v => typeof v !== 'bigint'),
    [1, [2, [3, null]], undefined, 'a', true, {}, -0, 1e21],
    [[]], [null], [undefined, undefined],
    { valueOf: () => 7 },
    { toString: () => '12' },
    { valueOf: () => 7, toString: () => 'seven' },
    { valueOf: () => ({}), toString: () => '8' },
    { valueOf: 5, toString: () => '9' },
    { toString: () => [], valueOf: () => true },
    { toString: undefined, valueOf: () => null },
    { valueOf: () => undefined },
])

/** The strings of {@link values}. */
const strings = values.filter(v => typeof v === 'string')

/** `[x, y]` for every `x` and `y` of `list`, each pair in both orders and each value with itself. */
const pairs = /** @type {<T>(list: readonly T[]) => readonly (readonly [T, T])[]} */ (list => list.flatMap(x => list.map(y => /** @type {const} */ ([x, y]))))

export const proof = {
    // `typeOf` is the `typeof` operator.
    typeOf: () => {
        values.forEach(v => assertEq(typeOf(v), typeof v))
    },
    // `toBoolean` is JavaScript's own `ToBoolean`.
    toBoolean: () => {
        values.forEach(v => assertEq(toBoolean(v), !!v, String(v)))
    },
    // `strictEquals` is `===` on every pair, and so on itself for each
    // value but `NaN`.
    strictEquals: () => {
        pairs(values).forEach(([x, y]) => assertEq(strictEquals(x, y), x === y, `${String(x)} ${String(y)}`))
        assert(strictEquals(-0, 0))
        assert(!strictEquals(NaN, NaN))
        assert(strictEquals(a, a))
        assert(!strictEquals(a, [1]))
    },
    // `stringEquals` and `stringLess` are `===` and `<` on every pair of
    // strings, by UTF-16 unit, so `'\uffff'` sorts after an astral
    // character's leading surrogate.
    strings: () => {
        pairs(strings).forEach(([x, y]) => {
            assertEq(stringEquals(x, y), x === y, `${x} ${y}`)
            assertEq(stringLess(x, y), x < y, `${x} ${y}`)
        })
        assert(stringLess('\u{1F600}', '\uffff'))
    },
    // `toString` and `toPropertyKey` are `String` and a computed key, and
    // `toNumber` is unary `+`, on every convertible value: an array joined,
    // nested arrays too, and an object through its own `toString` and
    // `valueOf`, a non-function or a non-primitive answer skipped.
    coercions: () => {
        convertible.forEach(v => {
            assertEq(toString(v), String(v))
            assertEq(toPropertyKey(v), Object.keys({ [/** @type {string} */ (v)]: 0 })[0])
            assert(Object.is(toNumber(v), +/** @type {number} */ (v)), String(v))
        })
        values.filter(v => typeof v === 'bigint').forEach(v => assertEq(toString(v), String(v)))
    },
    // `toPrimitive` keeps a primitive and orders an object's methods by
    // the preferred type, as a template and unary `+` do.
    toPrimitive: () => {
        const o = { valueOf: () => 1, toString: () => 's' }
        assertEq(toPrimitive(o, false), 1)
        assertEq(toPrimitive(o, true), 's')
        assertEq(toPrimitive(o, true), `${o}`)
        assertEq(toPrimitive(1n, false), 1n)
        assertEq(toPrimitive([1, 2], false), '1,2')
        assertEq(toPrimitive(f, false), String(f))
        assertEq(toPrimitive({}, false), '[object Object]')
    },
    // `toNumeric` keeps a bigint, from a primitive or from `valueOf`, and
    // makes anything else a number.
    toNumeric: () => {
        assertEq(toNumeric(1n), 1n)
        assertEq(toNumeric({ valueOf: () => 2n }), 2n)
        assertEq(toNumeric('3'), 3)
        assertEq(toNumeric([4]), 4)
        assert(Number.isNaN(toNumeric({})))
    },
    // `functionText` passes a function's text through.
    functionText: () => {
        assertEq(functionText('() => 0'), '() => 0')
    },
    // Each throw is JavaScript's, with NaNVM's text.
    throw: {
        // a bigint has no number
        toNumberBigInt: () => { toNumber(1n) },
        toNumberValueOf: () => { toNumber({ valueOf: () => 1n }) },
        // no method answers a primitive
        toStringNoPrimitive: () => { toString({ toString: () => ({}), valueOf: () => [] }) },
        toStringNotFunction: () => { toString({ toString: 1 }) },
        toNumberNoPrimitive: () => { toNumber({ toString: () => ({}) }) },
        // a method's throw passes through
        method: () => { toString({ toString: () => { throw 'x' } }) },
        // a function without text, which only a WASM runtime can hold
        functionText: () => { functionText(undefined) },
    },
}
