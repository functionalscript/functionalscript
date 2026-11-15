/**
 * The FunctionalScript originals of slice 8b: functions that build arrays
 * by the L0 view's `buildArray`, which the lowering writes as one loop of
 * Containers' builder. The units of a string; a value repeated a number
 * of times, which must be an index; arrays of arrays; a state that is a
 * record; and two whose callbacks call functions that throw, which shows
 * the view's order: an item before the next state. The
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves. Their signatures are in [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { buildArray, length, substring } from '../../wasm/runtime/l0/module.f.js'

/** The UTF-16 units of a string, each a string. @type {(s: unknown) => readonly unknown[]} */
export const units = s => buildArray(length(s), 0, i => i + 1, i => substring(s, i, i + 1))

/** A value, `n` times. @type {(v: unknown, n: number) => readonly unknown[]} */
export const repeated = (v, n) => buildArray(n, 0, i => i + 1, () => v)

/** Rows of a value: the first empty, the second of one. @type {(v: unknown) => readonly unknown[]} */
export const rows = v => buildArray(2, 0, i => i + 1, i => buildArray(i, 0, j => j + 1, () => v))

/** The units of a string from its end, by a state of two numbers. @type {(s: unknown) => readonly unknown[]} */
export const backwards = s => buildArray(length(s), { i: length(s) - 1, k: 0 }, r => ({ i: r.i - 1, k: r.k + 1 }), r => substring(s, r.i, r.i + 1))

/** The next state after `s`, which throws at `0`. @type {(s: number) => number} */
export const step = s => {
    if (s === 0) { throw 'step' }
    return s + 1
}

/** `v`, which throws at the state `0`. @type {(v: unknown, s: number) => unknown} */
export const at = (v, s) => {
    if (s === 0) { throw 'at' }
    return v
}

/** Two items whose `next` and `at` both throw at the first state: `at` throws first. @type {(v: unknown) => readonly unknown[]} */
export const ordered = v => buildArray(2, 0, s => step(s), s => at(v, s))

/** Two items whose `next` throws at the first state, after the first item. @type {(v: unknown) => readonly unknown[]} */
export const stepped = v => buildArray(2, 0, s => step(s), () => v)
