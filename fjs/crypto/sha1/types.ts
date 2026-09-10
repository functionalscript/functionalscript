/**
 * Types for SHA-1: the five-word state, and the hash in the shape
 * [`fjs/crypto/sha2`](../sha2/types.ts) gives every hash here.
 *
 * @module
 */

import type { FixedArray } from '../../types/array/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Hash } from '../sha2/types.ts'

/** The five 32-bit words of a SHA-1 state, `H0` to `H4`. */
export type V5 = FixedArray<5, bigint>

/**
 * State of the SHA-1 algorithm: `hash` is the current hash value, `len` the
 * length of the data processed so far, and `remainder` the data that has not
 * yet been processed — the same three fields as SHA-2's, over five words
 * rather than eight.
 */
export type State = {
    readonly hash: V5
    readonly len: bigint
    readonly remainder: Vec
}

/**
 * SHA-1 in the shape of a SHA-2 variant, so that what takes a `Hash<S>` —
 * `computeSync` in `fjs/crypto/sha2` — takes it unchanged.
 */
export type Sha1 = Hash<State>
