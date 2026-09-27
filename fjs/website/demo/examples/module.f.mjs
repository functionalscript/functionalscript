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
 * **The drop-down's `name` is `example`**, the name its `input` events arrive
 * under, so a demo tells a pick from typing without holding a DOM node.
 *
 * @module
 *
 * @import { Examples } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 */

/** The `name` of the drop-down, and of the `input` events a pick sends. */
export const name = 'example'

/**
 * The drop-down for `examples`, with the example `text` is selected — or,
 * when `text` is none of them, a `Custom` entry that is.
 *
 * @type {(examples: Examples) => (text: string) => Element}
 */
export const picker = examples => text => {
    /** @type {readonly Element[]} */
    const options = examples.map(([n, source]) =>
        ['option', source === text ? { value: n, selected: '' } : { value: n }, n])
    const custom = examples.some(([, source]) => source === text)
        ? []
        : [/** @type {Element} */ (['option', { value: '', selected: '' }, 'Custom'])]
    return ['p',
        ['label', { for: name }, 'Example '],
        ['select', { id: name, name }, ...custom, ...options],
    ]
}

/**
 * The text after picking `value`: the source of the example it names, or
 * `text` unchanged for a name no example has — `Custom`'s empty one.
 *
 * @type {(examples: Examples) => (text: string) => (value: string) => string}
 */
export const pick = examples => text => value =>
    examples.find(([n]) => n === value)?.[1] ?? text
