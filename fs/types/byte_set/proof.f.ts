import { has, empty, set, setRange, unset, universe, complement, toRangeMap } from './module.f.ts'
import { every, countdown, map, toArray } from '../list/module.f.ts'
import { stringify as jsonStringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

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
            assert(s === 1n, s)
            assert(has(0)(s), s)
            assert(!(has(1)(s)), s)
            assert(!(has(33)(s)), s)
        },
        () => {
            const s = set(33)(empty)
            assert(s === 8589934592n, s)
            assert(!(has(0)(s)), s)
            assert(!(has(1)(s)), s)
            assert(has(33)(s), s)
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        assert(result === 60n, result)
    },
    unset: [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            assert(result === 0n, result)
        },
        () => {
            const a = set(255)(empty)
            const result = unset(255)(a)
            assert(result === 0n, result)
        }
    ],
    universe: () => {
        const x = every(map((v: any) => has(v)(universe))(countdown(256)))
        assert(x, x)
    },
    compliment: {
        empty: () => {
            const r = complement(empty)
            assert(r === universe, r)
        },
        universe: () => {
            const r = complement(universe)
            assert(r === empty, r)
        },
    },
    toRangeMap: [
        () => {
            const result = stringify(toArray(toRangeMap(empty)('a')))
            assert(result === '[]', result)
        },
        () => {
            const s = set(0)(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            assert(result === '[[["a"],0]]', result)
        },
        () => {
            const s = setRange([1, 2])(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            assert(result === '[[[],0],[["a"],2]]', result)
        },
        () => {
            const result = stringify(toArray(toRangeMap(universe)('a')))
            assert(result === '[[["a"],255]]', result)
        },
    ]
}
