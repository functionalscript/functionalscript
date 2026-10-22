import { assert } from '../../../../asserts/module.f.js'
import { bigint, boolean, number, string, unknown } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // The lesson's value, and the one the page invites the reader to type.
    readers: {
        primitives: () => verdicts('Primitives', [true]),
        numberForBigint: () => verdicts('Primitives', [false],
            'export default {"flag":true,"count":NaN,"name":"x","big":7,"extra":[null]};'),
    },
    // The page's table: each kind admits every value of that kind, and only
    // those.
    examples: {
        boolean: () => assert(admits(boolean, false) && !admits(boolean, 0)),
        number: () => assert(admits(number, NaN) && admits(number, -Infinity) && !admits(number, 1n)),
        string: () => assert(admits(string, '') && !admits(string, null)),
        bigint: () => assert(admits(bigint, 7n) && !admits(bigint, 7)),
        unknown: () => assert(admits(unknown, [null, { a: undefined }]) && admits(unknown, undefined)),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
