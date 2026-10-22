import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { validate } from '../../../validate/module.f.mjs'
import { toData, validate as dataValidate } from '../../../data/module.f.mjs'
import { array, number, or, string } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

/**
 * @import { Type } from '../../../types.ts'
 * @import { Unknown } from '../../../ts/types.ts'
 */

const verdicts = verdictsOf(lessons)

/**
 * The error `parse` and `validate` report, asserting they report the same
 * one and that the data form's `validate` refuses the value too.
 *
 * @type {(schema: Type, value: Unknown) => unknown}
 */
const errorOf = (schema, value) => {
    const s = /** @type {any} */ (schema)
    const p = parse(s)(value)
    assertEq(p[0], 'error')
    assertStructurallySame(validate(s)(value), p)
    assertEq(dataValidate(toData(schema))(value)[0], 'error')
    return p[1]
}

export const proof = {
    // The lesson's value, and the one the page invites the reader to type.
    readers: {
        whereItFailed: () => verdicts('Where it failed', [false]),
        fixed: () => verdicts('Where it failed', [true],
            'export default {"items":[{"sku":"A1","qty":2},{"sku":"B2","qty":3}]};'),
    },
    // The page's examples.
    examples: {
        path: () => assertStructurallySame(
            errorOf({ items: array({ sku: string, qty: number }) },
                { items: [{ sku: 'A1', qty: 2 }, { sku: 'B2', qty: '3' }] }),
            { path: ['items', '1', 'qty'], message: 'unexpected value' }),
        absent: () => assertStructurallySame(errorOf({ a: number }, {}),
            { path: ['a'], message: 'unexpected value' }),
        undeclared: () => assertStructurallySame(errorOf({ a: number }, { a: 1, b: 2 }),
            { path: [], message: 'unexpected value' }),
        // The shape is settled before any member is read: the absent `b` is
        // reported, not the wrong `a`.
        shapeFirst: () => assertStructurallySame(errorOf({ a: number, b: number }, { a: 'x' }),
            { path: ['b'], message: 'unexpected value' }),
        // The data form agrees on acceptance and may name another member.
        dataFormPath: () => assertStructurallySame(
            dataValidate(toData({ a: number }))({ a: 1, b: 2 }),
            ['error', { path: ['b'], message: 'unexpected value' }]),
        // A union refuses as a whole, at its own path.
        noMatch: () => assertStructurallySame(
            errorOf(or({ kind: 'a', x: number }, { kind: 'b', y: string }), { kind: 'a', x: '1' }),
            { path: [], message: 'no match' }),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
