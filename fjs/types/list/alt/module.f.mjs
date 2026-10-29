/**
 * @module
 *
 * @import { List } from '../types.ts'
 */


import { todo } from '../../../asserts/module.f.js'
import { hasEntry } from '../../object/entry/module.f.js'
import { fromArrayLike, next, trampoline } from '../module.f.mjs'

/**
 * @type {<T>(list: List<T>) => readonly T[]}
 */
export const toArray = list => {
    /** @typedef {typeof list extends List<infer T> ? T : never} T */
    /** @type {readonly T[]} */
    let result = []
    while (true) {
        list = trampoline(list)
        if (list instanceof Array) {
            // TODO: Replace it with an optimized version of `concat` from `array/module.f.js`.
            //       The `concat` should check if `result` or `list` is en empty array and
            //       return `result` or `list`.
            return [...result, ...list]
        }
        if (list === null) {
            return result
        }
        if (hasEntry(list, 'head')) {
            result = [...result, ...toArray(list.head)]
            list = list.tail
            continue
        }
        result = [...result, list.first]
        list = list.tail
    }
}
