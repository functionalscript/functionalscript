/**
 * The FunctionalScript originals of slice 6f: functions that read an array
 * at a number key, by L1's `get` rules for that case. One of two values at
 * an index of any float, which reads `undefined` past them, at a fraction
 * and at a NaN; the only item of an array at a literal index; an item of
 * an array that the module defines; and an array read from an array. The
 * lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves, with no value and no builder left over. Their signatures are
 * in [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

/** An array that the module defines. */
const letters = /** @type {const} */ (['a', 'b', 'c'])

/** One of two values, at an index. @type {(a: unknown, b: unknown, k: number) => unknown} */
export const pick = (a, b, k) => [a, b][Number(k)]

/** The only item of an array. @type {(a: unknown) => unknown} */
export const only = a => [a][0]

/** A letter of the array that the module defines. @type {(k: number) => unknown} */
export const letter = k => letters[Number(k)]

/** The array that holds a value, read from an array of it. @type {(a: unknown, k: number) => unknown} */
export const inner = (a, k) => [[a], 'x'][Number(k)]
