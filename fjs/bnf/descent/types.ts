/**
 * Types for the recursive descent matcher backend.
 *
 * @module
 */

import type { CodePoint } from '../../text/utf16/types.ts'
import type { TerminalRange } from '../types.ts'

export type AstTag = string|true|undefined

/**
 * Recursive descent matcher for a single named rule.
 */
export type DescentMatchRule<T> = (name: string, tag: AstTag, s: readonly CodePointMeta<T>[], idx: number) => DescentMatchResult<T>

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
 * The same type describes a match in progress, where `failure` is likewise
 * absent until the match ends.
 */
export type DescentMatchResult<T> = {
    readonly ast: AstRuleMeta<T>
    readonly success: boolean
    readonly idx: number
    readonly failure?: DescentFailure
}

/**
 * Entry-point recursive descent matcher.
 */
export type DescentMatch<T> = (name: string, s: readonly CodePointMeta<T>[]) => DescentMatchResult<T>

/**
 * Code point value paired with metadata.
 */
export type CodePointMeta<T> = readonly[CodePoint, T]

/**
 * AST sequence for the metadata-aware parser.
 */
export type AstSequenceMeta<T> = readonly(AstRuleMeta<T>|CodePointMeta<T>)[]

/**
 * Metadata-aware AST node.
 */
export type AstRuleMeta<T> = {
    readonly tag: AstTag,
    readonly sequence: AstSequenceMeta<T>
}
