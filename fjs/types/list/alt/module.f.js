/**
 * Materialize immutable lists with the shared weighted monoid fold.
 *
 * Existing arrays enter the fold whole; cons items enter as singleton arrays.
 * Array length is the weight, so the common fold controls which chunks merge
 * without splitting a large source array into individual items. The lazy
 * chunk list leaves concatenations to the list driver's stack-safe traversal.
 *
 * @module
 *
 * @import { List, Thunk } from '../types.ts'
 * @import { Monoid } from '../../../common/monoid/types.ts'
 */

import { concat, trampoline } from '../module.f.js'
import { fold } from '../../../common/monoid/module.f.js'

/**
 * Preserve array leaves as individual values of the chunk list, including
 * empty arrays. Child chunks stay behind thunks, so nested concatenations
 * are walked by `next` rather than recursive JavaScript calls.
 *
 * @type {<T>(list: List<T>) => Thunk<readonly T[]>}
 */
const chunks = list => () => {
    const value = trampoline(list)
    if (value === null) { return null }
    if (value instanceof Array) { return [value] }
    return 'head' in value
        ? concat(chunks(value.head))(chunks(value.tail))
        : { first: [value.first], tail: chunks(value.tail) }
}

/**
 * The items of `list` as one array. A sole array chunk comes back itself,
 * including behind thunks or null-only concatenations. No chunks produce a
 * fresh empty array; merging multiple chunks produces a fresh array.
 *
 * @type {<T>(list: List<T>) => readonly T[]}
 */
export const toArray = list => {
    /** @typedef {typeof list extends List<infer T> ? T : never} T */
    /** @type {readonly T[]} */
    const empty = []
    /** @type {Monoid<readonly T[]>} */
    const monoid = {
        identity: empty,
        // collect seeds a lone run with identity; preserve that run's array.
        // Source empty arrays are ordinary chunks, distinct from this seed.
        operation: a => b => a === empty ? b : [...a, ...b],
        weight: chunk => chunk.length,
    }
    return fold(monoid)(chunks(list))
}
