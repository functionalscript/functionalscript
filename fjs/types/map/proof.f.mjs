/** @import { PersistentMap } from './types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { empty, mapDelete, mapEntries, mapGet, mapHas, mapSet, size } from './module.f.js'

export const proof = /** @type {const} */ ({
    empty: () => {
        assertEq(size(empty), 0)
        assertStructurallySame(mapEntries(empty), [])
        assertEq(mapGet(empty, 'missing'), undefined)
        assert(!mapHas(empty, {}))
        assert(mapDelete(empty, null) === empty)
    },
    valuesAndPersistence: () => {
        const one = mapSet(empty, 'a', 'b')
        const two = mapSet(one, 'a', 'c')
        assertEq(mapGet(one, 'a'), 'b')
        assertEq(mapGet(two, 'a'), 'c')
        assertEq(size(one), 1)
        assertEq(size(two), 1)
        const withUndefined = mapSet(two, 'a', undefined)
        assert(mapHas(withUndefined, 'a'))
        assertEq(mapGet(withUndefined, 'a'), undefined)
        assertStructurallySame(mapEntries(withUndefined), [['a', undefined]])
        assertEq(size(mapDelete(withUndefined, 'a')), 0)
        assertEq(mapGet(two, 'a'), 'c')
    },
    primitiveNamespaces: () => {
        const keys = /** @type {const} */ ([undefined, null, false, true, 0, 1, 1n, '1', '', 'null', 'undefined', NaN, Infinity, -Infinity])
        /** @type {PersistentMap<unknown, number>} */
        let map = empty
        for (const [i, key] of keys.entries()) { map = mapSet(map, key, i) }
        assertEq(size(map), keys.length)
        for (const [i, key] of keys.entries()) { assertEq(mapGet(map, key), i); assert(mapHas(map, key)) }
        assertStructurallySame(mapEntries(map).map(([key]) => key), keys)
        const overwritten = mapSet(mapSet(map, -0, 20), NaN, 30)
        assertEq(size(overwritten), keys.length)
        assertEq(mapGet(overwritten, 0), 20)
        assertEq(mapGet(overwritten, NaN), 30)
        assertEq(mapGet(map, 0), 4)
        assert(!mapHas(mapDelete(overwritten, NaN), NaN))
    },
    referenceKeysAndValues: () => {
        const a = /** @type {const} */ ({ index: 1 })
        const alike = /** @type {const} */ ({ index: 1 })
        const array = /** @type {const} */ ([])
        const fn = () => 1
        const keys = /** @type {const} */ ([a, alike, array, fn])
        /** @type {PersistentMap<object, unknown>} */
        let map = empty
        for (const key of keys) { map = mapSet(map, key, key) }
        assertEq(size(map), 4)
        for (const key of keys) { assert(mapGet(map, key) === key) }
        assertEq(mapGet(map, { index: 1 }), undefined)
        const updated = mapSet(map, a, undefined)
        assert(mapHas(updated, a))
        assertEq(mapGet(updated, a), undefined)
        assert(mapGet(map, a) === a)
        const removed = mapDelete(updated, a)
        assert(!mapHas(removed, a))
        assertEq(mapGet(removed, a), undefined)
        assert(mapDelete(removed, a) === removed)
        assertEq(size(removed), 3)
        assertEq(mapGet(map, a), a)
        assertStructurallySame(mapEntries(mapSet(removed, a, fn)).map(([key]) => key), [alike, array, fn, a])
    },
    insertionOrder: () => {
        const first = mapSet(mapSet(mapSet(empty, 'a', 1), 'b', 2), 'c', 3)
        const replaced = mapSet(first, 'b', 20)
        assertStructurallySame(mapEntries(replaced), [['a', 1], ['b', 20], ['c', 3]])
        const removed = mapDelete(replaced, 'b')
        assertStructurallySame(mapEntries(removed), [['a', 1], ['c', 3]])
        assertStructurallySame(mapEntries(mapSet(removed, 'b', 30)), [['a', 1], ['c', 3], ['b', 30]])
        assertStructurallySame(mapEntries(first), [['a', 1], ['b', 2], ['c', 3]])
    },
    signedZero: () => {
        const map = mapSet(empty, -0, 'zero')
        const [[key]] = mapEntries(map)
        assert(Object.is(key, 0))
        assertEq(mapGet(map, 0), 'zero')
        assertEq(size(mapSet(map, 0, 'again')), 1)
        assert(Object.is(mapEntries(mapSet(map, -0, 'again'))[0][0], 0))
        assertEq(size(mapDelete(map, 0)), 0)
    },
    manyEntriesAndBranches: () => {
        /** @type {PersistentMap<number, number>} */
        let map = empty
        for (let i = 0; i < 200; i += 1) { map = mapSet(map, i, i * 2) }
        const original = map
        for (let i = 0; i < 200; i += 2) { map = mapDelete(map, i) }
        assertEq(size(map), 100)
        assertEq(size(original), 200)
        assertStructurallySame(mapEntries(map).map(([key]) => key), mapEntries(original).map(([key]) => key).filter(key => key % 2 !== 0))
        for (let i = 0; i < 200; i += 1) { assertEq(mapGet(map, i), i % 2 === 0 ? undefined : i * 2) }
    },
})
