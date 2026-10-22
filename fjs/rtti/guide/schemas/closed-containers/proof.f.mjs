import { assert, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { number, option, or, string } from '../../../module.f.mjs'
import { admits, drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        closedVsOpen: () => verdicts('Closed vs open', [false, true]),
    },
    // The page's first table, row by row.
    closed: {
        extraKey: () => assert(!admits({ a: 42 }, { a: 42, b: 'x' })),
        exactStruct: () => assertStructurallySame(assertOk(parse({ a: 42 })({ a: 42 })), { a: 42 }),
        extraItem: () => assert(!admits([42], [42, 'extra'])),
        absentPosition: () => {
            assert(admits([number, or(option, string)], [42]))
            assertStructurallySame(assertOk(parse([number, or(option, string)])([42])), [42])
        },
        requiredPosition: () => assert(!admits([42], [])),
        // A hole past the prefix is checked by length.
        holePastPrefix: () => assert(!admits([42], [42, ,])),
    },
    // The table under "A hole is a declared position".
    holes: {
        hole: () => assert(admits(new Array(1), [undefined])),
        holeTooLong: () => assert(!admits(new Array(1), [1, 2, 3])),
        leadingHole: () => assert(admits([, number], [undefined, 5])),
        leadingHoleHeld: () => assert(!admits([, number], [9, 5])),
        // A non-index property of a tuple schema declares nothing.
        nonIndex: () => assert(admits(Object.assign([number], { foo: string }), [1])),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
