/**
 * @import { Examples } from './types.ts'
 */

import { examplePicker, name } from './module.f.js'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.js'
import { occurrences } from '../../../types/string/module.f.mjs'

/** @type {Examples} */
const examples = [['One', 'export default 1;', 'one'], ['Two', 'export default 2;', 'two']]

const { view, pick, sourceOf, idOf } = examplePicker(examples)

/** @type {(text: string) => string} */
const html = text => htmlToString(view(text))

export const proof = {
    stableIds: () => {
        assertEq(sourceOf('two'), 'export default 2;')
        assertEq(idOf('export default 2;'), 'two')
        assertEq(sourceOf('retired'), null)
        assertEq(idOf('custom'), null)
        const changed = examplePicker([['A renamed second example', examples[1][1], 'two'], ['First', examples[0][1], 'one']])
        assertEq(changed.sourceOf('two'), sourceOf('two'))
        assertEq(changed.idOf(examples[1][1]), 'two')
        assertEq(changed.pick('A renamed second example'), examples[1][1])
        assert(htmlToString(changed.view(examples[1][1])).includes('selected="" data-example-id="two"'))
        const empty = examplePicker([['Empty', '', 'empty']])
        assertEq(empty.sourceOf('empty'), '')
        assertEq(empty.idOf(''), 'empty')
        assertEq(examplePicker([]).sourceOf('one'), null)
    },
    view: {
        // The drop-down carries the name its events arrive under.
        name: () => assert(html('export default 1;').includes(`<select id="${name}" name="${name}">`)),
        // The example the text is, and no other, is selected; with one
        // selected there is no `Custom` entry.
        selected: () => {
            const h = html('export default 2;')
            assertEq(occurrences(' selected=""')(h), 1)
            assert(h.includes('<option value="Two" selected="" data-example-id="two">Two</option>'), h)
            assert(!h.includes('>Custom<'), h)
        },
        // Text that is no example selects `Custom`, listed first and
        // disabled, so it can be shown but never picked.
        custom: () => {
            const h = html('export default 3;')
            assertEq(occurrences(' selected=""')(h), 1)
            assert(h.includes(`name="${name}"><option selected="" disabled="">Custom</option>`), h)
        },
    },
    pick: {
        // A name gives its example's source.
        known: () => assertEq(pick('Two'), 'export default 2;'),
        // An empty name is an example's like any other: `Custom` sends no
        // value, so there is nothing for it to be confused with.
        emptyName: () => assertEq(examplePicker([['', 'export default 0;', 'zero']]).pick(''), 'export default 0;'),
    },
    // A list whose names or sources repeat is refused where the picker is
    // built: a repeated name would be unreachable, a repeated source would
    // select two options at once.
    throw: {
        emptyId: () => examplePicker([['A', 'one', '']]),
        repeatedId: () => examplePicker([['A', 'one', 'same'], ['B', 'two', 'same']]),
        repeatedName: () => examplePicker([['A', 'one', 'a'], ['A', 'two', 'another-a']]),
        repeatedSource: () => examplePicker([['A', 'one', 'a'], ['B', 'one', 'b']]),
        // A name no example has is refused rather than answered with the
        // text unchanged: nothing the drop-down sends can be one.
        unknownName: () => pick('Three'),
    },
}
