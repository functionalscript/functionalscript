import { has, empty, set, setRange, unset, universe, complement, toRangeMap } from './module.f.ts'
import { every, countdown, map, toArray } from '../list/module.f.ts'
import { stringify as jsonStringify, type Unknown } from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'

const stringify: (a: readonly Unknown[]) => string
    = jsonStringify(sort)

export default {
    has: [
        () => {
            if (has(0)(empty)) { throw empty }
            if (has(1)(empty)) { throw empty }
            if (has(33)(empty)) { throw empty }
        },
        () => {
            const s = set(0)(empty)
            if (s !== 1n) { throw s }
            if (!has(0)(s)) { throw s }
            if (has(1)(s)) { throw s }
            if (has(33)(s)) { throw s }
        },
        () => {
            const s = set(33)(empty)
            if (s !== 8589934592n) { throw s }
            if (has(0)(s)) { throw s }
            if (has(1)(s)) { throw s }
            if (!has(33)(s)) { throw s }
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        if (result !== 60n) { throw result }
    },
    unset: [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            if (result !== 0n) { throw result }
        },
        () => {
            const a = set(255)(empty)
            const result = unset(255)(a)
            if (result !== 0n) { throw result }
        }
    ],
    universe: () => {
        const x = every(map((v: any) => has(v)(universe))(countdown(256)))
        if (!x) { throw x }
    },
    compliment: {
        empty: () => {
            const r = complement(empty)
            if (r !== universe) { throw r }
        },
        universe: () => {
            const r = complement(universe)
            if (r !== empty) { throw r }
        },
    },
    toRangeMap: [
        () => {
            const result = stringify(toArray(toRangeMap(empty)('a')))
            if (result !== '[]') { throw result }
        },
        () => {
            const s = set(0)(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            if (result !== '[[["a"],0]]') { throw result }
        },
        () => {
            const s = setRange([1, 2])(empty)
            const result = stringify(toArray(toRangeMap(s)('a')))
            if (result !== '[[[],0],[["a"],2]]') { throw result }
        },
        () => {
            const result = stringify(toArray(toRangeMap(universe)('a')))
            if (result !== '[[["a"],255]]') { throw result }
        },
    ]
}
