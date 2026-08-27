/**
 * Implementation-private types for `fjs/djs/tokenizer/module.f.mjs`.
 *
 * Nothing here belongs to the public declaration closure: no exported
 * declaration of the module names any of these types, so keeping them out of
 * `./types.ts` keeps them out of the shipped declarations too. They are
 * exported only so the implementation can `@import` them — the leading `_` is
 * what marks them private, and renaming or removing one is not a breaking
 * change.
 */

import type { CodePointMeta } from '../../bnf/descent/types.ts'
import type { TokenMetadata } from '../../js/tokenizer/types.ts'
import type { List } from '../../types/list/types.ts'

/**
 * A token as `scanFunc` emits it: its tag, the metadata of its first code
 * point, and its code points.
 */
export type _Token = [string, TokenMetadata, readonly number[]]

/** Either a bare grammar tag or one code point paired with its metadata. */
export type _FlatToken = string | CodePointMeta<TokenMetadata>

/** The token `scanFunc` is still accumulating: `null` metadata until its first code point arrives. */
export type _TokenScanState = [string, TokenMetadata | null, List<number>]

/** Where `stringDecodeScan` is inside a string literal's escape sequences. */
export type _StringDecodeState =
    | { readonly kind: 'normal' }
    | { readonly kind: 'escape' }
    | { readonly kind: 'unicode', readonly acc: number, readonly count: number }

/** Whether `scanDjsToken` has an unconsumed `-` to fold into the next number. */
export type _DjsScanState = { readonly kind: 'def' | '-' }
