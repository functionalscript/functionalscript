// @ts-self-types="./module.f.d.mts"
import * as list from '../list/module.f.mjs'
const { iterable } = list
import * as btMap from '../map/module.f.mjs'
const { entries: mapEntries, fromEntries: mapFromEntries } = btMap
const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

/**
 * @template T
 * @typedef {{
 *  readonly [k in string]: T
 * }} Map
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/** @type {(name: string) => <T>(object: Map<T>) => T|null} */
export const at = name => object => {
    const r = getOwnPropertyDescriptor(object, name)
    return r === void 0 ? null : r.value
}

/** @type {<T>(e: list.List<Entry<T>>) => list.List<Entry<T>>} */
export const sort = e => mapEntries(mapFromEntries(e))

/** @type {<T>(e: list.List<Entry<T>>) => Map<T>} */
export const fromEntries = e => objectFromEntries(iterable(e))

/** @type {<T>(m: btMap.Map<T>) => Map<T>} */
export const fromMap = m => fromEntries(mapEntries(m))
