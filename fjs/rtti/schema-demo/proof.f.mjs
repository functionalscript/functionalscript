import { assert } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { number } from '../module.f.mjs'
import { schemaDemo } from './module.f.mjs'

/** A demo of one example with one schema. */
const single = schemaDemo([['One', [{ name: 'n', about: 'a number', schemas: [{ source: 'number', schema: number }], value: 'export default 1;' }]]])

export const proof = {
    // A demo needs an example to open on.
    throw: () => schemaDemo([['None', []]]),
    // With one example and one schema there is nothing to pick: neither the
    // example drop-down nor the comparison is drawn.
    single: () => {
        const html = htmlToString(single.view(single.init))
        assert(!html.includes('name="example"'), html)
        assert(!html.includes('name="compare"'), html)
        assert(html.includes('name="value"'), html)
    },
}
