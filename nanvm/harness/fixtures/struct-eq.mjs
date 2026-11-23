import { structEq as eq } from '../../../fjs/types/object/struct_eq/module.f.js'

const shared = { x: NaN }
/** @param {number} x */
const make = x => () => x

export default [
    eq.length,
    eq(undefined, undefined),
    eq([shared, shared], [{ x: NaN }, { x: NaN }]),
    eq({ a: 0, b: 1 }, { b: 1, a: 0 }),
    eq({ b: 1, '2': 0 }, { '2': 0, b: 1 }),
    eq({}, { a: undefined }),
    eq([0], [-0]),
    eq([], {}),
    eq([make(1)], [make(2)]),
]
