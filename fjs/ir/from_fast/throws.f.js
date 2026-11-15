/**
 * The FunctionalScript originals of slice 7b: functions that throw. A
 * throw of a string literal where a value is no string; a throw of the
 * value itself; L1's `bigintPair`, copied, which throws one of
 * [L1's errors](../../wasm/runtime/l1/error/module.f.js) for operands of
 * two kinds; and the sign of a float, which throws two others, one after
 * the other. The
 * lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves: each throws what its original throws, and leaves nothing
 * behind. Their signatures are in [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { BIGINT, STRING, kind, length } from '../../wasm/runtime/l0/module.f.js'
import { error } from '../../wasm/runtime/l1/error/module.f.js'

/** The length of a string, and a throw of a literal for any other value. @type {(v: unknown) => number} */
export const textLength = v => {
    if (kind(v) !== STRING) { throw 'not a string' }
    return length(v)
}

/** A throw of the value itself. @type {(v: unknown) => unknown} */
export const rethrow = v => {
    throw v
}

/**
 * L1's `bigintPair`, copied: L1 calls it only from its arithmetic, which a
 * later slice lowers. Whether two operands are both bigints, and a throw
 * of L1's error where they are of two kinds.
 *
 * @type {(x: unknown, y: unknown) => boolean}
 */
const bigintPair = (x, y) => {
    const kx = kind(x)
    if (kx !== kind(y)) { throw error.mixedNumericOperands }
    return kx === BIGINT
}

/** @type {(x: unknown, y: unknown) => boolean} */
export const bigints = (x, y) => bigintPair(x, y)

/** The sign of a float, and a throw of one of L1's errors for a NaN, and of another for a zero. @type {(x: number) => number} */
export const sign = x => {
    if (x !== x) { throw error.unexpectedType }
    if (x === 0) { throw error.divisionByZero }
    return x < 0 ? -1 : 1
}
