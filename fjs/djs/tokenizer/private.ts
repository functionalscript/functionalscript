/**
 * Implementation-private types for the DJS tokenizer.
 *
 * @module
 */

import type { Meta } from '../../bnf/matcher/types.ts'
import type { TokenMetadata } from '../../js/tokenizer/types.ts'
import type { List } from '../../types/list/types.ts'
import type { CodePoint } from '../../text/utf16/types.ts'

/** A tag, the metadata of the token's first code point, and its code points. */
export type _Token = readonly [string, TokenMetadata, readonly number[]]

/** One item of a flattened match: a tag, or a code point with its metadata. */
export type _FlatToken = string | Meta<TokenMetadata, CodePoint>

/** A token being accumulated: its tag, start metadata, and code points so far. */
export type _TokenScanState = readonly [string, TokenMetadata | null, List<number>]

/** Where a string-literal decode is: plain text, after `\`, or inside `\uXXXX`. */
export type _StringDecodeState =
    | { readonly kind: 'normal' }
    | { readonly kind: 'escape' }
    | { readonly kind: 'unicode', readonly acc: number, readonly count: number }

/** Whether the previous JS token was a bare `-` awaiting a number to negate. */
export type _DjsScanState = { readonly kind: 'def' | '-' }
