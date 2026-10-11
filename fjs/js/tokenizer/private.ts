/**
 * Implementation-private types for the JavaScript tokenizer: what the
 * grammar reads, where it failed, and the state of the folds over it.
 *
 * @module
 */

import type { TemplateKind, TokenMetadata, TriviaKind } from '../../ebnf/lib/js/types.ts'
import type { List } from '../../types/list/types.ts'

/** The kind of a token, as the grammar's `token` variant tags it, `slash`'s four resolved. */
export type _Kind = 'number' | 'string' | 'id' | 'comment' | 'operator' | 'ws' | 'newLine' | TemplateKind

/** A token the grammar read: its kind, its code points, where it began, and whether a block comment closed. */
export type _Lexeme = {
    readonly kind: _Kind
    readonly text: readonly number[]
    readonly start: TokenMetadata
    readonly closed: boolean
}

/**
 * The position fold's state: where the next code point stands, and the code
 * point before it — `undefined` at the start of input — which decides
 * whether an LF starts a line or closes the CRLF its CR already started.
 */
export type _Cursor = readonly [TokenMetadata, number | undefined]

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

/** An active substitution, with braces nested inside it and its opening head. */
export type _TemplateContext = {
    readonly braces: number
    readonly start: TokenMetadata
}

/** The escape decoder's state inside one template chunk. */
export type _TemplateDecodeState =
    | { readonly kind: 'normal' | 'escape' | 'unicodeStart' | 'zero' }
    | { readonly kind: 'unicode' | 'hex', readonly acc: number, readonly count: number }
    | { readonly kind: 'codePoint', readonly acc: number }

/** The cooked code points and the JavaScript escape's validity. */
export type _TemplateDecode = {
    readonly state: _TemplateDecodeState
    readonly value: List<number>
    readonly valid: boolean
    readonly previous: number | undefined
}
