/**
 * @import { Examples } from './types.ts'
 */

import { examplePicker, name } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {Examples} */
const examples = [['One', 'export default 1;'], ['Two', 'export default 2;']]

const { view, pick } = examplePicker(examples)

/** @type {(text: string) => string} */
const html = text => htmlToString(view(text))

export const proof = {
    view: {
        // The drop-down carries the name its events arrive under.
        name: () => assert(html('export default 1;').includes(`<select id="${name}" name="${name}">`)),
        // The example the text is, and no other, is selected; with one
        // selected there is no `Custom` entry.
        selected: () => {
            const h = html('export default 2;')
            assertEq(h.split(' selected=""').length - 1, 1)
            assert(h.includes('<option value="Two" selected="">Two</option>'), h)
            assert(!h.includes('>Custom<'), h)
        },
        // Text that is no example selects `Custom`, listed first and
        // disabled, so it can be shown but never picked.
        custom: () => {
            const h = html('export default 3;')
            assertEq(h.split(' selected=""').length - 1, 1)
            assert(h.includes(`name="${name}"><option selected="" disabled="">Custom</option>`), h)
        },
    },
    pick: {
        // A name gives its example's source.
        known: () => assertEq(pick('Two'), 'export default 2;'),
        // An empty name is an example's like any other: `Custom` sends no
        // value, so there is nothing for it to be confused with.
        emptyName: () => assertEq(examplePicker([['', 'export default 0;']]).pick(''), 'export default 0;'),
    },
    // A list whose names or sources repeat is refused where the picker is
    // built: a repeated name would be unreachable, a repeated source would
    // select two options at once.
    throw: {
        repeatedName: () => examplePicker([['A', 'one'], ['A', 'two']]),
        repeatedSource: () => examplePicker([['A', 'one'], ['B', 'one']]),
        // A name no example has is refused rather than answered with the
        // text unchanged: nothing the drop-down sends can be one.
        unknownName: () => pick('Three'),
    },
}
