/**
 * Types for the JavaScript tokenizer.
 *
 * @module
 */

import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { List } from '../../types/list/types.ts'
import type { BigFloat } from '../../types/bigfloat/types.ts'
import type { keywords } from '../keywords/module.f.mjs'

export type StringToken = {
    readonly kind: 'string'
    readonly value: string
}

export type NumberToken = {
    readonly kind: 'number'
    readonly value: string
    readonly bf: BigFloat
}

export type BigIntToken = {
    readonly kind: 'bigint'
    readonly value: bigint
}

export type ErrorToken = {readonly kind: 'error', message: _ErrorMessage}

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

/** @internal */
export type _ParseNumberState = {
    readonly kind: 'number'
    readonly numberKind: '0' | 'int' | '.' | 'fractional' | 'e' | 'e+' | 'e-' | 'expDigits' | 'bigint'
    readonly value: string
    readonly b: _ParseNumberBuffer
}

/** @internal */
export type _ParseNumberBuffer = {
    readonly s: -1n | 1n
    readonly m: bigint
    readonly f: number
    readonly es: -1 | 1
    readonly e: number
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
