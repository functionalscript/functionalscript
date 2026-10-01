/**
 * Types for the shared bit-codec factory.
 *
 * @module
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { Nullable } from '../types/nullable/types.ts'

/**
 * The encode/decode pair returned by `baseN` in `./module.f.mjs`.
 */
export type BaseN = {
    readonly vecToString: (v: Vec) => string
    readonly stringToVec: (s: string) => Nullable<Vec>
}

/**
 * One encoding of a text, as the demo (`./demo.f.mjs`) draws it: the groups
 * its bits are cut into, each with any fill bits after a `·`, and the codec's
 * own output, one character per group plus any `=` padding. Here rather than
 * in `private.ts` because the demo's exported `encodings` returns it, so it is
 * part of the shipped declarations.
 */
export type _Encoding = {
    readonly groups: readonly string[]
    readonly encoded: string
}

/** What the demo shows for a text: its UTF-8 bytes in binary, and both encodings. */
export type _Encodings = {
    readonly bytes: readonly string[]
    readonly base64: _Encoding
    readonly cBase32: _Encoding
}
