/**
 * Implementation-private types for the JavaScript tokenizer: what the
 * grammar reads, where it failed, and the state of the folds over it.
 *
 * @module
 */

import type { TokenMetadata, TriviaKind } from '../../ebnf/lib/js/types.ts'

/** The kind of a token, as the grammar's `token` variant tags it, `slash`'s four resolved. */
export type _Kind = 'number' | 'string' | 'id' | 'comment' | 'operator' | 'ws' | 'newLine'

/** A token the grammar read: its kind, its code points, where it began, and whether a block comment closed. */
export type _Lexeme = {
    readonly kind: _Kind
    readonly text: readonly number[]
    readonly start: TokenMetadata
    readonly closed: boolean
}

/** A token the grammar refused: where it began, where it failed, and whether it was a number. */
export type _Failure = {
    readonly number: boolean
    readonly start: TokenMetadata
    readonly at: TokenMetadata
}

/** The whole input read: its tokens up to a failure, if any, and the position past the input. */
export type _Lexed = {
    readonly lexemes: readonly _Lexeme[]
    readonly failure: _Failure | null
    readonly final: TokenMetadata
}

/** A run of trivia not yet emitted: its kind so far, and where it is anchored. */
export type _Trivia = { readonly kind: TriviaKind, readonly metadata: TokenMetadata } | null

/** Where a string-literal decode is: plain text, after `\`, or inside `\uXXXX`. */
export type _StringDecodeState =
    | { readonly kind: 'normal' }
    | { readonly kind: 'escape' }
    | { readonly kind: 'unicode', readonly acc: number, readonly count: number }
