import { assert } from '../../../../asserts/module.f.js'
import { array, number, or, record, string } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // The lesson's value, and the one the page invites the reader to type.
    readers: {
        dictionary: () => verdicts('Dictionary', [true]),
        countAsString: () => verdicts('Dictionary', [false], 'export default {"apples":"3","pears":5};'),
    },
    // The page's examples.
    examples: {
        tags: () => assert(admits(array(string), []) && admits(array(string), ['a', 'b']) && !admits(array(string), ['a', 1])),
        stock: () => assert(admits(record(number), {}) && !admits(record(number), { a: 'x' })),
        // An empty rest bounds the length.
        emptyArray: () => assert(admits(array(or()), []) && !admits(array(or()), [1])),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
