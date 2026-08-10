import { every, map, countdown } from '../list/module.f.mjs'
import { empty, has, set, setRange, unset, universe, complement } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

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
            assertEq(s, 0x8000)
            assert(!(has(0)(s)), s)
            assert(!(has(1)(s)), s)
            assert(has(15)(s), s)
        }
    ],
    unset: () => [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            assertEq(result, 0)
        },
        () => {
            const a = set(15)(empty)
            const result = unset(15)(a)
            assertEq(result, 0)
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        assertEq(result, 60)
    },
    universe: () => {
        /** @type {(v: number) => boolean} */
        const hasInUniverse = v => has(v)(universe)
        const x = every(map(hasInUniverse)(countdown(16)))
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
    }
}
