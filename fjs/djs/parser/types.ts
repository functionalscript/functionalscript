/**
 * Type-level API for `fjs/djs/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports.
 *
 * @module
 */

import type { TokenMetadata } from '../../js/tokenizer/types.ts'

export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
}
