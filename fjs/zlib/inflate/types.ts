/**
 * Types for the zlib inflater: the state of a stream being read, and what one
 * chunk of input gives.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Codes } from '../huffman/types.ts'
import type { Window } from '../window/types.ts'

/**
 * Where a stream is: the two header bytes, the three bits that open a block,
 * a stored block's `LEN` and `NLEN` and its bytes, a dynamic block's table
 * description and the symbols of a block of codes, the checksum that closes
 * the stream, or past it.
 */
export type Phase = 'header' | 'block' | 'lengths' | 'stored' | 'dynamic' | 'codes' | 'trailer' | 'done'

/**
 * A zlib stream being read. It is data and nothing else, so a state can be kept,
 * fed again and compared.
 */
export type State = {
    readonly phase: Phase
    /** The bytes given and not yet used, the first partly used. */
    readonly input: readonly number[]
    /** How many bits of `input[0]` are used, 0 to 7: DEFLATE reads each byte from its least significant bit. */
    readonly bit: number
    /** Whether the block being read is the last one. */
    readonly last: boolean
    /** The bytes of the stored block still to come. */
    readonly left: number
    /** The Adler-32 of the output so far. */
    readonly adler: number
    /** The last 32 KiB of the output, which a back-reference reads. */
    readonly window: Window
    /** The codes of the block of codes being read, in the phase `codes`. */
    readonly codes: Nullable<Codes>
}

/** What one chunk of input gave: the next state, and the output it made. */
export type Output = {
    readonly state: State
    /** Whole-byte chunks, in order. */
    readonly output: readonly Vec[]
}
