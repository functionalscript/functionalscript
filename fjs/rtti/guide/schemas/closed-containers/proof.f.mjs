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
    },
    // The sparse arrays the page talks about (a hole past the prefix, the
    // table under "A hole is a declared position") are host-made, so they are
    // pinned in `../../../validate/proof.f.mjs`'s agreement table, not here.
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
