/**
 * Type-level API for `fjs/website/demo/examples/module.f.mjs`: the examples a
 * demo offers in a drop-down above its source.
 *
 * @module
 */

import type { Element } from '../../../media/html/types.ts'

/**
 * One example: the name it is picked by and the source it puts in the demo's
 * text. Names and sources are each distinct within a list — a pick is matched
 * by name and the selection by source, so a repeat of either is an entry that
 * cannot be told apart from the one before it. `examplePicker` refuses a list
 * that breaks this.
 */
export type Example = readonly [name: string, source: string]

/** A demo's examples, in the order its drop-down lists them. */
export type Examples = readonly Example[]

/**
 * A checked list of examples, as a demo uses it: `view` draws the drop-down
 * for the current text, and `pick` gives the text after a pick.
 */
export type Picker = {
    readonly view: (text: string) => Element
    readonly pick: (text: string) => (value: string) => string
}
