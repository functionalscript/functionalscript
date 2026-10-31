/**
 * `toArray` without a host iterator: one pass over the list, with the array
 * spread `[...a, ...b]` as the only way an array is built.
 *
 * Appending each item to one growing array would copy that array once per
 * item, `n²` copies for `n` items, and the DataJS parser materialises
 * thousands of items at a time. The pass instead collects **chunks** — an
 * array the list holds is one, a cons cell's item is one of length one — on
 * a stack whose arrays shorten towards the top, and a new chunk absorbs the
 * top for as long as the top is no longer than it. Each absorption lands the
 * top's items in an array at least twice as long, so a cons list's items,
 * all chunks of one, are copied at most `log2(n)` times, and joining the
 * stack at the end copies each item once more. Without a primitive that
 * fills an array of a given length, this is as good as it gets: concatenation
 * alone cannot build an array from `n` items of one in fewer than
 * `n·log2(n)` copies.
 *
 * @module
 *
 * @import { List } from '../types.ts'
 * @import { _Chunks } from './private.ts'
 */

import { concat, trampoline } from '../module.f.js'

/** @type {<T>(chunks: _Chunks<T>, chunk: readonly T[]) => _Chunks<T>} */
const push = (chunks, chunk) => {
    while (chunks !== null && chunks.first.length <= chunk.length) {
        [chunks, chunk] = [chunks.tail, [...chunks.first, ...chunk]]
    }
    return { first: chunk, tail: chunks }
}

/** @type {<T>(chunks: _Chunks<T>) => readonly T[]} */
const join = chunks => {
    if (chunks === null) { return [] }
    let [result, rest] = [chunks.first, chunks.tail]
    while (rest !== null) {
        [result, rest] = [[...rest.first, ...result], rest.tail]
    }
    return result
}

/**
 * The items of `list` as one array. An array passed in comes back itself,
 * and so does one a thunk returns.
 *
 * @type {<T>(list: List<T>) => readonly T[]}
 */
export const toArray = list => {
    /** @typedef {typeof list extends List<infer T> ? T : never} T */
    /** @type {_Chunks<T>} */
    let chunks = null
    /** @type {List<T>} */
    let tail = null
    while (true) {
        list = trampoline(list)
        if (list === null) {
            if (tail === null) { return join(chunks) }
            [list, tail] = [tail, null]
        } else if (list instanceof Array) {
            [chunks, list] = [push(chunks, list), null]
        } else if ('head' in list) {
            [list, tail] = [list.head, concat(list.tail)(tail)]
        } else {
            [chunks, list] = [push(chunks, [list.first]), list.tail]
        }
    }
}
