/**
 * @import { StringMap } from './types.ts'
 */

import { at, definedEntries, definedValues, fromMap, isObject, sort } from './module.f.mjs'
import { empty, setReplace } from '../ordered_map/module.f.js'
import { toArray } from '../list/alt/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

export const proof = {
    sortedEntries: () => {
        assertStructurallySame(toArray(sort([['b', 1], ['a', 2]])), [['a', 2], ['b', 1]])
        assertStructurallySame(toArray(sort([])), [])
    },
    objectGuard: () => {
        assert(isObject({}))
        assert(isObject({ value: 1 }))
        for (const value of [null, [], 1, 'object', undefined]) {
            assert(!isObject(value))
        }
    },
    // an ordered map as an object: its entries in the map's order, sorted
    fromMap: () => {
        const map = setReplace('b')(1)(setReplace('a')(2)(empty))
        const object = fromMap(map)
        assertEq(Object.keys(object).join(), 'a,b')
        assertEq(object.a, 2)
        assertEq(object.b, 1)
    },
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        assertEq(value, null)
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        assertEq(value, 42)
    },
    // a member holding `undefined` is dropped; the others keep their order
    defined: () => {
        /** @type {StringMap<number>} */
        const map = { a: 1, b: undefined, c: 3 }
        assertEq(definedEntries(map).map(([k, v]) => `${k}=${v}`).join(), 'a=1,c=3')
        assertEq(definedValues(map).join(), '1,3')
    },
}
