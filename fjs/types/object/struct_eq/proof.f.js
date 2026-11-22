import { assert } from '../../../asserts/module.f.js'
import { structEq } from './module.f.js'

export const proof = {
    ordered: () => {
        const child = { x: NaN }
        assert(structEq([child, child], [{ x: NaN }, { x: NaN }]))
        assert(structEq({ b: 1, '2': 0 }, { '2': 0, b: 1 }))
        assert(!structEq({ a: 0, b: 1 }, { b: 1, a: 0 }))
        assert(!structEq({ a: undefined }, {}))
        assert(!structEq({ a: 0 }, { a: -0 }))
        assert(!structEq([], [undefined]))
        assert(!structEq([], {}))
        assert(!structEq({}, []))
        assert(!structEq({}, null))
        assert(!structEq(null, {}))
        assert(!structEq({}, 0))
        const make = /** @param {number} x */ x => () => x
        const f = make(1)
        assert(structEq([f], [f]))
        assert(!structEq([f], [make(2)]))
    },
}
