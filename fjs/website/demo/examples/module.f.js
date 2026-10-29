/**
 * An examples drop-down for a demo whose state is a source text: pick one and
 * its source replaces the text. The shared half of every such demo, so each
 * demo supplies only its own list.
 *
 * **Which example is selected is read off the text, not stored beside it.**
 * The text is the demo's whole state, and a second field saying which example
 * it came from is a value the state can already compute — the way the two
 * drift apart. So the option whose source is the text is the selected one,
 * and text a reader has edited into none of them selects a `Custom` entry
 * that exists only while it is needed.
 *
 * **`Custom` is disabled, so it never sends a pick.** It names no source —
 * it only says the text is none of the examples — and a value of its own
 * would be one some example could also have: an example named `''` would
 * then be indistinguishable from it. Disabled, it cannot be chosen, so every
 * pick names a real example and no name has to be reserved.
 *
 * **The drop-down's `name` is `example`**, the name its `input` events arrive
 * under, so a demo tells a pick from typing without holding a DOM node.
 *
 * @module
 *
 * @import { Examples, Picker } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */

import { option, selectField } from '../controls/module.f.js'

/** The `name` of the drop-down, and of the `input` events a pick sends.
 * @type {string}
 */
export const name = 'example'

/** Whether a list of strings repeats a value. @type {(values: readonly string[]) => boolean} */
const hasRepeat = values => values.some((value, index) => values.indexOf(value) !== index)

/** Nonempty stable IDs are unique within one demo's examples.
 * @type {(ids: readonly string[]) => void}
 */
export const assertExampleIds = ids => {
    if (ids.some(id => id === '')) { throw 'examples: an ID is empty' }
    if (hasRepeat(ids)) { throw 'examples: an ID is repeated' }
    return undefined
}

/**
 * `list` as the drop-down a demo draws and the pick it makes — after
 * checking that its names, sources and stable IDs are each distinct.
 * sourceOf(id) and idOf(text) connect stable links to complete example text;
 * unknown IDs and custom text return null. Labels remain dropdown values.
 *
 * **A repeat is refused, not resolved.** A pick is matched by name, so a
 * second example under a name already used could never be reached; the
 * selection is matched by source, so two examples with one source would
 * both be selected, which a single-select cannot be. Either way the list is
 * the demo author's to get right, so a repeat is a bug in the demo and
 * panics here, once, when the demo builds its picker — not on every render.
 *
 * `view(text)` selects the example `text` is, or, when `text` is none of
 * them, a `Custom` entry. `pick(value)` is the source of the example
 * `value` names.
 *
 * **A name no example has is refused too.** `Custom` sends none, being
 * disabled, so every name the drop-down can send is an example's: another
 * one reaching `pick` is a bug in whatever sent it, and keeping the text
 * would answer it with a plausible no-op.
 *
 * @type {(list: Examples) => Picker}
 */
export const examplePicker = list => {
    assertExampleIds(list.map(example => example[2]))
    if (hasRepeat(list.map(example => example[0]))) { throw 'examples: a name is repeated' }
    if (hasRepeat(list.map(example => example[1]))) { throw 'examples: a source is repeated' }
    return {
        sourceOf: id => list.find(example => example[2] === id)?.[1] ?? null,
        idOf: text => list.find(example => example[1] === text)?.[2] ?? null,
        view: text => {
            /** @type {readonly Element[]} */
            const options = list.map(([n, source, id]) =>
                ['option', { ...option(n, n, source === text)[1], 'data-example-id': id }, n])
            const custom = list.some(example => example[1] === text)
                ? []
                : [/** @type {Element} */ (['option', { selected: '', disabled: '' }, 'Custom'])]
            return selectField({ name, label: 'Example' }, [...custom, ...options])
        },
        pick: value => {
            const found = list.find(example => example[0] === value)
            if (found === undefined) { throw 'examples: no example has this name' }
            return found[1]
        },
    }
}
