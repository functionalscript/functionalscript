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

/** The `name` of the drop-down, and of the `input` events a pick sends. */
export const name = 'example'

/**
 * `list` as the drop-down a demo draws and the pick it makes — after
 * checking that its names and its sources are each distinct.
 *
 * **A repeat is refused, not resolved.** A pick is matched by name, so a
 * second example under a name already used could never be reached; the
 * selection is matched by source, so two examples with one source would
 * both be selected, which a single-select cannot be. Either way the list is
 * the demo author's to get right, so a repeat is a bug in the demo and
 * panics here, once, when the demo builds its picker — not on every render.
 *
 * `view(text)` selects the example `text` is, or, when `text` is none of
 * them, a `Custom` entry. `pick(text)(value)` is the source of the example
 * `value` names, or `text` unchanged for a name no example has. `Custom`
 * sends none, being disabled, so every name a pick sends is an example's.
 *
 * @type {(list: Examples) => Picker}
 */
export const examplePicker = list => {
    if (new Set(list.map(([n]) => n)).size !== list.length) { throw 'examples: a name is repeated' }
    if (new Set(list.map(([, source]) => source)).size !== list.length) { throw 'examples: a source is repeated' }
    return {
        view: text => {
            /** @type {readonly Element[]} */
            const options = list.map(([n, source]) =>
                ['option', source === text ? { value: n, selected: '' } : { value: n }, n])
            const custom = list.some(([, source]) => source === text)
                ? []
                : [/** @type {Element} */ (['option', { selected: '', disabled: '' }, 'Custom'])]
            return ['p',
                ['label', { for: name }, 'Example '],
                ['select', { id: name, name }, ...custom, ...options],
            ]
        },
        pick: text => value => list.find(([n]) => n === value)?.[1] ?? text,
    }
}
