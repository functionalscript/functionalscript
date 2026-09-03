/**
 * Types for the SHA-2 family of hash functions.
 *
 * @module
 */

import type { FixedArray } from '../../types/array/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Fold } from '../../types/function/operator/types.ts'

/**
 * 8-word SHA-2 state vector.
 */
export type V8 = FixedArray<8, bigint>

/**
 * 16-word SHA-2 message schedule chunk.
 */
export type V16 = FixedArray<16, bigint>

/**
 * State of the SHA-2 algorithm: `hash` is the current hash value, `len` the
 * length of the data processed so far, and `remainder` the data that has not
 * yet been processed.
 */
export type State = {
    readonly hash: V8
    readonly len: bigint
    readonly remainder: Vec
}

export type Base = {
    readonly bitLength: bigint
    readonly chunkLength: bigint
    readonly compress: (i: V8) => (u: bigint) => V8
    readonly fromV8: (a: V8) => bigint
    readonly append: Fold<Vec, State>
    readonly end: (hashLength: bigint) => (state: State) => Vec
}

/**
 * SHA2. See https://en.wikipedia.org/wiki/SHA-2
 *
 * `hashLength` is a hash length, `blockLength` an internal block length,
 * `init` the initial state of the SHA-2 algorithm, `append` adds data to a
 * state and returns the new state, and `end` finalizes the hash of a state.
 *
 * @example
 *
 * ```js
 * const s = msbUtf8("The quick brown fox jumps over the lazy dog.")
 * let state = sha224.init
 * state = sha224.append(state)(s)
 * const h = sha224.end(state) // 0x1_619cba8e8e05826e9b8c519c0a5c68f4fb653e8a3d8aa04bb2c8cd4cn
 * ```
 */
export type Sha2 = {
    readonly hashLength: bigint
    readonly blockLength: bigint
    /**
     * `hashLength` and `blockLength` in whole bytes, rounded up. Consumers
     * that size a byte buffer read these instead of converting: `hmac` and
     * `sign` each used to do it themselves, with two different spellings
     * (`>> 3n` and `divUp8`), leaving a reader to work out per site whether
     * the two roundings agree. They do for every SHA-2 variant, whose lengths
     * are byte multiples — which is exactly why the decision belongs here
     * once rather than at each call site.
     */
    readonly hashBytes: bigint
    readonly blockBytes: bigint
    readonly init: State
    readonly append: Fold<Vec, State>
    readonly end: (state: State) => Vec
}
