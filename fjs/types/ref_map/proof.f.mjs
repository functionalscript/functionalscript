/**
 * @import { RefMap, RefMapKey } from './types.ts'
 */

import { empty } from './module.f.js'
import { assert, assertEq } from '../../asserts/module.f.js'

/**
 * The contract in its shortest form: a list of `[key, value]` pairs
 * searched with `===`, a later pair for a key replacing an earlier one.
 *
 * @type {(pairs: readonly (readonly [unknown, unknown])[], key: unknown) => unknown}
 */
const scan = (pairs, key) => pairs.findLast(([k]) => k === key)?.[1]

/** A step of a fixed pseudo-random sequence, each below `2 ** 31`. @type {(seed: number) => number} */
const step = seed => (Math.imul(seed, 0x41c6_4e6d) + 0x3039) & 0x7fff_ffff

/** A primitive where a key is expected, for the cases that give the map one. @type {(value: unknown) => RefMapKey} */
const asKey = value => /** @type {RefMapKey} */ (value)

export const proof = {
    // A read answers the key's value and the same map; a set answers the
    // value the key had and a new map, and leaves the old one as it was.
    readAndSet: () => {
        const key = /** @type {const} */ ({})
        const [none, same] = empty(key)
        assertEq(none, undefined)
        assert(same === empty)
        const [previous, one] = empty(key, 1)
        assertEq(previous, undefined)
        assert(one !== empty)
        assertEq(one(key)[0], 1)
        assert(one(key)[1] === one)
        assertEq(empty(key)[0], undefined)
        // a swap: the value the key had, and a map holding the new one
        const [old, two] = one(key, 2)
        assertEq(old, 1)
        assertEq(two(key)[0], 2)
        assertEq(one(key)[0], 1)
    },
    // Keys are references, compared as `===` compares them: an alias is
    // the same key, two objects alike are two, and an array, a function
    // and a map are keys as an object is.
    keys: () => {
        const a = /** @type {const} */ ({ x: 1 })
        const alias = a
        const alike = /** @type {const} */ ({ x: 1 })
        const list = /** @type {const} */ ([1])
        const fn = () => 1
        const [, m1] = empty(a, 'a')
        const [, m2] = m1(alike, 'alike')
        const [, m3] = m2(list, 'list')
        const [, m4] = m3(fn, 'fn')
        const [, m] = m4(empty, 'map')
        assertEq(m(alias)[0], 'a')
        assertEq(m(alike)[0], 'alike')
        assertEq(m(list)[0], 'list')
        assertEq(m([1])[0], undefined)
        assertEq(m(fn)[0], 'fn')
        assertEq(m(() => 1)[0], undefined)
        assertEq(m(empty)[0], 'map')
        assertEq(m(m)[0], undefined)
    },
    // A value of `undefined` is no value: the call is a read, on the empty
    // map and on any other, so a key is never set back to `undefined`.
    undefinedValue: () => {
        const key = /** @type {const} */ ({})
        assert(empty(key, undefined)[1] === empty)
        const [, m] = empty(key, 0)
        const [value, same] = m(key, undefined)
        assertEq(value, 0)
        assert(same === m)
        // every other value is one, the falsy ones too
        for (const v of [null, false, 0, '', 0n]) { assertEq(m(key, v)[1](key)[0], v) }
    },
    // A primitive is never a key: reading one answers `undefined`.
    primitiveRead: () => {
        const [, m] = empty({}, 1)
        for (const key of [null, true, 1, 'k', 1n]) {
            assertEq(empty(asKey(key))[0], undefined)
            assertEq(m(asKey(key))[0], undefined)
        }
    },
    // Each set on the empty map starts a family of its own, and two
    // families hold the same keys apart.
    families: () => {
        const key = /** @type {const} */ ({})
        const [, a] = empty(key, 'a')
        const [, b] = empty(key, 'b')
        assert(a !== b)
        assertEq(a(key)[0], 'a')
        assertEq(b(key)[0], 'b')
        const other = /** @type {const} */ ({})
        assertEq(a(other, 1)[1](key)[0], 'a')
        assertEq(b(other)[0], undefined)
    },
    // Against the contract's shortest form, over a fixed pseudo-random
    // run: reads and sets on any of the versions made so far, older ones
    // included, each set making one more.
    againstScan: () => {
        const keys = Array.from({ length: 40 }, (_, i) => i % 2 === 0 ? { i } : () => i)
        /** @type {readonly (readonly [RefMap, readonly (readonly [unknown, unknown])[]])[]} */
        let versions = [[empty, []]]
        let seed = 1
        for (let round = 0; round < 4_000; round = round + 1) {
            seed = step(seed)
            const [map, pairs] = versions[seed % versions.length]
            seed = step(seed)
            const key = keys[seed % keys.length]
            seed = step(seed)
            if (seed % 3 === 0) {
                const [previous, next] = map(key, round)
                assertEq(previous, scan(pairs, key))
                /** @type {readonly [RefMap, readonly (readonly [unknown, unknown])[]]} */
                const version = [next, [...pairs, [key, round]]]
                versions = versions.length < 30 ? [...versions, version] : versions.with(1 + seed % 29, version)
            } else {
                const [value, same] = map(key)
                assertEq(value, scan(pairs, key))
                assert(same === map)
            }
        }
        // every version still answers as its own pairs do
        for (const [map, pairs] of versions) {
            for (const key of keys) { assertEq(map(key)[0], scan(pairs, key)) }
        }
    },
    throw: {
        // setting a primitive key fails, on the empty map and on any other
        primitiveSetOnEmpty: () => { empty(asKey(1), 1) },
        primitiveSet: () => { empty({}, 1)[1](asKey('k'), 1) },
    },
}
