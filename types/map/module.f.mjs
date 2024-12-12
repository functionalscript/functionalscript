// @ts-self-types="./module.f.d.mts"
import * as BtreeTypes from '../btree/types/module.f.mjs'
import * as btf from '../btree/find/module.f.mjs'
const { value, find } = btf
import * as bts from '../btree/set/module.f.mjs'
const { set } = bts
import * as btr from '../btree/remove/module.f.mjs'
const { remove: btreeRemove } = btr
import * as bt from '../btree/module.f.mjs'
const { values } = bt
import * as Compare from '../function/compare/module.f.mjs'
import s from '../string/module.f.mjs'
const { cmp } = s
import * as list from '../list/module.f.mjs'
const { fold } = list
import * as Operator from '../function/operator/module.f.mjs'

/** @typedef {Compare.Sign} Sign */

/**
 * @template T
 * @typedef {Compare.Compare<T>} Cmp
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/**
 * @template T
 * @typedef {BtreeTypes.Tree<Entry<T>>} Map
 */

/** @type {(a: string) => <T>(b: Entry<T>) => Sign} */
const keyCmp = a => ([b]) => cmp(a)(b)

/** @type {(name: string) => <T>(map: Map<T>) => T|null} */
export const at = name => map => {
    if (map === null) { return null }
    const result = value(find(keyCmp(name))(map).first)
    return result === null ? null : result[1]
}

/** @type {<T>(reduce: Operator.Reduce<T>) => (entry: Entry<T>) => (map: Map<T>) => Map<T>} */
const setReduceEntry = reduce => entry =>
    set(keyCmp(entry[0]))(old => old === null ? entry : [old[0], reduce(old[1])(entry[1])])

/** @type {<T>(reduce: Operator.Reduce<T>) => (name: string) => (value: T) => (map: Map<T>) => Map<T>} */
export const setReduce = reduce => name => value => setReduceEntry(reduce)([name, value])

/** @type {<T>(a: T) => (b: T) => T} */
const replace = () => b => b

/** @type {(name: string) => <T>(value: T) => (map: Map<T>) => Map<T>} */
export const setReplace = name => value => setReduceEntry(replace)([name, value])

/** @type {<T>(map: Map<T>) => list.List<Entry<T>>} */
export const entries = values

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
export const fromEntries = fold(setReduceEntry(replace))(null)

/** @type {(name: string) => <T>(map: Map<T>) => Map<T>} */
export const remove = name => btreeRemove(keyCmp(name))

export const empty = null
