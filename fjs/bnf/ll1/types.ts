/**
 * Types for the LL(1) dispatch/matcher backend.
 *
 * @module
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type { Entry, Ast, Meta, TransformerMap, TransformerTools } from '../matcher/types.ts'

/**
 * A rule's dispatch entry: its first set as a range map, and — for a variant
 * that can match empty — the branch a dispatch miss selects.
 *
 * @internal
 */
export type _DispatchRule = {
    readonly empty: _DispatchBranch | undefined,
    readonly rangeMap: _Dispatch
}

/** @internal */
export type _Dispatch = RangeMapArray<_DispatchResult>

/** @internal */
export type _DispatchResult = _DispatchBranch | null

/**
 * A branch as dispatch selects it: the name of the rule to invoke — a name
 * into the {@link _DispatchMap} — and the tag its node gets. Only a variant's
 * entries are ever read as branches; every other rule kind consults its range
 * map solely for first-set membership.
 *
 * @internal
 */
export type _DispatchBranch = {
    readonly tag: string | undefined,
    readonly name: string
}

/** @internal */
export type _DispatchMap = StringMap<_DispatchRule>

/**
 * Represents the remaining input after a match attempt, or `null` if no match is possible.
 *
 * The remainder is physical: consuming the synthesized end-of-input symbol
 * leaves it empty rather than making it `null`.
 */
export type Remainder<M> = readonly Meta<M, CodePoint>[] | null

/**
 * Parsing result of `parser` and `parserRuleSet`.
 *
 * Represents the result of a match operation, including the parsed AST rule and the remainder of the input.
 */
export type MatchResult<M> = readonly[Ast<Meta<M, CodePoint>>, boolean, Remainder<M>]

/**
 * LL(1) parser function for matching by rule name.
 *
 * `s` holds metadata-bearing physical symbols; the matcher synthesizes the one
 * logical end-of-input symbol after them.
 */
export type Match<M> = (name: string, s: readonly Meta<M, CodePoint>[]) => MatchResult<M>

/** Result of an LL(1) match that applies rule transformers while parsing. */
export type TransformMatchResult<T, M> =
    | readonly['ok', Meta<M, T>, readonly Meta<M, CodePoint>[]]
    | readonly['no-match', Remainder<M>]

/** A metadata-aware transforming match from one start rule. */
export type TransformMatch<T, M> =
    (s: readonly Meta<M, CodePoint>[]) => TransformMatchResult<T, M>

/** Metadata-bound transformer constructors and LL(1) builder. */
export type Transformers<M> = TransformerTools<M> & {
    readonly build: (rest: TransformerMap<M>) => <T>(
        start: Entry<M, T>,
    ) => TransformMatch<T, M>
}
