/**
 * Adler-32, the checksum that closes a zlib stream: RFC 1950 section 8.2.
 * Two sums over the bytes, each modulo 65 521, the largest prime below 2^16:
 * `a` is 1 plus the bytes, and `b` is the running sum of every `a`. The
 * checksum is `b` in the high sixteen bits and `a` in the low ones.
 *
 * In the shape of [`fjs/crypto/sha2`](../../crypto/sha2/module.f.mjs): `init`,
 * `append` over a `Vec` and `end` over a state, so a message in pieces is the
 * message whole wherever the pieces meet. The state is the checksum so far, a
 * number below 2^32, since a checksum of nothing is the state it starts from.
 *
 * It is the check the inflater makes after the last block
 * ([`todo/inflate.md`](../../../todo/inflate.md)), and a checksum, not a hash:
 * it vouches for nothing against an adversary.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { isWholeBytes, u8ListMsb, vec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/** The largest prime below 2^16. */
const modulus = 65_521

/** The weight of `b` in the checksum. */
const shift = 0x1_0000

/** The checksum of no bytes: `a` is 1 and `b` is 0. */
export const init = 1

/**
 * The checksum of the bytes so far, and then `bytes`. Both sums are added up
 * whole and reduced once, which a number holds exactly for the 2^23 bytes it
 * takes them to pass 2^53; a caller with more reads them in pieces.
 *
 * @throws On more than 2^23 bytes.
 *
 * @type {(bytes: readonly number[]) => (state: number) => number}
 */
export const appendBytes = bytes => state => {
    assert(bytes.length <= 0x80_0000, 'Adler-32 of at most 2^23 bytes at a time')
    let a = state % shift
    let b = Math.floor(state / shift)
    for (const byte of bytes) {
        a += byte
        b += a
    }
    return b % modulus * shift + a % modulus
}

/**
 * The checksum of the bytes so far, and then those of `v`.
 *
 * @throws On a `v` that is not whole bytes.
 *
 * @type {Fold<Vec, number>}
 */
export const append = v => {
    assert(isWholeBytes(v), 'Adler-32 is over bytes')
    return appendBytes(toArray(u8ListMsb(v)))
}

/**
 * The checksum as it closes a zlib stream: thirty-two bits, the most
 * significant byte first.
 *
 * @type {(state: number) => Vec}
 */
export const end = state => vec(32n)(BigInt(state))
