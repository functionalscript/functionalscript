import { assert, assertEq, assertOk } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { number, option, or } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // The lesson's value, and the one the page invites the reader to type.
    readers: {
        absentVsUndefined: () => verdicts('Absent vs undefined', [true, false]),
        swapped: () => verdicts('Absent vs undefined', [false, true], 'export default {"a":undefined};'),
    },
    // The page's examples, but the hole: `[, 3]` is host-made, and
    // FunctionalScript proofs take only values it can build.
    examples: {
        mayBeAbsent: () => assert(admits({ a: or(option, number) }, {}) && !admits({ a: or(option, number) }, { a: undefined })),
        mustBePresent: () => assert(admits({ a: or(number, undefined) }, { a: undefined }) && !admits({ a: or(number, undefined) }, {})),
        all: () => assert(admits({ a: or(option, number, undefined) }, {})
            && admits({ a: or(option, number, undefined) }, { a: undefined })
            && admits({ a: or(option, number, undefined) }, { a: 1 })),
    },
    // Neither reader fills an absent member in.
    notFilled: () => assertEq(Object.keys(assertOk(parse({ a: or(option, number) })({}))).length, 0),
    // At the top level, absence is unobservable.
    topLevel: () => assert(admits(or(option, number), 1) && !admits(or(option, number), undefined)),
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
