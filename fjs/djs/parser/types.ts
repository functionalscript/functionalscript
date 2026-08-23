/**
 * Type-level API for `fjs/djs/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports, and the `_ValueToken` subset `tokenToValue`
 * accepts.
 *
 * @module
 */

import type { TokenMetadata } from '../../js/tokenizer/types.ts'
import type { DjsToken } from '../tokenizer/types.ts'

export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
}

/**
 * A token name the parser layer's grammar can name as a terminal: every
 * `DjsToken` kind except `eof`.
 *
 * `eof` is excluded because a BNF backend synthesizes its own logical
 * end-of-input; the tokenizer's physical `eof` token is split off the stream
 * before any name is mapped, so it never reaches this alphabet.
 *
 * Derived from `DjsToken` rather than listed, so a token kind added there cannot
 * silently go unrepresented at the parser layer.
 */
export type OrdinaryTokenName = Exclude<DjsToken['kind'], 'eof'>

/** DJS tokens that carry a directly-usable value. */
export type _ValueToken = Extract<DjsToken, {
    readonly kind: 'null' | 'false' | 'true' | 'undefined' | 'string' | 'number' | 'bigint'
}>
