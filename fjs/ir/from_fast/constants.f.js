/**
 * The FunctionalScript originals of slice 6c: functions that read the
 * module's other definitions, each a constant that `init` evaluates once,
 * in their order, before any call. Floats, one of them read by another,
 * one that a function of the module computes and one that a function it
 * does not export computes; a condition; strings, which the module owns
 * and its functions borrow; and `undefined`, a constant of Any. The
 * lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves, with nothing left over. Their signatures are in
 * [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { NUMBER, STRING, concat, fromUnit, kind } from '../../wasm/runtime/l0/module.f.js'

// floats

const half = 1 / 2

/** A constant that reads another. */
const quarter = half * half

/** @type {(x: number) => number} */
export const scale = x => x * quarter + half

/** A function of the module, which a constant calls. @type {(x: number) => number} */
export const twice = x => x + x

const four = twice(2)

/** A function that the module does not export, which a constant inlines. @type {(x: number) => number} */
const cube = x => x * x * x

const eight = cube(2)

/** @type {(x: number) => number} */
export const shift = x => x + four - eight

// a condition

const less = quarter < half

/** @type {(x: number) => number} */
export const narrow = x => less ? x * half : x

// values of unknown kind

/** A string of one UTF-16 unit, and one that joins it twice. */
const dash = fromUnit(0x2d)

const dashes = concat(dash, dash)

/** A string between dashes, or a dash for any other value. @type {(v: unknown) => unknown} */
export const dashed = v => kind(v) === STRING ? concat(concat(dashes, v), dashes) : dash

/** A number, or `undefined` for any other value. @type {(v: unknown) => unknown} */
export const numberOrUndefined = v => kind(v) === NUMBER ? v : undefined
