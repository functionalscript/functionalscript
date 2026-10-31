/**
 * A list as a host iterable, and `toArray` through one. Both need the host's
 * iteration protocol, which the FunctionalScript VM does not have yet;
 * [`../alt`](../alt/module.f.js) is `toArray` without it.
 *
 * @module
 *
 * @import { List } from '../types.ts'
 */

import { next, trampoline } from '../module.f.js'

/** @type {<T>(list: List<T>) => Iterable<T>} */
export const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const r = next(i)
            if (r === null) { return }
            yield r.first
            i = r.tail
        }
    }
})

const { from } = Array

/** @type {<T>(list: List<T>) => readonly T[]} */
export const toArray = list => {
    const u = trampoline(list)
    return u instanceof Array ? u : from(iterable(u))
}
