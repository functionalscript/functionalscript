/** @import { EdagValue, Array as ValueArray } from '../types.ts' */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { entriesText, objectEntries, ownEntries } from './module.f.mjs'

/** @type {(receiver: EdagValue, expected: EdagValue) => void} */
const eq = (receiver, expected) => { assertStructurallySame(ownEntries(receiver), ['ok', expected]) }

export const proof = {
    // The function as a value, its tag, and its text: the function over
    // the built-in, with no name.
    value: () => {
        assertStructurallySame(objectEntries, ['Object.entries'])
        assertEq(entriesText, 'a => Object.entries(a)')
    },
    // An object's fields in the order it holds them, which construction
    // makes JavaScript's own-key order, an `undefined` one listed.
    object: () => {
        eq(['{}', []], ['[]', []])
        eq(['{}', [[':', '1', 2], [':', 'b', ['undefined']], [':', 'a', 3]]],
            ['[]', [['[]', ['1', 2]], ['[]', ['b', ['undefined']]], ['[]', ['a', 3]]]])
    },
    // An array's elements and a string's code units, under their index
    // strings; a surrogate pair is two entries.
    indexed: () => {
        eq(['[]', [7, ['[]', []]]], ['[]', [['[]', ['0', 7]], ['[]', ['1', ['[]', []]]]]])
        eq('', ['[]', []])
        eq('a\u{1f600}', ['[]', [['[]', ['0', 'a']], ['[]', ['1', '\ud83d']], ['[]', ['2', '\ude00']]]])
    },
    // Nothing for a value that owns no enumerable property: a number, a
    // boolean, a `bigint` and every function.
    empty: () => {
        for (const receiver of [0, NaN, true, false, 1n]) { eq(receiver, ['[]', []]) }
        for (const receiver of /** @type {const} */ ([['=>', 0, [], 1], ['entry'], ['Object.entries']])) { eq(receiver, ['[]', []]) }
    },
    // Each call answers fresh arrays: the result and every pair.
    fresh: () => {
        const object = /** @type {const} */ (['{}', [[':', 'a', 1]]])
        const first = /** @type {ValueArray} */ (assertOk(ownEntries(object)))
        const second = /** @type {ValueArray} */ (assertOk(ownEntries(object)))
        assertEq(first === second, false)
        assertEq(first[1][0] === second[1][0], false)
    },
    // A nullish receiver fails, as `ToObject` does.
    nullish: () => {
        assertStructurallySame(ownEntries(null), ['error', ['undefined']])
        assertStructurallySame(ownEntries(['undefined']), ['error', ['undefined']])
    },
}
