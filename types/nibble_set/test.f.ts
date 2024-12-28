import { every, map, countdown } from '../list/module.f.ts'
import { empty, has, set, setRange, unset, universe, complement } from './module.f.ts'

export default {
    has: () => {
        if (has(0)(empty)) { throw empty }
        if (has(1)(empty)) { throw empty }
        if (has(15)(empty)) { throw empty }
    },
    set: [
        () => {
            const s = set(0)(empty)
            if(s !== 1) { throw s }
            if(!has(0)(s)) { throw s }
            if (has(1)(s)) { throw s }
            if (has(15)(s)) { throw s }
        },
        () => {
            const s = set(15)(empty)
            if (s !== 0x8000) { throw s }
            if (has(0)(s)) { throw s }
            if (has(1)(s)) { throw s }
            if (!has(15)(s)) { throw s }
        }
    ],
    unset: () => [
        () => {
            const a = set(0)(empty)
            const result = unset(0)(a)
            if (result !== 0) { throw result }
        },
        () => {
            const a = set(15)(empty)
            const result = unset(15)(a)
            if (result !== 0) { throw result }
        }
    ],
    setRange: () => {
        const result = setRange([2, 5])(empty)
        if (result !== 60) { throw result }
    },
    universe: () => {
        const x = every(map((v: number) => has(v)(universe))(countdown(16)))
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
    }
}
