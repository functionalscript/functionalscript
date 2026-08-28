/**
 * Implementation-private types for the LL(1) matcher machine.
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Sequence } from '../data/types.ts'
import type { Ast, AstResult, AstSequence, AstTag, Cursor } from '../matcher/types.ts'

/**
 * Where a match stopped: a {@link Cursor}, or `null` when it ran out of input —
 * the `null` `Remainder` this backend reports for that.
 */
export type _Position = Cursor | null

/**
 * The machine's own result: a `MatchResult` positioned by a cursor instead of
 * by a materialized remainder.
 */
export type _Result = AstResult<CodePoint, _Position>

/**
 * A suspended sequence match: `items[itemIndex]` is being matched by the
 * current task, and `seq` holds the ASTs of the items already matched.
 */
export type _SeqFrame = {
    readonly kind: 'seq'
    readonly tag: AstTag
    readonly items: Sequence
    readonly itemIndex: number
    readonly seq: AstSequence<CodePoint>
}

/**
 * A suspended repetition: the item is being matched by the current task for
 * one more round, and `items` holds the ASTs of the rounds that already
 * completed. They accumulate as a list rather than an array because a
 * repetition is as long as its input: appending to an array per round would
 * copy the whole prefix each time and make one repetition quadratic in the
 * number of items it matched.
 */
export type _RepeatFrame = {
    readonly kind: 'repeat'
    readonly tag: AstTag
    readonly item: string
    readonly items: _Items
}

export type _Items = List<Ast<CodePoint>>

export type _Frame = _SeqFrame | _RepeatFrame

/**
 * Immutable cons-cell stack: O(1) push/pop, no array copying per step.
 */
export type _Stack = null | {
    readonly top: _Frame
    readonly rest: _Stack
}

/**
 * The rule invocation about to be evaluated, or `null` when a result is ready
 * to resume the innermost frame instead.
 */
export type _RuleTask = {
    readonly kind: 'rule'
    readonly name: string
    readonly tag: AstTag
    readonly pos: Cursor
}

/**
 * The next round of a repetition, about to be decided by lookahead. Both the
 * rule that introduces a repetition and the frame that finishes one of its
 * rounds go through this, so a round is set up in exactly one place.
 */
export type _RepeatTask = {
    readonly kind: 'repeat'
    readonly tag: AstTag
    readonly item: string
    readonly items: _Items
    readonly pos: Cursor
}

export type _Task = _RuleTask | _RepeatTask
