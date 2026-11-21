import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import {
    call, get, objectSpread, toIterable,
    at, charCodeAt, every, filter, requireObjectCoercible, toIntegerOrInfinity,
    add, bitwiseAnd, divide, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, multiply, negate, remainder,
    number, shiftRight, subtract,
    functionText, stringEquals, stringLess, strictEquals, toBoolean, toNumber, toNumeric,
    toPrimitive, toPropertyKey, toString, typeOf,
} from './module.f.js'
import { entry } from '../../../types/object/entry/module.f.js'

/** A function value. @type {(a: unknown) => unknown} */
const f = a => a

const a = /** @type {const} */ ([1])
const o = /** @type {const} */ ({ a: 1 })

/** Values of every kind, with the edge cases of each operation. */
const values = /** @type {readonly unknown[]} */ ([
    undefined, null, true, false,
    0, -0, NaN, 1, -1.5, Infinity, -Infinity,
    '', 'a', 'ab', 'b', 'B', '\u{1F600}', '\uffff', '0', 'false',
    0n, 1n, -1n, 0x1_0000_0000_0000_0000n,
    a, [1], [], o, { a: 1 }, {}, f, () => 0,
])

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

/** {@link convertible} and the bigints, the operands of the operators. */
const operands = [...convertible, ...values.filter(v => typeof v === 'bigint'), 2n, -7n, '7', '1e3', ' 12 ', 'x1']

/** Whether a value's primitive, a number preferred, is a string. @type {(v: unknown) => boolean} */
const stringy = v => typeof toPrimitive(v, false) === 'string'

/** Whether one of two values is a bigint and the other is not. @type {(x: unknown, y: unknown) => boolean} */
const mixed = (x, y) => (typeof x === 'bigint') !== (typeof y === 'bigint')

/** Receivers of every kind but the nullish ones, for the member read. */
const receivers = /** @type {readonly unknown[]} */ (['ab', '', '\u{1F600}', [10, 20], [], { a: 1, 0: 'z', '1.5': 'f', length: 3, '1e+21': 'e' }, {}, f, 5, true, 1n])

/** Number and string keys, indexes and not. */
const keys = /** @type {readonly unknown[]} */ ([0, 1, 2, -0, -1, 1.5, NaN, Infinity, 1e21, 0xffff_ffff, 0x1_0000_0000, '0', '1', '2', '01', '-0', '1.5', ' 1', '', 'a', 'length', '4294967295', '4294967296', '99999999999'])

/**
 * A receiver's own member under a key, with no prototype, as NaNVM reads
 * one: its own enumerable entry, and the `length` a string, an array and a
 * function have, which is own and not enumerable.
 *
 * @type {(r: unknown, k: unknown) => unknown}
 */
const own = (r, k) => String(k) === 'length' && (typeof r === 'string' || typeof r === 'function' || r instanceof Array)
    ? r.length
    : entry(r, String(k))

/** The strings of {@link values}. */
const strings = values.filter(v => typeof v === 'string')

/** `[x, y]` for every `x` and `y` of `list`, each pair in both orders and each value with itself. */
const pairs = /** @type {<T>(list: readonly T[]) => readonly (readonly [T, T])[]} */ (list => list.flatMap(x => list.map(y => /** @type {const} */ ([x, y]))))

export const proof = {
    // `typeOf` is the `typeof` operator.
    typeOf: () => {
        for (const v of values) { assertEq(typeOf(v), typeof v) }
    },
    // `toBoolean` is JavaScript's own `ToBoolean`.
    toBoolean: () => {
        for (const v of values) { assertEq(toBoolean(v), !!v, String(v)) }
    },
    // `strictEquals` is `===` on every pair, and so on itself for each
    // value but `NaN`.
    strictEquals: () => {
        for (const [x, y] of pairs(values)) { assertEq(strictEquals(x, y), x === y, `${String(x)} ${String(y)}`) }
        assert(strictEquals(-0, 0))
        assert(!strictEquals(NaN, NaN))
        assert(strictEquals(a, a))
        assert(!strictEquals(a, [1]))
    },
    // `stringEquals` and `stringLess` are `===` and `<` on every pair of
    // strings, by UTF-16 unit, so `'\uffff'` sorts after an astral
    // character's leading surrogate.
    strings: () => {
        for (const [x, y] of pairs(strings)) {
            assertEq(stringEquals(x, y), x === y, `${x} ${y}`)
            assertEq(stringLess(x, y), x < y, `${x} ${y}`)
        }
        assert(stringLess('\u{1F600}', '\uffff'))
    },
    // `toString` and `toPropertyKey` are `String` and a computed key, and
    // `toNumber` is `Number`, which is unary `+` on all but a bigint, and no
    // bigint is here, on every convertible value: an array joined,
    // nested arrays too, and an object through its own `toString` and
    // `valueOf`, a non-function or a non-primitive answer skipped.
    coercions: () => {
        for (const v of convertible) {
            assertEq(toString(v), String(v))
            assertEq(toPropertyKey(v), Object.keys({ [/** @type {string} */ (v)]: 0 })[0])
            assert(Object.is(toNumber(v), Number(v)), String(v))
        }
        for (const v of values.filter(v => typeof v === 'bigint')) { assertEq(toString(v), String(v)) }
        // `number` is `Number(...)`, which converts a bigint, and a primitive that is one, too.
        for (const v of [...convertible, ...values.filter(v => typeof v === 'bigint'), { valueOf: () => 2n }]) {
            assert(Object.is(number(v), Number(v)), String(v))
        }
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
        assert(Number.isNaN(toNumeric(f)))
    },
    // `functionText` passes a function's text through.
    functionText: () => {
        assertEq(functionText('() => 0'), '() => 0')
    },
    // `add` is `+` on every pair that does not mix a bigint with a
    // number: two strings, a string with anything, or two numerics.
    add: () => {
        for (const [x, y] of pairs(operands)) {
            if (!mixed(x, y) || stringy(x) || stringy(y)) {
                assert(Object.is(add(x, y), /** @type {any} */ (x) + y), `${String(x)} + ${String(y)}`)
            }
        }
    },
    // `subtract`, `multiply`, `divide`, `remainder`, `shiftRight` and
    // `bitwiseAnd` are `- * / % >> &` on every pair that does not mix a
    // bigint with a number, nor divide a bigint by `0n`.
    arithmetic: () => {
        /** @type {readonly (readonly [(a: unknown, b: unknown) => unknown, (x: any, y: any) => unknown])[]} */
        const ops = [
            [subtract, (x, y) => x - y], [multiply, (x, y) => x * y], [divide, (x, y) => x / y],
            [remainder, (x, y) => x % y], [shiftRight, (x, y) => x >> y], [bitwiseAnd, (x, y) => x & y],
        ]
        for (const [x, y] of pairs(operands)) {
            if (!mixed(x, y)) {
                for (const [op, js] of ops) {
                    if ((op !== divide && op !== remainder) || y !== 0n) {
                        assert(Object.is(op(x, y), js(x, y)), `${String(x)} ${String(y)}`)
                    }
                }
            }
        }
    },
    // `negate` is unary `-`, a bigint's too.
    negate: () => {
        for (const x of operands) { assert(Object.is(negate(x), -/** @type {any} */ (x)), String(x)) }
    },
    // The relations are `< > <= >=` on every pair: strings by units, a
    // bigint against a number or a string, and `NaN` false either way.
    relations: () => {
        /** @type {readonly (readonly [(a: unknown, b: unknown) => boolean, (x: any, y: any) => unknown])[]} */
        const ops = [
            [lessThan, (x, y) => x < y],
            [greaterThan, (x, y) => x > y],
            [lessThanOrEqual, (x, y) => x <= y],
            [greaterThanOrEqual, (x, y) => x >= y],
        ]
        for (const [x, y] of pairs(operands)) {
            for (const [op, js] of ops) { assertEq(op(x, y), js(x, y), `${String(x)} ${String(y)}`) }
        }
    },
    // `get` reads a receiver's own members only, as NaNVM does, on every
    // receiver and key: an index by number or canonical string, `length`,
    // and an object's property, a number key by its string.
    get: () => {
        for (const r of receivers) { for (const k of keys) { assertEq(get(r, k), own(r, k), `${String(r)}[${String(k)}]`) } }
        assertEq(get('ab', 1), 'b')
        assertEq(get('\u{1F600}', 1), '\ude00')
        assertEq(get([10, 20], '1'), 20)
        assertEq(get(f, 'length'), 1)
        assertEq(get({ a: 1 }, 'a'), 1)
        // a prototype member, or a key of another type, is no member
        assertEq(get('ab', 'slice'), undefined)
        assertEq(get(f, 'name'), undefined)
        assertEq(get({ true: 1 }, true), undefined)
    },
    // `call` passes the arguments as they are.
    call: () => {
        assertStructurallySame(call((/** @type {unknown[]} */ ...xs) => xs, [1, 'a']), [1, 'a'])
        assertEq(call(f, ['x']), 'x')
    },
    // `toIterable` is what spread iterates: an array itself, a string's
    // code points, a lone surrogate as itself.
    toIterable: () => {
        assert(toIterable(a) === a)
        for (const v of ['', 'ab', '\u{1F600}x', '\ud83d', 'a\ude00\ud83d\ude00\ud83d']) {
            assertStructurallySame(toIterable(v), [...v])
        }
    },
    // `objectSpread` is what `{ ...v }` copies, for every kind.
    objectSpread: () => {
        for (const v of [...values, 'a\u{1F600}', [1, [2]]]) {
            assertStructurallySame(Object.entries(objectSpread(v)), Object.entries({ .../** @type {object} */ (v) }), String(v))
        }
    },
    // `ToIntegerOrInfinity` truncates toward zero, and `NaN` is `0`.
    toIntegerOrInfinity: () => {
        for (const [x, y] of /** @type {const} */ ([[NaN, 0], [1.9, 1], [-1.9, -1], [Infinity, Infinity], [-Infinity, -Infinity], [-0, 0]])) {
            assertEq(toIntegerOrInfinity(x), y)
        }
    },
    // A value other than `undefined` and `null` passes as it is.
    requireObjectCoercible: () => {
        for (const v of values.filter(v => v !== undefined && v !== null)) { assert(Object.is(requireObjectCoercible(v), v)) }
    },
    // Each method call is JavaScript's for a string or an array, and the
    // call of the receiver's own member for an object.
    methods: () => {
        for (const s of strings) {
            for (const k of keys) {
                const js = s.charCodeAt(/** @type {number} */ (k))
                const r = charCodeAt(s, k)
                assert(r === js || (r !== r && js !== js), `${s}.charCodeAt(${String(k)})`)
                assertEq(at(s, k), s.at(/** @type {number} */ (k)), `${s}.at(${String(k)})`)
            }
        }
        const list = [10, 'b', null, 30]
        for (const k of [...keys, -4, -5, -0.5, -Infinity]) {
            assertEq(at(list, k), list.at(/** @type {number} */ (k)), `.at(${String(k)})`)
        }
        /** Callbacks of every kind of answer, and one that reads the array it is given. @type {readonly ((x: unknown, i: number, a: unknown) => unknown)[]} */
        const callbacks = [() => true, () => 0, x => x, (_, i) => i % 2, (_, i, a) => a === list && i < 2]
        for (const g of callbacks) {
            assertStructurallySame(filter(list, g), list.filter(g))
            assertEq(every(list, g), list.every(g))
        }
        assertStructurallySame(filter([], f), [])
        assertEq(every([], f), true)
        // an object's own member is called
        const own = { charCodeAt: f, at: f, every: f, filter: f }
        assertEq(charCodeAt(own, 'x'), 'x')
        assertEq(at(own, 'y'), 'y')
        assertEq(every(own, 1), 1)
        assertEq(filter(own, 2), 2)
    },
    // Each throw is JavaScript's, with NaNVM's text.
    throw: {
        // both operands of a string comparison must be strings
        stringEqualsFirst: () => { stringEquals([], []) },
        stringEqualsSecond: () => { stringEquals('', []) },
        stringLessFirst: () => { stringLess([], '') },
        stringLessSecond: () => { stringLess('', [1]) },
        // a nullish receiver has no member, whatever the key
        getUndefined: () => { get(undefined, 'a') },
        getNull: () => { get(null, true) },
        // only a function can be called
        call: () => { call({}, []) },
        // only an array and a string are iterable
        toIterableNumber: () => { toIterable(1) },
        toIterableObject: () => { toIterable({}) },
        // a bigint and a number do not mix
        addMixed: () => { add(1n, 1) },
        subtractMixed: () => { subtract(1, 1n) },
        multiplyMixed: () => { multiply(1n, true) },
        divideMixed: () => { divide(null, 1n) },
        remainderMixed: () => { remainder(1n, 1) },
        shiftRightMixed: () => { shiftRight(1, 1n) },
        bitwiseAndMixed: () => { bitwiseAnd(1n, '1') },
        remainderZero: () => { remainder(1n, 0n) },
        // a bigint divided by zero
        divideZero: () => { divide(1n, 0n) },
        // the left primitive is taken first, and its throw wins
        lessThanLeft: () => { lessThan({ valueOf: () => { throw 'left' } }, {}) },
        // a bigint has no number
        toNumberBigInt: () => { toNumber(1n) },
        toNumberValueOf: () => { toNumber({ valueOf: () => 1n }) },
        // no method answers a primitive
        toStringNoPrimitive: () => { toString({ toString: () => ({}), valueOf: () => [] }) },
        toStringNotFunction: () => { toString({ toString: 1 }) },
        toNumberNoPrimitive: () => { toNumber({ toString: () => ({}) }) },
        // a method's throw passes through
        method: () => { toString({ toString: () => { throw 'x' } }) },
        // a nullish receiver is no object
        requireObjectCoercibleUndefined: () => { requireObjectCoercible(undefined) },
        requireObjectCoercibleNull: () => { requireObjectCoercible(null) },
        // a method call of a nullish receiver reads its member first
        charCodeAtNull: () => { charCodeAt(null, 0) },
        // a receiver without the method has no function to call
        charCodeAtArray: () => { charCodeAt([1], 0) },
        atNumber: () => { at(5, 0) },
        everyString: () => { every('ab', f) },
        filterObject: () => { filter({}, f) },
        // a callback must be a function, even for an empty array
        everyNotFunction: () => { every([], 1) },
        filterNotFunction: () => { filter([], undefined) },
        // a function without text, which only a WASM runtime can hold
        functionText: () => { functionText(undefined) },
    },
}
