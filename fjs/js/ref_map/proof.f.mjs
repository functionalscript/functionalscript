/**
 * @import { RefMap, RefMapKey } from '../../types/ref_map/types.ts'
 */

import { refMap } from './module.f.js'
import { empty } from '../../types/ref_map/module.f.js'
import { assert, assertEq } from '../../asserts/module.f.js'

/** A step of a fixed pseudo-random sequence, each below `2 ** 31`. @type {(seed: number) => number} */
const step = seed => (Math.imul(seed, 0x41c6_4e6d) + 0x3039) & 0x7fff_ffff

/** A primitive where a key is expected. @type {(value: unknown) => RefMapKey} */
const asKey = value => /** @type {RefMapKey} */ (value)

export const proof = {
    // A read answers the key's value and the same map, the empty one
    // included; a set answers the value the key had and a new map.
    readAndSet: () => {
        const start = refMap()
        const key = /** @type {const} */ ({})
        assert(start(key)[1] === start)
        assert(start(key, undefined)[1] === start)
        const [previous, one] = start(key, 1)
        assertEq(previous, undefined)
        assertEq(one(key)[0], 1)
        assert(one(key)[1] === one)
        assertEq(start(key)[0], undefined)
        assertEq(one(key, 2)[0], 1)
        assertEq(one.length, 2)
        // each call of `refMap` is a map of its own
        assert(refMap() !== refMap())
    },
    // A primitive is never a key: reading one answers `undefined`.
    primitiveRead: () => {
        const [, m] = refMap()({}, 1)
        for (const key of [null, true, 1, 'k', 1n]) { assertEq(m(asKey(key))[0], undefined) }
    },
    // The same answers as the map the language recognizes, over a fixed
    // pseudo-random run on older and newer versions alike.
    againstTheMap: () => {
        const keys = Array.from({ length: 40 }, (_, i) => i % 2 === 0 ? { i } : () => i)
        /** @type {readonly (readonly [RefMap, RefMap])[]} */
        let versions = [[refMap(), empty]]
        let seed = 1
        for (let round = 0; round < 4_000; round = round + 1) {
            seed = step(seed)
            const [mine, theirs] = versions[seed % versions.length]
            seed = step(seed)
            const key = keys[seed % keys.length]
            seed = step(seed)
            const value = seed % 3 === 0 ? round : undefined
            const [a, next] = mine(key, value)
            const [b, expected] = theirs(key, value)
            assertEq(a, b)
            assertEq(next === mine, expected === theirs)
            if (value !== undefined) {
                /** @type {readonly [RefMap, RefMap]} */
                const version = [next, expected]
                versions = versions.length < 30 ? [...versions, version] : versions.with(1 + seed % 29, version)
            }
        }
    },
    throw: {
        // setting a primitive key fails, whatever its type
        nullKey: () => { refMap()(asKey(null), 1) },
        numberKey: () => { refMap()(asKey(1), 1) },
    },
}
