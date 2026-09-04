/**
 * Implementation-private types for the LL(1) machine in `./module.f.mjs`.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { RangeSet } from '../../types/range_set/types.ts'
import type { FirstMap } from './types.ts'

/**
 * One step of the first-set walk: the map extended with every rule computed
 * on the way, and the first set of the rule the step was asked for.
 */
export type _FirstState = readonly [map: FirstMap, first: RangeSet]

/**
 * What one rule contributes to the follow sets of the rules it names: the
 * symbols that may come right after each, in that rule.
 */
export type _Follows = readonly (readonly [name: string, symbols: RangeSet])[]

/**
 * A suspended sequence: `items[index]` is being matched, and `done` holds the
 * trees of the items before it.
 */
export type _SequenceFrame = {
    readonly kind: 'sequence'
    readonly items: readonly string[]
    readonly index: number
    readonly done: readonly unknown[]
}

/** A suspended variant: the branch `tag` selected is being matched. */
export type _VariantFrame = {
    readonly kind: 'variant'
    readonly tag: string
}

/**
 * A suspended repetition: one more round of `item` is being matched, and
 * `rounds` holds the trees of the `count` rounds before it. They accumulate
 * as a list rather than an array because a repetition is as long as its
 * input, and appending to an array per round would copy the whole prefix
 * each time.
 */
export type _RepeatFrame = {
    readonly kind: 'repeat'
    readonly min: number
    readonly max: number
    readonly item: string
    readonly rounds: List<unknown>
    readonly count: number
}

export type _Frame = _SequenceFrame | _VariantFrame | _RepeatFrame

/** The frames a match has suspended, innermost first: an immutable stack. */
export type _Stack = null | {
    readonly top: _Frame
    readonly rest: _Stack
}

/**
 * What the machine does next: enter the rule `name` at `pos`, or hand a
 * result to the innermost frame. A position is a cursor: `0 .. length` are
 * the physical positions, and `length + 1` is where the one synthesized end
 * of input has been consumed.
 */
export type _Step =
    | readonly ['enter', name: string, pos: number]
    | readonly ['ok', ast: unknown, pos: number]
    | readonly ['error', pos: number]

export type _State = readonly [stack: _Stack, step: _Step]
