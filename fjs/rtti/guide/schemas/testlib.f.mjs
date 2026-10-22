/**
 * Helpers shared by the proofs of the schemas pages: each page's proof names
 * its lessons and the verdicts its text promises, and these do the checking.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../../website/demo/types.ts'
 * @import { DemoExample, DemoState, Type } from '../../types.ts'
 * @import { Unknown } from '../../ts/types.ts'
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { _readersOf } from '../../schema-demo/module.f.mjs'
import { parse } from '../../parse/module.f.mjs'
import { validate } from '../../validate/module.f.mjs'
import { toData, validate as dataValidate } from '../../data/module.f.mjs'

/**
 * What both readers make of a lesson's value against each of its schemas:
 * the two agree, and each verdict is the one the page's text promises. With
 * `text`, the value is that document instead: one the page invites the reader
 * to type.
 *
 * @type {(lessons: readonly DemoExample[]) => (name: string, expected: readonly boolean[], text?: string) => void}
 */
export const verdicts = lessons => (name, expected, text) => {
    const lesson = lessons.find(e => e.name === name)
    assert(lesson !== undefined, name)
    assertEq(lesson.schemas.length, expected.length)
    lesson.schemas.forEach((s, i) => {
        const r = _readersOf(s.schema)(text ?? lesson.value)
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

/**
 * Whether `schema` admits `value`, asserting that all three readers — `parse`,
 * `validate` and the data form's `validate` — give the same answer, so a
 * page's example states one verdict for all of them.
 *
 * @type {(schema: Type, value: Unknown) => boolean}
 */
export const admits = (schema, value) => {
    const s = /** @type {any} */ (schema)
    const p = parse(s)(value)[0] === 'ok'
    assertEq(validate(s)(value)[0] === 'ok', p)
    assertEq(dataValidate(toData(schema))(value)[0] === 'ok', p)
    return p
}
