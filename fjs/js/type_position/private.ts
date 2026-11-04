/**
 * The type-position scan's own types.
 *
 * @module
 */

/**
 * One bracket or type the scan is inside: what it reads (`value`, a
 * parameter list's `params`, or a `type`), the token that closes it or
 * `null` for a type with no bracket of its own, and what it tracks.
 */
export type _Frame = {
    readonly mode: 'value' | 'params' | 'type'
    readonly close: string | null
    /** For a type with no bracket: the tokens that end it. */
    readonly ends: readonly string[]
    /** For a type with no bracket: whether a line's end ends it. */
    readonly newline: boolean
    /** In a value: whether a `:` here annotates a declaration's name. */
    readonly decl: boolean
    /** In a value: whether this statement declares, so a `,` declares again. */
    readonly declStatement: boolean
    /** In a value: the ternaries open, whose `:` is no annotation. */
    readonly ternary: number
    /** In a parameter list: whether a default value is being read. */
    readonly default: boolean
    /** In a value: whether these braces are an import's or export's names, whose `as` renames. */
    readonly clause: boolean
}
