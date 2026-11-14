/**
 * Persistent maps with SameValueZero keys and first-insertion order.
 * Reference keys use RefMap; primitive keys use the existing string-keyed
 * ordered map. Both indexes name slots in an insertion-ordered B-tree.
 * Undefined values are stored inside slots, independently of absence.
 *
 * @module
 * @import { Sign } from '../function/compare/types.ts'
 * @import { MapEntry, PersistentMap } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { findValue } from '../btree/find/module.f.js'
import { remove as removeSlot } from '../btree/remove/module.f.js'
import { set as setSlot } from '../btree/set/module.f.js'
import { values as slots } from '../btree/module.f.js'
import { cmp } from '../function/compare/module.f.js'
import { toArray } from '../list/alt/module.f.js'
import { at, empty as noPrimitives, remove, setReplace } from '../ordered_map/module.f.js'
import { empty as noReferences } from '../ref_map/module.f.js'

/** The map with no entries. @type {PersistentMap<never, never>} */
export const empty = { references: noReferences, primitives: noPrimitives, ordered: null, count: 0, next: 0n }

/**
 * Primitive types occupy separate namespaces. String conversion merges the
 * two zeros and all NaNs, exactly as SameValueZero does.
 * @type {(key: unknown) => string}
 */
const primitiveKey = key => `${key === null ? 'null' : typeof key}:${String(key)}`

/** @type {(id: bigint) => (slot: readonly [bigint, unknown, unknown]) => Sign} */
const compareId = id => ([other]) => cmp(id)(other)

/**
 * A slot of this map, or null for an absent key. Only this module writes the
 * reference index, whose non-null values are insertion ids.
 * @template K, V
 * @param {PersistentMap<K, V>} map
 * @param {K} key
 * @returns {readonly [bigint, K, V] | null}
 */
const slotOf = (map, key) => {
    const id = key !== null && (typeof key === 'object' || typeof key === 'function')
        ? map.references(key)[0] : at(primitiveKey(key))(map.primitives)
    if (id === undefined || id === null) { return null }
    assert(typeof id === 'bigint')
    /** @type {(slot: readonly [bigint, K, V]) => Sign} */
    const compare = compareId(id)
    return assertNotNullish(findValue(compare)(map.ordered))
}

/** @type {<K, V>(map: PersistentMap<K, V>, key: K) => V | undefined} */
export const mapGet = (map, key) => {
    const slot = slotOf(map, key)
    return slot === null ? undefined : slot[2]
}

/** Whether the key is present, including where its value is undefined. @type {<K, V>(map: PersistentMap<K, V>, key: K) => boolean} */
export const mapHas = (map, key) => slotOf(map, key) !== null

/**
 * A map stores either zero as positive zero. This preserves K: TypeScript
 * gives -0 and +0 the same literal type, but cannot prove that for generic K.
 * @template K
 * @param {K} key
 * @returns {K}
 */
const canonicalKey = key => key === 0 ? /** @type {K} */ (0) : key

/**
 * Replace a value without moving its key; a new key is appended.
 * @template K, V
 * @param {PersistentMap<K, V>} map
 * @param {K} key
 * @param {V} value
 * @returns {PersistentMap<K, V>}
 */
export const mapSet = (map, key, value) => {
    const old = slotOf(map, key)
    const id = old === null ? map.next : old[0]
    /** @type {(slot: readonly [bigint, K, V]) => Sign} */
    const compare = compareId(id)
    /** @type {readonly [bigint, K, V]} */
    const slot = [id, old === null ? canonicalKey(key) : old[1], value]
    /** @type {PersistentMap<K, V>} */
    const next = {
        ...map,
        ordered: setSlot(compare)(() => slot)(map.ordered),
        count: map.count + (old === null ? 1 : 0),
        next: old === null ? map.next + 1n : map.next,
    }
    return key !== null && (typeof key === 'object' || typeof key === 'function')
        ? { ...next, references: map.references(key, id)[1] }
        : { ...next, primitives: setReplace(primitiveKey(key))(id)(map.primitives) }
}

/**
 * Remove a key; reinserting it later appends it to the order.
 * @template K, V
 * @param {PersistentMap<K, V>} map
 * @param {K} key
 * @returns {PersistentMap<K, V>}
 */
export const mapDelete = (map, key) => {
    const old = slotOf(map, key)
    if (old === null) { return map }
    /** @type {(slot: readonly [bigint, K, V]) => Sign} */
    const compare = compareId(old[0])
    /** @type {PersistentMap<K, V>} */
    const next = { ...map, ordered: removeSlot(compare)(map.ordered), count: map.count - 1 }
    return key !== null && (typeof key === 'object' || typeof key === 'function')
        ? { ...next, references: map.references(key, null)[1] }
        : { ...next, primitives: remove(primitiveKey(key))(map.primitives) }
}

/** The entries, in first-insertion order. @type {<K, V>(map: PersistentMap<K, V>) => readonly MapEntry<K, V>[]} */
export const mapEntries = map => toArray(slots(map.ordered)).map(([, key, value]) => [key, value])

/** How many keys the map holds. @type {<K, V>(map: PersistentMap<K, V>) => number} */
export const size = map => map.count
