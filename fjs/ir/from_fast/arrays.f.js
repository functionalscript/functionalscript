/**
 * The FunctionalScript originals of slice 6e: functions that make arrays of
 * values, each built by Containers' builder. The empty array; a pair of
 * values; an array that holds another, a string literal and Any's
 * constants; one whose item a call answers, owned; one that a function
 * reads and drops; and one that the module defines, which `init` builds.
 * The lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves, with no value and no builder left over. Their signatures are
 * in [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { concat, item, length } from '../../wasm/runtime/l0/module.f.js'

/** An array that the module defines. */
const letters = /** @type {const} */ (['a', 'b'])

/** The empty array. @type {() => readonly unknown[]} */
export const none = () => []

/** Two values. @type {(a: unknown, b: unknown) => readonly unknown[]} */
export const pair = (a, b) => [a, b]

/** A value in an array of its own, then a string and Any's constants. @type {(v: unknown) => readonly unknown[]} */
export const nested = v => [[v], 'x', undefined, null]

/** How many items an array of a string and of the string twice has. @type {(s: unknown) => number} */
export const counted = s => length([s, concat(s, s)])

/** The second of two values, read from an array of both. @type {(a: unknown, b: unknown) => unknown} */
export const second = (a, b) => item([a, b], 1)

/** The array that the module defines. @type {() => readonly unknown[]} */
export const both = () => letters
