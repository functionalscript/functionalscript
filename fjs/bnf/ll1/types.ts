/**
 * Types for the LL(1) dispatch/matcher backend.
 *
 * @module
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type { EmptyTag } from '../data/types.ts'
import type { Ast } from '../matcher/types.ts'

/** @internal */
export type _DispatchRule = {
    readonly emptyTag: EmptyTag,
    readonly rangeMap: _Dispatch
}

/** @internal */
export type _Dispatch = RangeMapArray<_DispatchResult>

/** @internal */
export type _DispatchResult = _DispatchRuleCollection | null

/**
 * The rules a dispatched symbol selects, to be matched one after another. They
 * are names into the {@link _DispatchMap}: the builder only ever appends rule
 * names, so the matcher resolves each one there.
 *
 * @internal
 */
export type _DispatchRuleCollection = {
    readonly tag: string | undefined,
    readonly rules: readonly string[]
}

/** @internal */
export type _DispatchMap = StringMap<_DispatchRule>

/**
 * Represents the remaining input after a match attempt, or `null` if no match is possible.
 *
 * The remainder is physical: consuming the synthesized end-of-input symbol
 * leaves it empty rather than making it `null`.
 */
export type Remainder = readonly CodePoint[] | null

/**
 * Parsing result of `parser` and `parserRuleSet`.
 *
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult = readonly[Ast<CodePoint>, boolean, Remainder]

/**
 * LL(1) parser function for matching by rule name.
 *
 * `s` holds physical symbols only; the matcher synthesizes the one logical
 * end-of-input symbol after them.
 */
export type Match = (name: string, s: readonly CodePoint[]) => MatchResult
