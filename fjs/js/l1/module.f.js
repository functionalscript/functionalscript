/**
 * The L1 operations of the WASM runtime interface with a FunctionalScript
 * body ([`l1-design.md`](../../../doc/sasha-gil/wasm/l1-design.md)), written
 * over the [L0 view](../l0/module.f.js) and the [native rows](./native/module.f.js).
 * Only the WASM backend will compile this module. On a JavaScript host the
 * bodies run over the views' JavaScript bodies, and each is proved against
 * JavaScript's own operator.
 *
 * A body keeps the closure rule
 * ([`l1-design.md` §2](../../../doc/sasha-gil/wasm/l1-design.md#2-the-closure-rule)):
 * every operator has typed operands, known from a cast or an L0 function,
 * so the compiler lowers it to a WASM instruction or an L0 import and never
 * back to L1. In particular `===` and `<` on two strings lower to
 * {@link stringEquals} and {@link stringLess}, so those two compare units,
 * not strings.
 *
 * The operations join a slice at a time. So far: `typeof`, `ToBoolean`,
 * `===`, the string comparisons, and the coercions `ToPrimitive`,
 * `ToString`, `ToNumber`, `ToNumeric` and `ToPropertyKey`.
 *
 * A thrown value copies the text NaNVM throws for the same case
 * ([`error.rs`](../../../nanvm/lib/src/vm/error.rs)), so a native
 * substitution and its body throw the same value.
 *
 * @module
 */

import {
    ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED,
    asBoolean, asFunction, asNumber, asString, concat, find, item, kind, length, same, text, unit,
} from '../l0/module.f.js'
import { bigintEquals, bigintToString, numberToString, stringToNumber } from './native/module.f.js'

/** The answer of `typeof` for each kind tag, in tag order. */
const typeNames = /** @type {const} */ (['undefined', 'object', 'boolean', 'number', 'string', 'bigint', 'object', 'object', 'function'])

/**
 * The `typeof` operator: the name of a value's type, `'object'` for `null`
 * and an array as well as an object.
 *
 * @type {(v: unknown) => string}
 */
export const typeOf = v => typeNames[Number(kind(v))]

/**
 * [`ToBoolean`](https://tc39.es/ecma262/#sec-toboolean), the operation a
 * condition, `!` and `&&` apply to a value of unknown type: `false` for
 * `undefined`, `null`, `false`, both zeros, `NaN`, `''` and `0n`, `true`
 * for everything else. A bigint is canonical, so it is zero exactly when it
 * has no words.
 *
 * @type {(v: unknown) => boolean}
 */
export const toBoolean = v => {
    const k = kind(v)
    if (k === BOOLEAN) { return asBoolean(v) }
    if (k === NUMBER) {
        const n = asNumber(v)
        return n === n && n !== 0
    }
    if (k === STRING || k === BIGINT) { return length(v) !== 0 }
    return k === ARRAY || k === OBJECT || k === FUNCTION
}

/**
 * Whether two strings hold the same units: `===` on two strings. Each
 * operand must be a string, as for `unit`: `length` alone would answer for
 * two arrays too.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const stringEquals = (a, b) => {
    const n = length(asString(a))
    asString(b)
    if (n !== length(b)) { return false }
    let i = 0
    while (i < n && unit(a, i) === unit(b, i)) {
        i = i + 1
    }
    return i === n
}

/**
 * Whether string `a` sorts before string `b`: `<` on two strings, unit by
 * unit, a proper prefix first. Each operand must be a string.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const stringLess = (a, b) => {
    const na = length(asString(a))
    const nb = length(asString(b))
    let i = 0
    while (i < na && i < nb && unit(a, i) === unit(b, i)) {
        i = i + 1
    }
    return i < na && i < nb ? unit(a, i) < unit(b, i) : na < nb
}

/**
 * [`IsStrictlyEqual`](https://tc39.es/ecma262/#sec-isstrictlyequal), the
 * `===` operator on values of unknown type: values of two kinds differ;
 * numbers compare as numbers, so `NaN` is not equal to itself and the two
 * zeros are equal; strings by units, bigints by value through the native
 * row, and arrays, objects and functions by identity. `!==` is its
 * negation.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const strictEquals = (a, b) => {
    const k = kind(a)
    if (k !== kind(b)) { return false }
    if (k === BOOLEAN) { return asBoolean(a) === asBoolean(b) }
    if (k === NUMBER) { return asNumber(a) === asNumber(b) }
    if (k === STRING) { return stringEquals(a, b) }
    if (k === BIGINT) { return bigintEquals(a, b) }
    if (k === ARRAY || k === OBJECT || k === FUNCTION) { return same(a, b) }
    return true
}

/**
 * Whether a value is a primitive: `undefined`, `null`, a boolean, a
 * number, a string or a bigint, the kinds whose tags come before an
 * array's.
 *
 * @type {(v: unknown) => boolean}
 */
const isPrimitive = v => kind(v) < ARRAY

/**
 * The text of a function, which `ToPrimitive` answers for it. A WASM
 * runtime may hold a function without text, a host function, and then
 * this throws, as NaNVM does. A JavaScript host always has the text, so
 * the check is proved on the text alone.
 *
 * @type {(t: unknown) => string}
 */
export const functionText = t => {
    if (kind(t) !== STRING) { throw 'TypeError: Cannot convert a function to its text' }
    return /** @type {string} */ (t)
}

/**
 * The result of one of an object's conversion methods, `valueOf` or
 * `toString`: `[p]` for a primitive `p`, or `[]` to try the next method.
 * An own property that is a function is called with no arguments, and its
 * result counts only when it is a primitive. An own property of another
 * kind is skipped. Without the property, `stock` is the answer of the
 * method an object inherits: `[]` for `valueOf`, which answers the object
 * itself, and `['[object Object]']` for `toString`.
 *
 * @type {(o: unknown, name: string, stock: readonly unknown[]) => readonly unknown[]}
 */
const method = (o, name, stock) => {
    const i = find(o, name)
    if (i < 0) { return stock }
    const m = item(o, i)
    if (kind(m) !== FUNCTION) { return [] }
    const r = asFunction(m)()
    return isPrimitive(r) ? [r] : []
}

/**
 * [`OrdinaryToPrimitive`](https://tc39.es/ecma262/#sec-ordinarytoprimitive)
 * of an object: its `valueOf`, then its `toString`, or the other way
 * round when a string is preferred, the first primitive either answers.
 *
 * @type {(o: unknown, preferString: boolean) => unknown}
 */
const objectToPrimitive = (o, preferString) => {
    const valueOf = () => method(o, 'valueOf', [])
    const toString = () => method(o, 'toString', ['[object Object]'])
    const first = preferString ? toString() : valueOf()
    if (length(first) !== 0) { return item(first, 0) }
    const second = preferString ? valueOf() : toString()
    if (length(second) === 0) { throw 'TypeError: Cannot convert to primitive value' }
    return item(second, 0)
}

/**
 * [`ToString`](https://tc39.es/ecma262/#sec-tostring): a number and a
 * bigint through the native rows; an array as its `toString` answers it,
 * [`join`](https://tc39.es/ecma262/#sec-array.prototype.join) with `,`,
 * each item through `ToString` and `undefined` and `null` as nothing; a
 * function's text; and an object through its own `toString` and
 * `valueOf`, in that order. Arrays are joined here, not through
 * {@link toPrimitive}, because a body may call itself but not a function
 * that calls it back.
 *
 * @type {(v: unknown) => string}
 */
export const toString = v => {
    const k = kind(v)
    if (k === UNDEFINED) { return 'undefined' }
    if (k === NULL) { return 'null' }
    if (k === BOOLEAN) { return asBoolean(v) ? 'true' : 'false' }
    if (k === NUMBER) { return numberToString(v) }
    if (k === STRING) { return /** @type {string} */ (v) }
    if (k === BIGINT) { return bigintToString(v) }
    if (k === FUNCTION) { return functionText(text(v)) }
    if (k === OBJECT) { return toString(objectToPrimitive(v, true)) }
    const n = length(v)
    let s = { i: 0, text: '' }
    while (s.i < n) {
        const x = item(v, s.i)
        const kx = kind(x)
        const t = kx === UNDEFINED || kx === NULL ? '' : toString(x)
        s = { i: s.i + 1, text: s.i === 0 ? t : concat(concat(s.text, ','), t) }
    }
    return s.text
}

/**
 * [`ToPrimitive`](https://tc39.es/ecma262/#sec-toprimitive): a primitive
 * as it is; an array's string, since its `valueOf` answers the array
 * itself; a function's text; and an object through its own `valueOf` and
 * `toString`, in the order `preferString` picks.
 *
 * @type {(v: unknown, preferString: boolean) => unknown}
 */
export const toPrimitive = (v, preferString) => {
    const k = kind(v)
    if (k === ARRAY || k === FUNCTION) { return toString(v) }
    if (k === OBJECT) { return objectToPrimitive(v, preferString) }
    return v
}

/**
 * [`ToNumber`](https://tc39.es/ecma262/#sec-tonumber): a string through
 * the native row, a bigint throws, and an array or an object through its
 * primitive, a number preferred. A function is `NaN` without its text, as
 * in NaNVM: no function's text spells a number.
 *
 * @type {(v: unknown) => number}
 */
export const toNumber = v => {
    const k = kind(v)
    if (k === UNDEFINED || k === FUNCTION) { return NaN }
    if (k === NULL) { return 0 }
    if (k === BOOLEAN) { return asBoolean(v) ? 1 : 0 }
    if (k === NUMBER) { return asNumber(v) }
    if (k === STRING) { return stringToNumber(v) }
    if (k === BIGINT) { throw 'TypeError: Cannot convert a BigInt value to a number' }
    return toNumber(toPrimitive(v, false))
}

/**
 * [`ToNumeric`](https://tc39.es/ecma262/#sec-tonumeric): the primitive, a
 * number preferred, as it is when it is a bigint, else its number.
 *
 * @type {(v: unknown) => unknown}
 */
export const toNumeric = v => {
    const p = toPrimitive(v, false)
    return kind(p) === BIGINT ? p : toNumber(p)
}

/**
 * [`ToPropertyKey`](https://tc39.es/ecma262/#sec-topropertykey): the
 * language has no symbols, so a key is always a string, and the key is
 * {@link toString} of the value, which already prefers a string.
 *
 * @type {(v: unknown) => string}
 */
export const toPropertyKey = v => toString(v)
