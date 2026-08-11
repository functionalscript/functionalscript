/**
 * Types for the LL(1) dispatch/matcher backend.
 *
 * @module
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type { EmptyTag } from '../data/types.ts'

/** @internal */
export type _DispatchRule = {
    readonly emptyTag: EmptyTag,
    readonly rangeMap: _Dispatch
}

/** @internal */
export type _Dispatch = RangeMapArray<_DispatchResult>

/** @internal */
export type _DispatchResult = _DispatchRuleCollection | null

/** @internal */
export type _DispatchRuleOrName = _DispatchRule | string

/** @internal */
export type _DispatchRuleCollection = {
    readonly tag: string | undefined,
    readonly rules: _DispatchRuleOrName[]
}

/** @internal */
export type _DispatchMap = StringMap<_DispatchRule>

/**
 * Represents a parsed AST rule, consisting of a rule name and its parsed sequence.
 *
 * @internal
 */
export type _AstRule = {
    readonly tag: AstTag,
    readonly sequence: AstSequence
}

/**
 * Represents a parsed AST sequence.
 */
export type AstSequence = readonly(_AstRule|CodePoint)[]

export type AstTag = string|true|undefined

/**
 * Represents the remaining input after a match attempt, or `null` if no match is possible.
 */
export type Remainder = readonly CodePoint[] | null

/**
 * Parsing result of `parser` and `parserRuleSet`.
 *
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult = readonly[_AstRule, boolean, Remainder]

/**
 * LL(1) parser function for matching by rule name.
 */
export type Match = (name: string, s: readonly CodePoint[]) => MatchResult

/**
 * Internal match function signature used by compiled dispatch rules.
 */
export type MatchRule = (dr: _DispatchRule, s: readonly CodePoint[]) => MatchResult
