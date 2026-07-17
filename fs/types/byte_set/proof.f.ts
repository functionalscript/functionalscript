import { has, empty, set, setRange, unset, universe, complement, toRangeMap } from './module.f.ts'
import { every, countdown, map, toArray } from '../list/module.f.ts'
import { stringify as jsonStringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

const stringify: (a: readonly Unknown[]) => string
    = jsonStringify(sort)

export const proof = {
    has: [
        () => {
            assert(!(has(0)(empty)), empty)
            assert(!(has(1)(empty)), empty)
            assert(!(has(33)(empty)), empty)
        },
        () => {
            const s = set(0)(empty)
            assertEq(s, 1n)
            assert(has(0)(s), s)
            assert(!(has(1)(s)), s)
            assert(!(has(33)(s)), s)
        },
        () => {
            const s = set(33)(empty)
            assertEq(s, 8589934592n)
            assert(!(has(0)(s)), s)
            assert(!(has(1)(s)), s)
            assert(has(33)(s), s)
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        assertEq(result, 60n)
    },
    unset: [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            assertEq(result, 0n)
        },
        () => {
            const a = set(255)(empty)
            const result = unset(255)(a)
            assertEq(result, 0n)
        }
    ],
    universe: () => {
        const x = every(map((v: any) => has(v)(universe))(countdown(256)))
        assert(x, x)
    },
    compliment: {
        empty: () => {
            const r = complement(empty)
            assertEq(r, universe)
        },
        universe: () => {
            const r = complement(universe)
            assertEq(r, empty)
        },
    },
    toRangeMap: [
        () => {
            const result = stringify(toArray(toRangeMap(empty)('a')))
            assertEq(result, '[]')
        },
        () => {
            const s = set(0)(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            assertEq(result, '[[["a"],0]]')
        },
        () => {
            const s = setRange([1, 2])(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            assertEq(result, '[[[],0],[["a"],2]]')
        },
        () => {
            const result = stringify(toArray(toRangeMap(universe)('a')))
            assertEq(result, '[[["a"],255]]')
        },
    ]
}
