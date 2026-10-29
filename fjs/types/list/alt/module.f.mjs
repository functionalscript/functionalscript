/**
 * @module
 *
 * @import { List } from '../types.ts'
 */

import { concat, trampoline } from '../module.f.mjs'

/** @type {<T>(a: readonly T[], b: readonly T[]) => readonly T[]} */
const arrayConcat = (a, b) => a.length === 0 ? b : b.length === 0 ? a : [...a, ...b]

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
            result = arrayConcat(result, list);
            [list, tail] = [tail, null]
            continue
        }

        if ('head' in list) {
            tail = concat(list.tail)(tail)
            list = list.head
            continue
        }

        result = arrayConcat(result, [list.first])
        list = list.tail
    }
    return result
}
