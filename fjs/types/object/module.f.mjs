/**
 * Plain-object helpers: safe property lookup via `at`, structural comparison
 * via `structurallySame`, and conversions between entries and `OrderedMap`.
 * See `./types.ts` for the
 * `OptionalMap`/`RequiredMap`/`StringMap`/`Entry`/`OneKey`/`SingleProperty`/
 * `NotUnion` type-level API.
 *
 * @module
 */

import { isArray } from '../array/module.f.mjs'
import { iterable } from '../list/module.f.mjs'
/** @import { List } from '../list/types.ts' */
import { fromUndefined } from '../nullable/module.f.mjs'
/** @import { Nullable } from '../nullable/types.ts' */
import { entries as mapEntries, fromEntries as mapFromEntries } from '../ordered_map/module.f.mjs'
/** @import { OrderedMap } from '../ordered_map/types.ts' */
/** @import { StringMap, Entry } from './types.ts' */

/**
 * `structurallySame` is implemented in a dependency-free leaf so `fjs/asserts`
 * can use it without the cycle `asserts -> object -> nullable -> asserts`; see
 * `./structurally_same/README.md`. This module is its public home.
 */
export { structurallySame } from './structurally_same/module.f.mjs'

const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

/** @type {(name: string) => <T>(object: StringMap<T>) => Nullable<Exclude<T, undefined>>} */
export const at = name => object => {
    const d = getOwnPropertyDescriptor(object, name)
    return d === undefined ? null : fromUndefined(d.value)
}

/** @type {<T>(e: List<Entry<T>>) => List<Entry<T>>} */
export const sort = e => mapEntries(mapFromEntries(e))

/** @type {<T>(e: List<Entry<T>>) => StringMap<T>} */
export const fromEntries = e => objectFromEntries(iterable(e))

/** @type {<T>(m: OrderedMap<T>) => StringMap<T>} */
export const fromMap = m => fromEntries(mapEntries(m))

/**
 * @param {unknown} value
 * @returns {value is { readonly [k in string]: unknown }}
 */
export const isObject =
    value =>
    typeof value === 'object' && !isArray(value) && value !== null

const { values, entries } = Object

/**
 * Returns only the defined (non-undefined) values of a partial record.
 *
 * @type {<T>(map: StringMap<Exclude<T, undefined>>) => readonly Exclude<T, undefined>[]}
 */
export const definedValues =
    map =>
    values(map).filter(v => v !== undefined)

/** @type {<T>(cmd: StringMap<Exclude<T, undefined>>) => readonly (readonly [string, Exclude<T, undefined>])[]} */
export const definedEntries =
    cmd =>
    entries(cmd).flatMap(([a, b]) => b === undefined ? [] : [[a, b]])
