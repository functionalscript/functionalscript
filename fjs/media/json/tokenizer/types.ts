/**
 * Types for the JSON tokenizer.
 */

import type { StringToken, NumberToken, ErrorToken, EofToken, JsTokenWithMetadata } from '../../../js/tokenizer/types.ts'

export type JsonToken = |
    {readonly kind: 'true' | 'false' | 'null' } |
    {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
    StringToken |
    NumberToken |
    ErrorToken |
    EofToken

/** @internal */
export type _ScanState = {readonly kind: 'def' | '-' }

/** @internal */
export type _ScanInput = JsTokenWithMetadata | null
