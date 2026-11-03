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
 * The operations join a slice at a time: this one holds `typeof`,
 * `ToBoolean`, `===` and the string comparisons.
 *
 * @module
 */

import {
    ARRAY, BIGINT, BOOLEAN, FUNCTION, NUMBER, OBJECT, STRING,
    asBoolean, asNumber, asString, kind, length, same, unit,
} from '../l0/module.f.js'
import { bigintEquals } from './native/module.f.js'

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
