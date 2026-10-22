/**
 * Helpers shared by the proofs of the schemas pages: each page's proof names
 * its lessons and the verdicts its text promises, and these do the checking.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../../website/demo/types.ts'
 * @import { DemoExample, DemoState } from '../../types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { _readersOf } from '../../schema-demo/module.f.mjs'

/**
 * What both readers make of a lesson's value against each of its schemas:
 * the two agree, and each verdict is the one the page's text promises.
 *
 * @type {(lessons: readonly DemoExample[]) => (name: string, expected: readonly boolean[]) => void}
 */
export const verdicts = lessons => (name, expected) => {
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

/**
 * The page's demo opens on its first lesson and draws it.
 *
 * @type {(lessons: readonly DemoExample[], demo: Demo<DemoState, DemoEvent>) => () => void}
 */
export const drawsFirst = (lessons, demo) => () => {
    assertEq(demo.init.example, lessons[0]?.name)
    assert(htmlToString(demo.view(demo.init)).includes('<svg'))
}
