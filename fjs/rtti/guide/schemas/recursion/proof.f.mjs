import { assert, assertOk } from '../../../../asserts/module.f.js'
import { parse } from '../../../parse/module.f.mjs'
import { validate } from '../../../validate/module.f.mjs'
import { string } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

const verdicts = verdictsOf(lessons)

const address = { street: string, city: string }
const order = { billing: address, shipping: address }
const home = { street: '1 Main St', city: 'Kyiv' }
const value = { billing: home, shipping: home }

export const proof = {
    readers: {
        recursion: () => verdicts('Recursion', [true]),
        notATree: () => verdicts('Recursion', [false], 'export default {"value":1,"children":[{"value":2}]};'),
        sharedParts: () => verdicts('Shared parts', [true]),
    },
    // A shared value: `validate` hands it back, sharing included, and
    // `parse` builds a copy for each use.
    sharing: {
        validate: () => {
            const v = assertOk(validate(order)(value))
            assert(v === value && v.billing === v.shipping)
        },
        parse: () => {
            const p = assertOk(parse(order)(value))
            assert(p.billing !== p.shipping)
        },
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
