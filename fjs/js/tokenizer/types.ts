/**
 * Types for the JavaScript tokenizer.
 *
 * @module
 */

import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { List } from '../../types/list/types.ts'
import type { keywords } from '../keywords/module.f.mjs'

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

export type ErrorToken = {readonly kind: 'error', message: _ErrorMessage}

/**
 * The two trivia kinds. A maximal run of whitespace and newlines collapses to
 * one token, and the run is `'nl'` if it contains any newline — see
 * `mergeTrivia` in `./module.f.mjs`, which owns that rule.
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

/**
 * A keyword token, its kind drawn from the one source of truth for
 * JavaScript keywords, `fjs/js/keywords` — minus the literal keywords
 * (`true`/`false`/`null`/`undefined`), which have their own token types.
 *
 * @internal
 */
export type _KeywordToken = {
    readonly kind: Exclude<typeof keywords[number], 'true' | 'false' | 'null' | 'undefined'>
}

export type IdToken = {
    readonly kind: 'id'
    readonly value: string
}

/** @internal */
export type _OperatorToken =|
    { readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
    { readonly kind: '.' | '=' } |
    { readonly kind: '(' | ')' } |
    { readonly kind: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=' } |
    { readonly kind: '+' | '-' | '*' | '/' | '%' | '++' | '--' | '**' } |
    { readonly kind: '+=' | '-=' | '*=' | '/=' | '%=' | '**='} |
    { readonly kind: '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>' } |
    { readonly kind: '&=' | '|=' | '^=' | '<<=' | '>>=' | '>>>='} |
    { readonly kind: '&&' | '||' | '!' | '??' } |
    { readonly kind: '&&=' | '||=' | '??=' } |
    { readonly kind: '?' | '?.' | '=>'}

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
export type _TokenizerStateWithMetadata = {
    readonly state: _TokenizerState,
    readonly metadata: TokenMetadata
}

/** @internal */
export type _TokenizerState = |
    _InitialState |
    _ParseIdState |
    _ParseStringState |
    _ParseEscapeCharState |
    _ParseUnicodeCharState |
    _ParseNumberState |
    _InvalidNumberState |
    _ParseOperatorState |
    _ParseWhitespaceState |
    _ParseNewLineState |
    _ParseCommentState |
    _EofState

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

/** @internal */
export type _InitialState = { readonly kind: 'initial'}

/** @internal */
export type _ParseIdState = { readonly kind: 'id', readonly value: string}

/** @internal */
export type _ParseWhitespaceState = { readonly kind: 'ws'}

/** @internal */
export type _ParseNewLineState = { readonly kind: 'nl'}

/** @internal */
export type _ParseStringState = { readonly kind: 'string', readonly value: string}

/** @internal */
export type _ParseEscapeCharState = { readonly kind: 'escapeChar', readonly value: string}

/** @internal */
export type _ParseOperatorState = { readonly kind: 'op', readonly value: string}

/** @internal */
export type _ParseCommentState = {
    readonly kind: '//' | '/*' | '/**'
    readonly value: string
    readonly newLine: boolean
}

/** @internal */
export type _ParseUnicodeCharState = {
    readonly kind: 'unicodeChar'
    readonly value: string
    readonly unicode: number
    readonly hexIndex: number
}

/**
 * Numeric scanning state. It accumulates the lexeme only: no coefficient or
 * exponent is materialized while scanning, so digit counts are bounded by the
 * input rather than by any runtime numeric limit.
 *
 * @internal
 */
export type _ParseNumberState = {
    readonly kind: 'number'
    readonly numberKind: '0' | 'int' | '.' | 'fractional' | 'e' | 'e+' | 'e-' | 'expDigits' | 'bigint'
    readonly value: string
}

/** @internal */
export type _InvalidNumberState = { readonly kind: 'invalidNumber'}

/** @internal */
export type _EofState = { readonly kind: 'eof'}

/** @internal */
export type _CharCodeOrEof = number | null

/** @internal */
export type _ToToken = (input: number) => readonly [List<JsToken>, _TokenizerState]

/** @internal */
export type _CreateToToken<T> = (state: T) => _ToToken

/** @internal */
export type _RangeFunc<T> = (def: _CreateToToken<T>) => _RangeMapToToken<T>

/** @internal */
export type _RangeMapToToken<T> = RangeMapArray<_CreateToToken<T>>
