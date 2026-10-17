/**
 * Types for the zlib inflater: the state of a stream being read, and what one
 * chunk of input gives.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'

/**
 * Where a stream is: the two header bytes, the three bits that open a block,
 * a stored block's `LEN` and `NLEN`, its bytes, the checksum that closes the
 * stream, or past it.
 */
export type Phase = 'header' | 'block' | 'lengths' | 'stored' | 'trailer' | 'done'

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
}

/** What one chunk of input gave: the next state, and the output it made. */
export type Output = {
    readonly state: State
    /** Whole-byte chunks, in order. */
    readonly output: readonly Vec[]
}
