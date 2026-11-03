/**
 * The L1 operations of the WASM runtime interface with a FunctionalScript
 * body ([`l1-design.md`](../../../../doc/sasha-gil/wasm/l1-design.md)), written
 * over the [L0 view](../l0/module.f.js) and the [native rows](./native/module.f.js).
 * Only the WASM backend will compile this module. On a JavaScript host the
 * bodies run over the views' JavaScript bodies, and each is proved against
 * JavaScript's own operator.
 *
 * A body keeps the closure rule
 * ([`l1-design.md` §2](../../../../doc/sasha-gil/wasm/l1-design.md#2-the-closure-rule)):
 * every operator has typed operands, known from a cast or an L0 function,
 * so the compiler lowers it to a WASM instruction or an L0 import and never
 * back to L1. In particular `===` and `<` on two strings lower to
 * {@link stringEquals} and {@link stringLess}, so those two compare units,
 * not strings.
 *
 * The operations join a slice at a time. So far: `typeof`, `ToBoolean`,
 * `===`, the string comparisons, the coercions `ToPrimitive`,
 * `ToString`, `ToNumber`, `ToNumeric` and `ToPropertyKey`, the arithmetic
 * operators `+ - * /` and unary `-`, the relations `< <= > >=`, the
 * member read `a[k]`, a call of an unknown value, and the iterations:
 * array spread, `for...of` and array destructuring of an unknown value
 * through `toIterable`, and object spread through `objectSpread`.
 *
 * A thrown value copies the text NaNVM throws for the same case
 * ([`error.rs`](../../../../nanvm/lib/src/vm/error.rs)), so a native
 * substitution and its body throw the same value.
 *
 * @module
 */

import {
    ARRAY, BIGINT, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING, UNDEFINED,
    asArray, asBoolean, asFunction, asNumber, asObject, asString, concat, find, fromUnit, item, kind, length,
    same, substring, text, unit,
} from '../l0/module.f.js'
import {
    bigintAdd, bigintDivide, bigintEquals, bigintLess, bigintMultiply, bigintNegate, bigintSubtract,
    bigintToString, numberToString, stringToNumber,
} from './native/module.f.js'

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
 * number preferred, as it is when it is a bigint, else its number. A
 * function is `NaN` without its text, as in {@link toNumber}, so a
 * function without text converts too.
 *
 * @type {(v: unknown) => unknown}
 */
export const toNumeric = v => {
    if (kind(v) === FUNCTION) { return NaN }
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

/**
 * Whether two numeric values, each a number or a bigint, are bigints: an
 * arithmetic operator's choice between the native bigint row and the WASM
 * instruction. A number and a bigint together throw, as JavaScript does.
 *
 * @type {(x: unknown, y: unknown) => boolean}
 */
const bigintPair = (x, y) => {
    const kx = kind(x)
    if (kx !== kind(y)) { throw 'TypeError: Cannot mix BigInt and other types, use explicit conversions' }
    return kx === BIGINT
}

/**
 * The `+` operator: a string when either primitive is a string, else a
 * sum of two numbers or two bigints. Both primitives are taken before
 * either is converted, the left first.
 *
 * @type {(a: unknown, b: unknown) => unknown}
 */
export const add = (a, b) => {
    const pa = toPrimitive(a, false)
    const pb = toPrimitive(b, false)
    if (kind(pa) === STRING || kind(pb) === STRING) { return concat(toString(pa), toString(pb)) }
    const x = toNumeric(pa)
    const y = toNumeric(pb)
    return bigintPair(x, y) ? bigintAdd(x, y) : asNumber(x) + asNumber(y)
}

/**
 * The `-` operator on values of unknown type.
 *
 * @type {(a: unknown, b: unknown) => unknown}
 */
export const subtract = (a, b) => {
    const x = toNumeric(a)
    const y = toNumeric(b)
    return bigintPair(x, y) ? bigintSubtract(x, y) : asNumber(x) - asNumber(y)
}

/**
 * The `*` operator on values of unknown type.
 *
 * @type {(a: unknown, b: unknown) => unknown}
 */
export const multiply = (a, b) => {
    const x = toNumeric(a)
    const y = toNumeric(b)
    return bigintPair(x, y) ? bigintMultiply(x, y) : asNumber(x) * asNumber(y)
}

/**
 * The `/` operator on values of unknown type. A bigint divided by `0n`
 * throws in the native row.
 *
 * @type {(a: unknown, b: unknown) => unknown}
 */
export const divide = (a, b) => {
    const x = toNumeric(a)
    const y = toNumeric(b)
    return bigintPair(x, y) ? bigintDivide(x, y) : asNumber(x) / asNumber(y)
}

/**
 * The unary `-` operator on a value of unknown type.
 *
 * @type {(a: unknown) => unknown}
 */
export const negate = a => {
    const x = toNumeric(a)
    return kind(x) === BIGINT ? bigintNegate(x) : -asNumber(x)
}

/**
 * [`IsLessThan`](https://tc39.es/ecma262/#sec-islessthan) of two
 * primitives: `1` for less, `0` for not less, `-1` for undefined, where a
 * `NaN` takes part. Two strings compare by units. A comparison with a
 * bigint goes to the native row, with a string kept as it is, since it is
 * read as a bigint there, and any other primitive made a number.
 *
 * @type {(a: unknown, b: unknown) => number}
 */
const less = (a, b) => {
    const ka = kind(a)
    const kb = kind(b)
    if (ka === STRING && kb === STRING) { return stringLess(a, b) ? 1 : 0 }
    if (ka === BIGINT || kb === BIGINT) {
        return bigintLess(ka === BIGINT || ka === STRING ? a : toNumber(a), kb === BIGINT || kb === STRING ? b : toNumber(b))
    }
    const x = toNumber(a)
    const y = toNumber(b)
    if (x !== x || y !== y) { return -1 }
    return x < y ? 1 : 0
}

/**
 * The `<` operator on values of unknown type. The primitives, a number
 * preferred, are taken left first for every relation.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const lessThan = (a, b) => {
    const pa = toPrimitive(a, false)
    return less(pa, toPrimitive(b, false)) === 1
}

/**
 * The `>` operator: `b < a`, with the primitives taken left first.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const greaterThan = (a, b) => {
    const pa = toPrimitive(a, false)
    return less(toPrimitive(b, false), pa) === 1
}

/**
 * The `<=` operator: not `b < a`, and false where that is undefined.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const lessThanOrEqual = (a, b) => {
    const pa = toPrimitive(a, false)
    return less(toPrimitive(b, false), pa) === 0
}

/**
 * The `>=` operator: not `a < b`, and false where that is undefined.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const greaterThanOrEqual = (a, b) => {
    const pa = toPrimitive(a, false)
    return less(pa, toPrimitive(b, false)) === 0
}

/**
 * A number as an array or string index, the `canonical_index` of NaNVM:
 * an integer from `0` to `0xffff_ffff`, `-0` read as `0`, or `-1` for any
 * other number, which no index matches.
 *
 * @type {(n: number) => number}
 */
const numberIndex = n => n % 1 === 0 && n >= 0 && n <= 0xffff_ffff ? n : -1

/**
 * The digit a UTF-16 unit spells, or `-1`.
 *
 * @type {(u: number) => number}
 */
const digit = u => u >= 0x30 && u <= 0x39 ? u - 0x30 : -1

/**
 * A string as an array or string index: the decimal spelling of an
 * integer up to `0xffff_ffff`, with no sign and no leading zero, or `-1`.
 *
 * @type {(s: unknown) => number}
 */
const stringIndex = s => {
    const n = length(s)
    if (n === 0 || n > 1 && unit(s, 0) === 0x30) { return -1 }
    let r = { i: 0, value: 0 }
    while (r.i < n && r.value >= 0) {
        const d = digit(unit(s, r.i))
        const value = d < 0 ? -1 : r.value * 10 + d
        r = { i: r.i + 1, value: value > 0xffff_ffff ? -1 : value }
    }
    return r.value
}

/**
 * The member read `a[k]` and `a.k`, NaNVM's rules: a receiver's own
 * members only, no prototype. `undefined` and `null` throw. An object
 * reads its own property, a number key by its string. An array or a
 * string reads an index, by a number or by its canonical string, and its
 * `length`; a string's index is a one-unit string. A function reads its
 * `length`. Every other key, receiver or index out of bounds answers
 * `undefined`. The key is a number or a string, as the compiler emits it;
 * any other key answers `undefined`.
 *
 * @type {(a: unknown, k: unknown) => unknown}
 */
export const get = (a, k) => {
    const ka = kind(a)
    if (ka === UNDEFINED || ka === NULL) { throw 'TypeError: Cannot convert undefined or null to object' }
    const kk = kind(k)
    if (kk !== NUMBER && kk !== STRING) { return undefined }
    if (ka === OBJECT) {
        const i = find(a, kk === NUMBER ? numberToString(k) : k)
        return i < 0 ? undefined : item(a, i)
    }
    const isLength = kk === STRING && stringEquals(k, 'length')
    if (ka === FUNCTION) { return isLength ? length(a) : undefined }
    if (ka !== ARRAY && ka !== STRING) { return undefined }
    if (isLength) { return length(a) }
    const i = kk === NUMBER ? numberIndex(asNumber(k)) : stringIndex(k)
    if (i < 0 || i >= length(a)) { return undefined }
    return ka === ARRAY ? item(a, i) : fromUnit(unit(a, i))
}

/**
 * A call of a value of unknown type with an array of arguments. A value
 * that is not a function throws NaNVM's `TypeError`.
 *
 * @type {(f: unknown, args: unknown) => unknown}
 */
export const call = (f, args) => {
    if (kind(f) !== FUNCTION) { throw 'TypeError: unexpected type' }
    return asFunction(f)(...asArray(args))
}

/**
 * Whether a UTF-16 unit is in a range, `low` to `high` inclusive.
 *
 * @type {(u: number, low: number, high: number) => boolean}
 */
const inRange = (u, low, high) => u >= low && u <= high

/**
 * `GetIterator` of a value of unknown type, as the array it walks: an
 * array as it is, and a string as its code points, a surrogate pair as one
 * string and a lone surrogate as itself. Any other value throws NaNVM's
 * `TypeError`. Spread, `for...of` and array destructuring walk the answer
 * with L0 `length` and `item`. A string costs one copy per code point, as
 * a reference body may.
 *
 * @type {(v: unknown) => readonly unknown[]}
 */
export const toIterable = v => {
    const k = kind(v)
    if (k === ARRAY) { return asArray(v) }
    if (k !== STRING) { throw 'TypeError: value is not iterable' }
    const n = length(v)
    let r = { i: 0, points: /** @type {readonly unknown[]} */ ([]) }
    while (r.i < n) {
        const pair = r.i + 1 < n && inRange(unit(v, r.i), 0xd800, 0xdbff) && inRange(unit(v, r.i + 1), 0xdc00, 0xdfff)
        const end = pair ? r.i + 2 : r.i + 1
        r = { i: end, points: [...asArray(r.points), substring(v, r.i, end)] }
    }
    return r.points
}

/**
 * The properties `{ ...v }` copies from a value of unknown type, as an
 * object: an object's own properties, an array's items and a string's
 * units under their index keys, and nothing from any other value,
 * `undefined` and `null` included. One copy per property, as a reference
 * body may.
 *
 * @type {(v: unknown) => { readonly [k in string]: unknown }}
 */
export const objectSpread = v => {
    const k = kind(v)
    if (k === OBJECT) { return asObject(v) }
    if (k !== ARRAY && k !== STRING) { return {} }
    const n = length(v)
    let r = { i: 0, o: {} }
    while (r.i < n) {
        const x = k === ARRAY ? item(v, r.i) : fromUnit(unit(v, r.i))
        r = { i: r.i + 1, o: { ...asObject(r.o), [numberToString(r.i)]: x } }
    }
    return r.o
}
