/**
 * The bodies of today's natives as L1 operations
 * ([`l2-design.md` §2](../../../../../doc/sasha-gil/wasm/l2-design.md#2-todays-natives-become-l1-operations)):
 * the intrinsics `charCodeAt` and `slice` of
 * [`fjs/js/intrinsic`](../../../../js/intrinsic/module.f.js), the statics
 * `String.fromCharCode` and `Object.entries`, and the helpers `entry` and
 * `hasEntry` of [`fjs/types/object/entry`](../../../../types/object/entry/module.f.js).
 * Each is written over the [L0 view](../../l0/module.f.js) and the L1
 * operations, and proved against the host's own function.
 *
 * [`fjs/js/runtime`](../../../../js/runtime/module.f.js) does not change:
 * the WASM backend binds these names to the bodies here, while the
 * interpreter and the Rust backend keep answering them natively.
 *
 * @module
 */

import {
    ARRAY, NULL, OBJECT, STRING, UNDEFINED,
    asArray, asString, buildArray, find, fromUnit, item, join, key, kind, length, substring, unit,
} from '../../l0/module.f.js'
import { stringIndex, toNumber, toPropertyKey } from '../module.f.js'
import { error } from '../error/module.f.js'
import { numberToString } from '../native/module.f.js'

/**
 * [`ToIntegerOrInfinity`](https://tc39.es/ecma262/#sec-tointegerorinfinity)
 * of a number: `0` for `NaN`, an infinity as it is, anything else
 * truncated toward zero.
 *
 * @type {(x: number) => number}
 */
const integer = x => x !== x ? 0 : x === Infinity || x === -Infinity ? x : x - x % 1

/**
 * [`String.prototype.charCodeAt`](https://tc39.es/ecma262/#sec-string.prototype.charcodeat):
 * the UTF-16 unit of `s` at the position `at` converts to, or `NaN` outside
 * the string.
 *
 * @type {(s: unknown, at: unknown) => number}
 */
export const charCodeAt = (s, at) => {
    const n = length(asString(s))
    const p = integer(toNumber(at))
    return p >= 0 && p < n ? unit(s, p) : NaN
}

/**
 * A position of [`String.prototype.slice`](https://tc39.es/ecma262/#sec-string.prototype.slice)
 * in a string of `n` units: a negative one counts from the end, and either
 * is clamped to `0` to `n`.
 *
 * @type {(x: number, n: number) => number}
 */
const position = (x, n) => {
    const p = integer(x)
    return p < 0 ? (n + p < 0 ? 0 : n + p) : (p < n ? p : n)
}

/**
 * `String.prototype.slice`: the units of `s` from `start` up to `end`,
 * `end` the length when it is `undefined`, and `''` when `end` is not past
 * `start`.
 *
 * @type {(s: unknown, start: unknown, end: unknown) => string}
 */
export const slice = (s, start, end) => {
    const n = length(asString(s))
    const from = position(toNumber(start), n)
    const to = kind(end) === UNDEFINED ? n : position(toNumber(end), n)
    return substring(s, from, to < from ? from : to)
}

/**
 * [`ToUint16`](https://tc39.es/ecma262/#sec-touint16) of a number.
 *
 * @type {(x: number) => number}
 */
const uint16 = x => {
    const m = x === Infinity || x === -Infinity ? 0 : integer(x) % 0x1_0000
    return m < 0 ? m + 0x1_0000 : m + 0
}

/**
 * [`String.fromCharCode`](https://tc39.es/ecma262/#sec-string.fromcharcode),
 * with its arguments as an array, as every variadic L1 operation takes
 * them: a string of one unit per argument, each `ToUint16` of its number.
 *
 * @type {(args: unknown) => string}
 */
export const fromCharCode = args => {
    const a = asArray(args)
    return join(buildArray(length(a), 0, i => i + 1, i => fromUnit(uint16(toNumber(item(a, i))))), '')
}

/**
 * [`Object.entries`](https://tc39.es/ecma262/#sec-object.entries), by
 * kind: an object's properties in order; an array's items and a string's
 * units under their index keys; a `TypeError` for `undefined` and `null`;
 * and `[]` for any other kind, which owns nothing enumerable.
 *
 * @type {(o: unknown) => readonly unknown[]}
 */
export const entries = o => {
    const k = kind(o)
    if (k === UNDEFINED || k === NULL) { throw error.nullishToObject }
    if (k === OBJECT) { return buildArray(length(o), 0, i => i + 1, i => [key(o, i), item(o, i)]) }
    if (k !== ARRAY && k !== STRING) { return [] }
    return buildArray(length(o), 0, i => i + 1, i => [numberToString(i), k === ARRAY ? item(o, i) : fromUnit(unit(o, i))])
}

/**
 * The entry `entry` and `hasEntry` read: `[v]` for the value `v` of the
 * enumerable own property `k` names, or `[]`. The key is converted first.
 * An object's property is found by `find`; an array's item and a string's
 * unit by a canonical index below the length. Any other kind owns nothing
 * enumerable. `undefined` and `null` throw.
 *
 * @type {(o: unknown, k: unknown) => readonly unknown[]}
 */
const own = (o, k) => {
    const ko = kind(o)
    if (ko === UNDEFINED || ko === NULL) { throw error.nullishToObject }
    const name = toPropertyKey(k)
    if (ko === OBJECT) {
        const i = find(o, name)
        return i < 0 ? [] : [item(o, i)]
    }
    if (ko !== ARRAY && ko !== STRING) { return [] }
    const i = stringIndex(name)
    if (i < 0 || i >= length(o)) { return [] }
    return [ko === ARRAY ? item(o, i) : fromUnit(unit(o, i))]
}

/**
 * The `entry` helper: the value of the enumerable own property `k` names,
 * or `undefined`.
 *
 * @type {(o: unknown, k: unknown) => unknown}
 */
export const entry = (o, k) => {
    const e = own(o, k)
    return length(e) === 0 ? undefined : item(e, 0)
}

/**
 * The `hasEntry` helper: whether there is an enumerable own property `k`
 * names, one holding `undefined` included.
 *
 * @type {(o: unknown, k: unknown) => boolean}
 */
export const hasEntry = (o, k) => length(own(o, k)) !== 0
