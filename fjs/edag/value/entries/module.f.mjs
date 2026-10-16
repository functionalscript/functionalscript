/**
 * `Object.entries` over evaluated EDAG values: the static function as a
 * value, its text, and its call. No body in the runtime can define it —
 * enumerating keys is exactly what the language has no other way to do —
 * so every executor answers it natively, the represented ones from here
 * ([`spec/todo/2360-built-in.md`](../../../../spec/todo/2360-built-in.md#objectentries-proposal-and-approval)).
 *
 * @module
 * @import { EdagValue, NativeStatic } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'

const { entries } = Object

/**
 * `Object.entries` as a value: one array, so every read is one function,
 * `Object.entries === Object.entries`, as JavaScript has it — where the
 * `entry` helper, a written arrow, is fresh wherever it stands.
 */
export const objectEntries = /** @type {NativeStatic} */ (['Object.entries'])

/**
 * `String(Object.entries)`, since no EDAG holds a body to render: the
 * function as FunctionalScript writes it over the built-in, its one
 * parameter its `length`, and no name, which the language keeps
 * unobservable
 * ([spec: function source](../../../../spec/principles/README.md#function-source-representation-exception)).
 * NaNVM answers this constant too, printed into its `gen.native.rs` by
 * `fjs/nanvm/native`. JavaScript run directly answers its host's own text,
 * as it does for every function under that exception.
 */
export const entriesText = 'a => Object.entries(a)'

/** Each `[key, value]` pair as a fresh array, in a fresh array. @type {(pairs: readonly (readonly [string, EdagValue])[]) => EdagValue} */
const pairsOf = pairs => ['[]', pairs.map(([key, value]) => ['[]', [key, value]])]

/**
 * A call of `Object.entries` on `receiver`: a fresh array of fresh
 * `[key, value]` pairs, one per enumerable own string-keyed property, in
 * JavaScript's own-key order, which a represented object holds its fields
 * in already — an object's fields, an array's elements and a string's
 * UTF-16 code units under their index strings, and nothing for a number,
 * a boolean, a `bigint` or a function. An entry holding `undefined` is
 * listed. A nullish receiver fails, as `ToObject` fails on one.
 *
 * @type {(receiver: EdagValue) => ValueResult}
 */
export const ownEntries = receiver => {
    if (receiver === null) { return error(['undefined']) }
    if (typeof receiver === 'string') { return ok(pairsOf(entries(receiver))) }
    if (!isArray(receiver)) { return ok(['[]', []]) }
    switch (receiver[0]) {
        case 'undefined': { return error(['undefined']) }
        case '[]': { return ok(pairsOf(entries(receiver[1]))) }
        case '{}': { return ok(pairsOf(receiver[1].map(([, key, value]) => [key, value]))) }
        default: { return ok(['[]', []]) }
    }
}
