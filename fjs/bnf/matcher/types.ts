/**
 * Type-level API for the layer every BNF matcher backend shares: the position
 * it matches at, the AST it builds, and the result that pairs them.
 *
 * @module
 */

/**
 * Tag of an AST node: the variant branch that matched, `true` where a rule
 * matched empty input without naming a branch, and `undefined` where the rule
 * is not a choice at all.
 */
export type AstTag = string | true | undefined

/**
 * An AST over leaves of type `L`. A backend picks `L` for what it keeps of a
 * consumed symbol — the code point alone, or the code point with metadata.
 */
export type Ast<L> = {
    readonly tag: AstTag
    readonly sequence: AstSequence<L>
}

/** The children of an {@link Ast} node: nested nodes and consumed leaves. */
export type AstSequence<L> = readonly(Ast<L> | L)[]

/**
 * A match position over input of `length` leaves: `0 .. length` are the
 * physical positions, and `length + 1` is where the one synthesized
 * end-of-input symbol has been consumed.
 *
 * This is the complete cursor `(idx, eofConsumed)` of
 * [the BNF contract](../README.md#logical-eof-in-parser-input) written as one
 * number. `eofConsumed` can only be true at the physical end, so the pair and
 * the extended position hold the same information — and being one number is
 * what makes every ordering a backend needs a plain `<`, because consuming EOF
 * *is* progress even though the public index does not move. A backend that
 * treated it as no progress would loop forever on a repetition over a rule that
 * can match EOF.
 *
 * Public positions are physical, so a cursor is converted back with
 * `physicalIdx` before it leaves a backend.
 */
export type Cursor = number

/**
 * A matcher's own result: the AST built so far, whether it matched, and where
 * it stopped.
 *
 * `P` is the position type. A backend whose match always has one uses
 * {@link Cursor}; one that also reports running out of input uses
 * `Cursor | null`. Public results are each backend's own type — this is the
 * shape they are built from, not the shape they return.
 */
export type AstResult<L, P> = {
    readonly ast: Ast<L>
    readonly success: boolean
    readonly pos: P
}
