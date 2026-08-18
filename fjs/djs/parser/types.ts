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

/** DJS tokens that carry a directly-usable value. */
export type _ValueToken = Extract<DjsToken, {
    readonly kind: 'null' | 'false' | 'true' | 'undefined' | 'string' | 'number' | 'bigint'
}>
