import { drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        // Absent vs undefined: accepted by the first schema, refused by the second.
        absentVsUndefined: () => verdicts('Absent vs undefined', [true, false]),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
