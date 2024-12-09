// @ts-self-types="./module.f.d.mts"
import list, * as List from '../list/module.f.mjs'
const { iterable } = list
import btMap, * as BTMap from '../map/module.f.mjs'
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
const at = name => object => {
    const r = getOwnPropertyDescriptor(object, name)
    return r === void 0 ? null : r.value
}

/** @type {<T>(e: List.List<Entry<T>>) => List.List<Entry<T>>} */
const sort = e => mapEntries(mapFromEntries(e))

/** @type {<T>(e: List.List<Entry<T>>) => Map<T>} */
const fromEntries = e => objectFromEntries(iterable(e))

/** @type {<T>(m: BTMap.Map<T>) => Map<T>} */
const fromMap = m => fromEntries(mapEntries(m))

export default {
    /** @readonly */
    at,
    /** @readonly */
    sort,
    /** @readonly */
    fromEntries,
    /** @readonly */
    fromMap,
}
