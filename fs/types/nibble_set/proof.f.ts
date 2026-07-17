import { every, map, countdown } from '../list/module.f.ts'
import { empty, has, set, setRange, unset, universe, complement } from './module.f.ts'
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    has: () => {
        assert(!(has(0)(empty)), empty)
        assert(!(has(1)(empty)), empty)
        assert(!(has(15)(empty)), empty)
    },
    set: [
        () => {
            const s = set(0)(empty)
            if(s !== 1) { throw s }
            if(!has(0)(s)) { throw s }
            assert(!(has(1)(s)), s)
            assert(!(has(15)(s)), s)
        },
        () => {
            const s = set(15)(empty)
            assert(s === 0x8000, s)
            assert(!(has(0)(s)), s)
            assert(!(has(1)(s)), s)
            assert(has(15)(s), s)
        }
    ],
    unset: () => [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            assert(result === 0, result)
        },
        () => {
            const a = set(15)(empty)
            const result = unset(15)(a)
            assert(result === 0, result)
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        assert(result === 60, result)
    },
    universe: () => {
        const x = every(map((v: number) => has(v)(universe))(countdown(16)))
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
    }
}
