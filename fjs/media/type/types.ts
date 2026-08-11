/**
 * Types for magic-byte MIME type detection.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Utf8State } from '../../text/utf8/types.ts'

/**
 * A magic-byte signature as a byte pattern. `null` entries are wildcards (the
 * four little-endian size bytes of WebP, between its `RIFF` and `WEBP` markers).
 *
 * @internal
 */
export type _Signature = {
    readonly pattern: readonly Nullable<number>[]
    readonly mime: string
}

/**
 * `A_magic`: signature elimination. `scan` holds the byte offset and the still-viable
 * signatures; a fully matched signature absorbs into `matched`, an empty viable set
 * into `dead`. Settles within 12 bytes — `matched`/`dead` are absorbing.
 *
 * @internal
 */
export type _MagicState =
    | { readonly tag: 'scan', readonly pos: number, readonly viable: readonly _Signature[] }
    | { readonly tag: 'matched', readonly mime: string }
    | { readonly tag: 'dead' }

/**
 * `A_utf8`: a streaming UTF-8 validity-and-text check riding the shared
 * `utf8ByteToCodePointOp` decoder. `st` is the decoder's mid-sequence state;
 * `valid` is `false` once an illegal byte, surrogate, or out-of-range code point
 * is seen — `valid: false` is absorbing. A non-null `st` at EOF (a truncated
 * multi-byte sequence) is invalid. `text` is the orthogonal text-ness verdict: it
 * is `false` once a non-text (control) code point is decoded, even though that
 * code point is perfectly well-formed UTF-8 — `text: false` is absorbing too.
 * Keeping the two distinct lets a valid-but-control blob (e.g. NUL) decode
 * cleanly yet still classify as binary.
 *
 * @internal
 */
export type _Utf8Detect = {
    readonly st: Utf8State
    readonly valid: boolean
    readonly text: boolean
}

/**
 * The product state: running bit length × magic eliminator × UTF-8 validator.
 * The factors never read each other; they meet only in `finish`.
 */
export type DetectState = {
    readonly length: bigint
    readonly magic: _MagicState
    readonly utf8: _Utf8Detect
}

/** The metadata read off the detector at end-of-stream. */
export type DetectMeta = {
    readonly length: bigint
    readonly mime_type: string
    readonly type: 'text' | 'base64'
}
