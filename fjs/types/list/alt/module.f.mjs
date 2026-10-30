/**
 * `toArray` without a host iterator: every item of the list as a one-item
 * array, and those arrays joined by [`monoid.fold`](../../../common/monoid/module.f.mjs)
 * under concatenation.
 *
 * Appending each item to one growing array would copy that array once per
 * item, `n²` copies for `n` items, and the DataJS parser materialises
 * thousands of items at a time. `monoid.fold` instead merges runs like a
 * binary counter, so each item is copied at most `log2(n)` times; that is the
 * fold `bit_vec` concatenates with and `set` keeps its runs on, and the same
 * `concat` that `array.repeat` doubles under. Without a primitive that fills
 * an array of a given length, this is as good as it gets: concatenation alone
 * cannot build an array from `n` items of one in fewer than `n·log2(n)`
 * copies.
 *
 * @module
 *
 * @import { Monoid } from '../../../common/monoid/types.ts'
 * @import { List } from '../types.ts'
 */

import { fold } from '../../../common/monoid/module.f.mjs'
import { concat, empty } from '../../array/module.f.mjs'
import { map, trampoline } from '../module.f.mjs'

/** @type {<T>(item: T) => readonly T[]} */
const singleton = item => [item]

/**
 * The items of `list` as one array. An array passed in comes back itself,
 * and so does one a thunk returns.
 *
 * @type {<T>(list: List<T>) => readonly T[]}
 */
export const toArray = list => {
    /** @typedef {typeof list extends List<infer T> ? T : never} T */
    const u = trampoline(list)
    if (u instanceof Array) { return u }
    /** @type {Monoid<readonly T[]>} */
    const monoid = { identity: empty, operation: concat }
    return fold(monoid)(map(singleton)(u))
}
