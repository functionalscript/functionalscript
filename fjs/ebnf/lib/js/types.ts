/**
 * Type-level API of the JavaScript token grammar: the tokens it reads, and
 * the block comment's content, which names itself and so is spelled here,
 * as `JsonValue` is in `../json/types.ts` — a named type that a `const`
 * binding may be annotated with.
 *
 * The token vocabulary is the grammar's: a word is a keyword or an
 * identifier, the keywords being `fjs/js/keywords`; an operator is one of
 * {@link operators} or the two `slash` holds; and what the fold above the
 * grammar adds — a decoded string, a `bigint` by its suffix, a run of
 * trivia as one token, a position — is spelled here too, since every
 * reader of the grammar produces the same stream.
 *
 * @module
 */

import type { Set } from '../../types.ts'
import type { keywords } from '../../../js/keywords/module.f.mjs'
import type { operators } from './module.f.mjs'

/**
 * The content of a block comment: a `*` and what follows it, any other
 * symbol and more content, or nothing — the end of input, unterminated.
 */
export type Content = () => readonly ['const', {
    readonly star: readonly ['*', AfterStar]
    readonly other: readonly [Set, Content]
    readonly unterminated: ''
}]

/**
 * What follows a `*`: the `/` that ends the comment, another `*`, a symbol
 * that is neither and more content, or nothing — unterminated.
 */
export type AfterStar = () => readonly ['const', {
    readonly end: '/'
    readonly star: readonly ['*', AfterStar]
    readonly other: readonly [Set, Content]
    readonly unterminated: ''
}]

export type StringToken = {
    readonly kind: 'string'
    readonly value: string
}

/**
 * A numeric literal, kept as the exact source lexeme.
 *
 * `value` is the canonical lossless numeric source: the tokenizer never
 * narrows it to a runtime numeric representation, so a syntactically valid
 * literal reaches its consumer whatever its magnitude — a coefficient beyond
 * the runtime's `bigint` limit and an exponent beyond `number` precision alike.
 * Each consumer applies its own numeric policy to `value`; see
 * [`fjs/media/json/number`](../../media/json/number/module.f.mjs) for the
 * bounded lexical helpers that read it without narrowing.
 */
export type NumberToken = {
    readonly kind: 'number'
    readonly value: string
}

export type BigIntToken = {
    readonly kind: 'bigint'
    readonly value: bigint
}

/**
 * A position inside one file — `TokenMetadata` without the path.
 *
 * Used as the far end of a span whose near end is a `TokenMetadata`, so the
 * path is stated once: a token does not straddle files.
 */
export type TokenPosition = {
    readonly line: number
    readonly column: number
}

/**
 * A lexical error, and how far the source it is about extends.
 *
 * The *start* is the token's own `TokenMetadata`; `end` is where the offending
 * source stops, so the two together are a span a caret-and-underline renderer
 * can draw. `'invalid token'` and `'*\/ expected'` carry one, and it runs to
 * where the input ran out: tokenizing stops at a lexical failure, so nothing
 * after the anchor was read either.
 *
 * It is **optional**, and two cases leave it absent:
 *
 * - `'invalid number'`, whose anchor is the character that *spoiled* the
 *   number rather than the number's start. The source it is about therefore
 *   ends where the anchor begins, and a forward span cannot describe it.
 * - a `JsToken` the DJS layer cannot accept, which it remaps to an error while
 *   holding no positions at all.
 *
 * So absent means "the tokenizer knows where, not how far" rather than "the
 * span is empty".
 */
export type ErrorToken = {
    readonly kind: 'error'
    readonly message: _ErrorMessage
    readonly end?: TokenPosition
}

/**
 * The two trivia kinds. A maximal run of whitespace and newlines collapses to
 * one token, and the run is `'nl'` if it contains any newline.
 */
export type TriviaKind = 'ws' | 'nl'

export type WhitespaceToken = {readonly kind: 'ws'}

export type NewLineToken = {readonly kind: 'nl'}

/** @internal */
export type _TrueToken = {readonly kind: 'true'}

/** @internal */
export type _FalseToken = {readonly kind: 'false'}

/** @internal */
export type _NullToken = {readonly kind: 'null'}

/** @internal */
export type _UndefinedToken = {readonly kind: 'undefined'}

/** @internal */
export type _KeywordKind = Exclude<typeof keywords[number], 'true' | 'false' | 'null' | 'undefined'>

/**
 * A keyword token, its kind drawn from the one source of truth for
 * JavaScript keywords, `fjs/js/keywords` — minus the literal keywords
 * (`true`/`false`/`null`/`undefined`), which have their own token types.
 * One member per kind, as {@link _OperatorToken} is, so that a `switch` on
 * `kind` narrows the token.
 *
 * @internal
 */
export type _KeywordToken = { [K in _KeywordKind]: { readonly kind: K } }[_KeywordKind]

export type IdToken = {
    readonly kind: 'id'
    readonly value: string
}

/** @internal */
export type _OperatorKind = (typeof operators)[number] | '/' | '/='

/**
 * An operator token, its kind drawn from the grammar's own list: the
 * {@link operators} the prefix tree is built from, and the two that begin
 * with `/`, which `slash` holds. One member per kind, not one member with
 * every kind, so that a `switch` on `kind` narrows the token.
 *
 * @internal
 */
export type _OperatorToken = { [K in _OperatorKind]: { readonly kind: K } }[_OperatorKind]

export type CommentToken = {
    readonly kind: '//' | '/*'
    readonly value: string
}

export type EofToken = {
    readonly kind: 'eof'
}

export type JsToken = |
    _KeywordToken |
    _TrueToken |
    _FalseToken |
    _NullToken |
    WhitespaceToken |
    NewLineToken |
    StringToken |
    NumberToken |
    ErrorToken |
    IdToken |
    BigIntToken |
    _UndefinedToken |
    _OperatorToken |
    CommentToken |
    EofToken

export type TokenMetadata = {
    readonly path: string,
    readonly line: number,
    readonly column: number,
}

export type JsTokenWithMetadata = {readonly token: JsToken,  readonly metadata: TokenMetadata}

/** @internal */
export type _ErrorMessage = |
    '" are missing' |
    'unescaped character' |
    'invalid hex value' |
    'unexpected character' |
    'invalid number' |
    'invalid token' |
    '*\/ expected' |
    'unterminated string literal' |
    'unescaped control character in string' |
    'eof'
