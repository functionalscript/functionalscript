/**
 * The hand-written JavaScript tokenizer's state types. The tokens it
 * produces are the grammar's, in `fjs/ebnf/lib/js/types.ts`.
 *
 * @module
 */

import type { RangeMapArray } from '../../types/range_map/types.ts'
import type { List } from '../../types/list/types.ts'
import type { JsToken, TokenMetadata } from '../../ebnf/lib/js/types.ts'

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
