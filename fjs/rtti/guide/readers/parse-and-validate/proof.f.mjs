import { assert, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { validate } from '../../../validate/module.f.mjs'
import { number, open, option, or, string } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

const person = open({ name: string, age: number })
const alice = { name: 'Alice', age: 30, admin: true }

export const proof = {
    readers: {
        builtOrHandedBack: () => verdicts('Built or handed back', [true]),
    },
    // The page's example and its table, row by row.
    table: {
        built: () => assertStructurallySame(assertOk(parse(person)(alice)), { name: 'Alice', age: 30 }),
        handedBack: () => assert(assertOk(validate(person)(alice)) === alice),
        absent: () => {
            const s = { a: or(option, number) }
            assert(!('a' in assertOk(parse(s)({}))))
            assert(!('a' in assertOk(validate(s)({}))))
        },
        shared: () => {
            const s = { x: { n: number }, y: { n: number } }
            const n = { n: 1 }
            const p = assertOk(parse(s)({ x: n, y: n }))
            const v = assertOk(validate(s)({ x: n, y: n }))
            assert(p.x !== p.y && v.x === v.y)
        },
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
