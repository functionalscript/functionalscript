/**
 * Types for the recursive descent matcher backend.
 *
 * The AST it builds is the shared one, over leaves that carry metadata:
 * `Ast<CodePointMeta<T>>` from [`../matcher`](../matcher). What is declared
 * here is what belongs to *this* backend — the metadata-carrying leaf, the
 * diagnostics a backtracking matcher can report, and its public result.
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { Ast, AstTag } from '../matcher/types.ts'
import type { TerminalRange } from '../types.ts'

/**
 * Recursive descent matcher for a single named rule, starting from `startPos` —
 * a position that counts the synthesized end-of-input symbol, unlike the public
 * `idx` of the result.
 */
export type DescentMatchRule<T> = (name: string, tag: AstTag, s: readonly CodePointMeta<T>[], startPos: number) => DescentMatchResult<T>

/**
 * Where a match ran out of road, for diagnostics.
 *
 * `idx` is the furthest position any terminal was tried at and rejected, and
 * `expected` holds the terminals that would have allowed progress there, in the
 * order the grammar tried them and without repeats.
 *
 * Unlike a failed result's own index, this never rewinds: a failing sequence
 * item rewinds the result to the sequence's start, while the furthest failure is
 * a high-water mark over the whole match — including branches the grammar
 * backtracked out of. That is what makes "expected X or Y at N" possible.
 *
 * `idx` is `0` with an empty `expected` when the match failed without ever
 * rejecting a terminal, as an empty variant does.
 *
 * `idx` is physical, so a terminal rejected at — or past — the synthesized
 * end-of-input symbol reports `input.length`. The high-water mark itself is
 * kept on the complete cursor, so those two are still ordered against each
 * other and their expected terminals do not merge.
 */
export type DescentFailure = {
    readonly idx: number
    readonly expected: readonly TerminalRange[]
}

/**
 * Result of a descent match operation.
 *
 * `failure` is present exactly when `success` is `false`: a successful match has
 * nothing to diagnose, and its `idx` already says where matching stopped. Note
 * the consequence for a match that succeeds *without consuming all input* —
 * `idx` still locates the position it stopped at, but the terminals that would
 * have let it continue are not reported.
 *
 * On failure `idx` has rewound to the start of the enclosing sequence and
 * locates nothing; read `failure.idx` instead.
 *
 * `idx` is physical — `0 <= idx <= input.length` — so a match that consumed the
 * synthesized end-of-input symbol reports `input.length`, the same as one that
 * stopped just before it.
 */
export type DescentMatchResult<T> = {
    readonly ast: Ast<CodePointMeta<T>>
    readonly success: boolean
    readonly idx: number
    readonly failure?: DescentFailure
}

/**
 * Entry-point recursive descent matcher.
 */
export type DescentMatch<T> = (name: string, s: readonly CodePointMeta<T>[]) => DescentMatchResult<T>

/**
 * Code point value paired with metadata: this backend's AST leaf.
 *
 * Preserving metadata per consumed code point is what distinguishes this
 * backend, so the leaf type stays here rather than moving to the shared layer,
 * which is parameterized by it.
 */
export type CodePointMeta<T> = readonly[CodePoint, T]
