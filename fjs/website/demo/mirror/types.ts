/**
 * Type-level API of `fjs/website/demo/mirror`: where an edit of a highlighted
 * field falls in the text nodes of its coloured copy.
 *
 * @module
 */

/**
 * What the reader did to the field, as a change to one of the copy's text
 * nodes: in the node numbered `index`, from `at`, `removed` UTF-16 units are
 * replaced by `inserted`.
 */
export type Edit = {
    readonly index: number
    readonly at: number
    readonly removed: number
    readonly inserted: string
}

/**
 * The field's edit, asked of its copy. The copy holds `was`, in text nodes of
 * the given `lengths` (the last of them the copy's terminator, which `was` does
 * not include), and the field now holds `now`, with the caret at `caret`.
 */
export type EditQuestion = {
    readonly was: string
    readonly now: string
    readonly caret: number
    readonly lengths: readonly number[]
}
