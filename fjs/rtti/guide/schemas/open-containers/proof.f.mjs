import { assert } from '../../../../asserts/module.f.js'
import { equal, toData } from '../../../data/module.f.mjs'
import { array, never, number, open, or, rest, string, unknown } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        tupleVsRest: () => verdicts('Tuple vs rest', [false, true]),
    },
    // The page's table, row by row.
    table: {
        tuple: () => assert(admits([number], [1]) && !admits([number], [1, 2])),
        openTuple: () => assert(admits(open([number]), [1, 'a', null]) && !admits(open([number]), ['a'])),
        restTuple: () => assert(admits(rest([number], string), [1, 'a', 'b']) && !admits(rest([number], string), [1, 2])),
        struct: () => assert(admits({ a: number }, { a: 1 }) && !admits({ a: number }, { a: 1, b: 2 })),
        openStruct: () => assert(admits(open({ a: number }), { a: 1, b: null })),
        restStruct: () => assert(admits(rest({ a: number }, string), { a: 1, b: 'x' }) && !admits(rest({ a: number }, string), { a: 1, b: 2 })),
    },
    // What the page says follows from stating openness.
    normalization: {
        restUnknownIsOpen: () => assert(equal(toData(rest({ a: number }, unknown)))(toData(open({ a: number })))),
        restNeverIsBare: () => assert(equal(toData(rest({ a: number }, never)))(toData({ a: number }))),
    },
    // An empty rest bounds an array's length. The page's sparse values are
    // host-made, so they are pinned in `../../../validate/proof.f.mjs`.
    emptyRest: {
        emptyArray: () => assert(admits(array(or()), []) && !admits(array(or()), [undefined])),
        pastPrefix: () => assert(!admits(rest([42], or()), [42, undefined])),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
