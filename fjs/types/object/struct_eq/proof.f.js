import { assert } from '../../../asserts/module.f.js'
import { structEqBody, structEqSource } from './source.f.js'
import { structEq } from './module.f.js'

/** @type {(value: unknown) => unknown} */
const deep = value => {
    for (let i = 0; i < 10_000; i += 1) {
        value = [{ next: value }]
    }
    return value
}

/** @param {number} x */
const make = x => () => x

export const proof = /** @type {const} */ ({
    source: () => {
        assert(structEqSource === `const structEq = ${structEqBody(false)}`)
        const core = structEqBody(true)
        assert(core.includes('sameValue(x, y)'))
        assert(core.includes('entries(x)'))
        assert(core.includes('entries(y)'))
    },
    depth: () => {
        const left = deep(0)
        assert(structEq(left, deep(0)))
        assert(!structEq(left, deep(-0)))
    },
    resumeSiblings: () => {
        const left = /** @type {const} */ ([{ a: [1, 2], b: 3 }, 4])
        assert(structEq(left, [{ a: [1, 2], b: 3 }, 4]))
        assert(!structEq(left, [{ a: [1, 2], b: 0 }, 4]))
        assert(!structEq(left, [{ a: [1, 2], b: 3 }, 0]))
        assert(structEq([], []))
        assert(structEq({}, {}))
    },
    ordered: () => {
        const child = /** @type {const} */ ({ x: NaN })
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
        const f = make(1)
        assert(structEq([f], [f]))
        assert(!structEq([f], [make(2)]))
    },
})
