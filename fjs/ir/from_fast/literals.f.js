/**
 * The FunctionalScript originals of slice 6d: functions that read string
 * literals, each a value that the module's start function makes once and
 * that nothing drops. One that the module writes three times, once through
 * a definition of the module, which the normalization writes where a
 * function reads it; the empty string; a word past ASCII and a pair of
 * surrogates. The lowering writes their plain stage, the
 * [lifetime pass](../lifetime/module.f.js) their owned stage, and the
 * [host proof](./proof.mjs) runs them as WASM against the functions
 * themselves, with nothing left over. Their signatures are in
 * [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

import { STRING, concat, kind, length, unit } from '../../wasm/runtime/l0/module.f.js'

/** A definition of the module that holds a string. */
const greeting = 'hello'

/** A string after the greeting, or the greeting for any other value. @type {(v: unknown) => unknown} */
export const greet = v => kind(v) === STRING ? concat(concat(greeting, ', '), v) : 'hello'

/** The empty string. @type {() => string} */
export const empty = () => ''

/** The UTF-16 units of a word with an accent and of an emoji, which is a pair of surrogates. @type {() => number} */
export const units = () => length('café') + length('\u{1F600}')

/** A unit of the emoji. @type {(i: number) => number} */
export const surrogate = i => unit('\u{1F600}', i)

/** A greeting of a value that is a string, the same literal as `greet`'s. @type {(s: unknown) => string} */
export const hello = s => concat('hello', s)
