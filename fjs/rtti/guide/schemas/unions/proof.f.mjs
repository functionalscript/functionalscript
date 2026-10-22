import { drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        // Two spellings, one set: accepted by the first schema, accepted by the second.
        twoSpellingsOneSet: () => verdicts('Two spellings, one set', [true, true]),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
