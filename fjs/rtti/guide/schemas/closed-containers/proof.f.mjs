import { assert, assertEq } from '../../../../asserts/module.f.js'
import { htmlToString } from '../../../../media/html/module.f.mjs'
import { _readersOf } from '../../../schema-demo/module.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

/**
 * What both readers make of a lesson's value against each of its schemas:
 * the two agree, and each verdict is the one the page's text promises.
 *
 * @type {(name: string, expected: readonly boolean[]) => void}
 */
const verdicts = (name, expected) => {
    const lesson = lessons.find(e => e.name === name)
    assert(lesson !== undefined, name)
    assertEq(lesson.schemas.length, expected.length)
    lesson.schemas.forEach((s, i) => {
        const r = _readersOf(s.schema)(lesson.value)
        assert(!('error' in r), name)
        assertEq(r.parse.ok, expected[i])
        assertEq(r.validate.ok, expected[i])
    })
}

export const proof = {
    readers: {
        // Closed vs open: refused by the first schema, accepted by the second.
        closedVsOpen: () => verdicts('Closed vs open', [false, true]),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: () => {
        assertEq(demo.init.example, lessons[0]?.name)
        assert(htmlToString(demo.view(demo.init)).includes('<svg'))
    },
}
