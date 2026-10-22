import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { number } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // The lessons' values, and the ones the page invites the reader to type.
    readers: {
        signedZero: () => verdicts('Zero and minus zero', [false, true]),
        zero: () => verdicts('Zero and minus zero', [true, false], 'export default 0;'),
        taggedUnion: () => verdicts('Tagged union', [true]),
        triangle: () => verdicts('Tagged union', [false], 'export default {"kind":"triangle","r":1};'),
        circleWithSide: () => verdicts('Tagged union', [false], 'export default {"kind":"circle","r":1,"side":2};'),
    },
    // The page's examples.
    examples: {
        circle: () => assertEq(assertOk(parse('circle')('circle')), 'circle'),
        square: () => assert(!admits('circle', 'square')),
        struct: () => assertStructurallySame(
            assertOk(parse({ kind: 'circle', r: 1 })({ kind: 'circle', r: 1 })), { kind: 'circle', r: 1 }),
        // The comparison is `Object.is`.
        nan: () => assert(admits(NaN, NaN)),
        zeros: () => assert(!admits(0, -0) && !admits(-0, 0)),
        // `undefined` is a constant: the key must be there.
        undefinedNeedsTheKey: () => {
            assert(admits({ a: undefined }, { a: undefined }))
            assert(!admits({ a: undefined }, {}))
        },
        // A constant tags a union's members.
        tag: () => assert(!admits({ kind: 'circle', r: number }, { kind: 'square', r: 1 })),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
