import { assert } from '../../../../asserts/module.f.js'
import { cmp, equal, subset, toData } from '../../../data/module.f.mjs'
import { boolean, number, or, string } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // The lesson's value, and the one the page invites the reader to type.
    readers: {
        subset: () => verdicts('Subset', [true, true]),
        seven: () => verdicts('Subset', [false, true], 'export default {"a":7};'),
    },
    // The page's examples.
    examples: {
        twoSpellings: () => assert(equal(toData(or(true, false)))(toData(boolean))),
        subset: () => assert(subset(toData({ a: 42 }))(toData({ a: number }))),
        notSuperset: () => assert(!subset(toData({ a: number }))(toData({ a: 42 }))),
        absorbed: () => assert(equal(toData(or(42, number)))(toData(number))),
        ordered: () => assert(cmp(toData(number))(toData(string)) !== 0),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
