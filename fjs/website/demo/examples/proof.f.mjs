/**
 * @import { Examples } from './types.ts'
 */

import { name, pick, picker } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {Examples} */
const examples = [['One', 'export default 1;'], ['Two', 'export default 2;']]

/** @type {(text: string) => string} */
const view = text => htmlToString(picker(examples)(text))

export const proof = {
    picker: {
        // The drop-down carries the name its events arrive under.
        name: () => assert(view('export default 1;').includes(`<select id="${name}" name="${name}">`)),
        // The example the text is, and no other, is selected; with one
        // selected there is no `Custom` entry.
        selected: () => {
            const html = view('export default 2;')
            assertEq(html.split(' selected=""').length - 1, 1)
            assert(html.includes('<option value="Two" selected="">Two</option>'), html)
            assert(!html.includes('>Custom<'), html)
        },
        // Text that is no example selects `Custom`, listed first and
        // disabled, so it can be shown but never picked.
        custom: () => {
            const html = view('export default 3;')
            assertEq(html.split(' selected=""').length - 1, 1)
            assert(html.includes(`name="${name}"><option selected="" disabled="">Custom</option>`), html)
        },
    },
    pick: {
        // A name replaces the text with its source.
        known: () => assertEq(pick(examples)('kept')('Two'), 'export default 2;'),
        // A name no example has keeps the text.
        unknown: () => assertEq(pick(examples)('kept')('Three'), 'kept'),
        // An empty name is an example's like any other: `Custom` sends no
        // value, so there is nothing for it to be confused with.
        emptyName: () => assertEq(pick([['', 'export default 0;']])('kept')(''), 'export default 0;'),
    },
}
