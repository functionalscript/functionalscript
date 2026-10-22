import { drawsFirst, verdicts as verdictsOf } from '../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    readers: {
        // Recursion: accepted.
        recursion: () => verdicts('Recursion', [true]),
        // Shared parts: accepted.
        sharedParts: () => verdicts('Shared parts', [true]),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
