import { assert } from '../../../../asserts/module.f.js'
import { equal, subset, toData } from '../../../data/module.f.mjs'
import { boolean, never, number, or, string } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        twoSpellingsOneSet: () => verdicts('Two spellings, one set', [true, true]),
        notABoolean: () => verdicts('Two spellings, one set', [false, false], 'export default 1;'),
    },
    // The page's examples.
    examples: {
        id: () => assert(admits(or(string, number), 'x') && admits(or(string, number), 1) && !admits(or(string, number), null)),
        never: () => assert(!admits(never, undefined) && !admits(never, null)),
        // The data form's algebra, as the page states it.
        twoSpellings: () => assert(equal(toData(or(true, false)))(toData(boolean))),
        absorbed: () => assert(equal(toData(or(42, number)))(toData(number))),
        constantInKind: () => assert(subset(toData(42))(toData(number))),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
