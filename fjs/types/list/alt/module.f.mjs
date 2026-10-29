/**
 * @module
 *
 * @import { List } from '../types.ts'
 */

import { concat, trampoline } from '../module.f.mjs'

/**
 * @type {<T>(list: List<T>) => readonly T[]}
 */
export const toArray = list => {
    /** @typedef {typeof list extends List<infer T> ? T : never} T */
    /** @type {List<T>} */
    let tail = null
    /** @type {readonly T[]} */
    let result = []
    while (true) {
        list = trampoline(list)

        if (list === null) {
            if (tail === null) {
                break
            }
            [list, tail] = [tail, null]
            continue
        }

        if (list instanceof Array) {
            result = [...result, ...list];
            [list, tail] = [tail, null]
            continue
        }

        if ('head' in list) {
            tail = concat(list.tail)(tail)
            list = list.head
            continue
        }

        result = [...result, list.first];
        list = list.tail
    }
    return result
}
