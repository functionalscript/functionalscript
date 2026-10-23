import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

export const proof = {
    // Each schema accepts the value the page offers with it, on both readers.
    readers: Object.fromEntries(lessons.map(e => [e.name, () => verdicts(e.name, [true])])),
    // The demo opens on the page's first schema and draws it.
    demo: drawsFirst(lessons, demo),
}
