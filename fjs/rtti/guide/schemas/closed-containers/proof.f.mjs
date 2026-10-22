import { drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        // Closed vs open: refused by the first schema, accepted by the second.
        closedVsOpen: () => verdicts('Closed vs open', [false, true]),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
