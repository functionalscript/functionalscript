/**
 * Base64url without padding (RFC 4648 §5): the URL- and filename-safe
 * alphabet, `-` and `_` where Base64 has `+` and `/`, and no `=`. OAuth's
 * PKCE verifier and challenge are spelled in it.
 *
 * Encode only: nothing in the repository reads it back. A decoder would need
 * the trimming rule [`../base64`](../base64/module.f.mjs)'s `decode` applies
 * over `baseN` — the byte length the symbol count implies and the padding
 * bits checked zero — and should share it rather than copy it.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { isWholeBytes } from '../../types/bit_vec/module.f.mjs'
import { baseN } from '../module.f.mjs'

const { vecToString } = baseN(6n, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_')

/**
 * The bytes of `input` in Base64url, unpadded, or `null` for an input that
 * is not whole bytes, which the encoding has no spelling for.
 *
 * @type {(input: Vec) => Nullable<string>}
 */
export const encode = input => isWholeBytes(input) ? vecToString(input) : null
