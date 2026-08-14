/**
 * Ordered map operations with deterministic key traversal.
 *
 * @module
 *
 * @import { Sign } from '../function/compare/types.ts'
 * @import { List } from '../list/types.ts'
 * @import { Reduce } from '../function/operator/types.ts'
 * @import { Entry, OrderedMap } from './types.ts'
 */

import { value, find } from '../btree/find/module.f.mjs'
import { set } from '../btree/set/module.f.mjs'
import { remove as btreeRemove } from '../btree/remove/module.f.mjs'
import { values } from '../btree/module.f.mjs'
import { cmp } from '../string/module.f.mjs'
import { fold } from '../list/module.f.mjs'

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => cmp(a)(b)

/** @type {(name: string) => <T>(map: OrderedMap<T>) => T | null} */
export const at = name => map => {
    if (map === null) { return null }
    const result = value(find(keyCmp(name))(map).first)
    return result === null ? null : result[1]
}

/** @type {<T>(reduce: Reduce<T>) => (entry: Entry<T>) => (map: OrderedMap<T>) => OrderedMap<T>} */
const setReduceEntry = reduce => entry =>
    set(keyCmp(entry[0]))(old => old === null ? entry : [old[0], reduce(old[1])(entry[1])])

/** @type {<T>(reduce: Reduce<T>) => (name: string) => (value: T) => (map: OrderedMap<T>) => OrderedMap<T>} */
export const setReduce =
    reduce => name => value => setReduceEntry(reduce)([name, value])

/** @type {<T>(a: T) => (b: T) => T} */
const replace = () => b => b

/** @type {(name: string) => <T>(value: T) => (map: OrderedMap<T>) => OrderedMap<T>} */
export const setReplace =
    name => value => setReduceEntry(replace)([name, value])

/** @type {<T>(map: OrderedMap<T>) => List<Entry<T>>} */
export const entries = values

/** @type {<T>(entries: List<Entry<T>>) => OrderedMap<T>} */
export const fromEntries =
    fold(setReduceEntry(replace))(null)

/** @type {(name: string) => <T>(map: OrderedMap<T>) => OrderedMap<T>} */
export const remove =
    name => btreeRemove(keyCmp(name))

export const empty = null
