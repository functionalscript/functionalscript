/**
 * The FunctionalScript originals of slice 6b: functions that make strings
 * and read items through the L0 view, values that the caller owns. The
 * lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves, with nothing left over. Their signatures are in
 * [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { ARRAY, OBJECT, asString, concat, fromUnit, item, kind, length, substring, unit } from '../../wasm/runtime/l0/module.f.js'

/** The string of two UTF-16 units. @type {(a: number, b: number) => string} */
export const pair = (a, b) => concat(fromUnit(a), fromUnit(b))

/** A string twice. @type {(s: unknown) => string} */
export const twice = s => concat(s, s)

/** A string without its first unit and its last. @type {(s: unknown) => string} */
export const inner = s => substring(s, 1, length(s) - 1)

/** A string without the spaces it starts with: a loop that owns its string, one unit shorter each round. @type {(s: unknown) => string} */
export const trimStart = s => {
    let t = asString(s)
    while (length(t) > 0 && unit(t, 0) === 0x20) {
        t = substring(t, 1, length(t))
    }
    return t
}

/** The last unit of a string twice, and its length, or `-1` for the empty string: a return before the end, while the function owns a string. @type {(s: unknown) => number} */
export const lastOfTwice = s => {
    const t = concat(s, s)
    if (length(t) === 0) { return -1 }
    return unit(t, length(t) - 1) + length(t)
}

/** The first item of an array, the value of an object's first property, or the value itself. @type {(v: unknown) => unknown} */
export const first = v => {
    const k = kind(v)
    return (k === ARRAY || k === OBJECT) && length(v) > 0 ? item(v, 0) : v
}
