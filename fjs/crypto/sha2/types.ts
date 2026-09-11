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
 * The state of a hash built on the Merkle–Damgård framing every SHA
 * shares: `hash` is the current hash value, `len` the length of the data
 * processed so far, and `remainder` the data that has not yet filled a
 * block. `H` is the hash value's own shape: eight words for SHA-2, five
 * for SHA-1.
 */
export type Framed<H> = {
    readonly hash: H
    readonly len: bigint
    readonly remainder: Vec
}

/**
 * State of the SHA-2 algorithm: {@link Framed} over its eight words.
 */
export type State = Framed<V8>

/**
 * What a hash gives {@link Framing} to be framed: its block length, the
 * width of the message length that closes the last block, the width of
 * the digest its hash value spells, the compression of one block into
 * the hash value, and the hash value as that digest.
 */
export type FramingInit<H> = {
    readonly chunkLength: bigint
    readonly lengthLength: bigint
    readonly digestLength: bigint
    readonly compress: (hash: H) => (block: bigint) => H
    readonly digest: (hash: H) => bigint
}

/**
 * The framing, built: `append` folds data into the state a block at a
 * time, and `end` pads the last block and closes it with the length,
 * answering `hashLength` bits of the digest, the high ones.
 */
export type Framing<H> = {
    readonly append: Fold<Vec, Framed<H>>
    readonly end: (hashLength: bigint) => (state: Framed<H>) => Vec
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
export type Sha2 = Hash<State>

/**
 * A hash over a state of its own, answering `R` at its end: what every
 * SHA-2 variant is, over its state and a `Vec`, and what
 * [`fjs/crypto/sha1`](../sha1/types.ts) is over a state of five words. `R`
 * is a `Vec` unless a hash has more to say than the digest — a detector
 * that answers the digest or a refusal answers a `Result` — and
 * `computeSync` takes any, answering its `R`; a consumer that only sizes
 * buffers and folds blocks, as `hmac` does, can too.
 */
export type Hash<S, R = Vec> = {
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
    readonly init: S
    readonly append: Fold<Vec, S>
    readonly end: (state: S) => R
}
