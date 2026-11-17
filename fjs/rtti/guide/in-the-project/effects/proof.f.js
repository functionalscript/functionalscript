import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.js'
import { lessons } from './sample.f.js'
import { demo } from './demo.f.js'
import { nameOf } from '../../../../types/object/name/module.f.js'

const verdicts = verdictsOf(lessons)

export const proof = {
    // Each schema accepts the value the page offers with it, on both readers.
    readers: Object.fromEntries(lessons.map(e => [nameOf(e), () => verdicts(nameOf(e), [true])])),
    // The demo opens on the page's first schema and draws it.
    demo: drawsFirst(lessons, demo),
}
