import { assert } from '../../../asserts/module.f.mjs'
import { structurallySame } from './module.f.mjs'

/** @type {(a: unknown, b: unknown) => void} */
const same = (a, b) => assert(structurallySame(a, b), ['same', a, b])

/** @type {(a: unknown, b: unknown) => void} */
const differ = (a, b) => assert(!structurallySame(a, b), ['differ', a, b])

export const proof = {
    primitives: [
        // `Object.is` decides, so `NaN` is its own equal...
        () => same(Number.NaN, Number.NaN),
        () => same(42, 42),
        () => same('a', 'a'),
        () => same(undefined, undefined),
        () => same(null, null),
        // ...and the two zeros are not.
        () => differ(0, -0),
        () => differ(1, 2),
        () => differ('a', 'b'),
        () => differ(null, undefined),
        // a non-object on either side ends it
        () => differ(1, {}),
        () => differ({}, 1),
        () => differ(null, {}),
        () => differ({}, null),
    ],
    identity: [
        // the same reference short-circuits before any traversal
        () => {
            const a = { x: [1, 2] }
            same(a, a)
        },
    ],
    arrays: [
        () => same([], []),
        () => same([1, { a: 2 }], [1, { a: 2 }]),
        // length first, then elementwise
        () => differ([1], [1, 2]),
        () => differ([1, 2], [2, 1]),
        // an array is never the same as a non-array, in either position
        () => differ([], {}),
        () => differ({}, []),
    ],
    objects: [
        () => same({}, {}),
        // property order is not part of the structure
        () => same({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }),
        // same count, different names
        () => differ({ a: 1 }, { b: 1 }),
        // same names, different values
        () => differ({ a: 1 }, { a: 2 }),
        () => differ({ a: { b: 1 } }, { a: { b: 2 } }),
        // different counts
        () => differ({ a: 1 }, { a: 1, b: 2 }),
        // an `undefined`-valued property is still a property
        () => differ({ a: undefined }, {}),
        () => differ({}, { a: undefined }),
    ],
}
