/**
 * Adler-32, the checksum that closes a zlib stream: RFC 1950 section 8.2.
 * Two sums over the bytes, each modulo 65 521, the largest prime below 2^16:
 * `a` is 1 plus the bytes, and `b` is the running sum of every `a`. The
 * checksum is `b` in the high sixteen bits and `a` in the low ones.
 *
 * {@link adler32} uses the common `init` / `update(state, input)` / `end`
 * transducer lifecycle. It consumes `Vec` chunks, emits nothing during updates,
 * and returns the checksum at completion. A message in pieces is the message
 * whole wherever the pieces meet. State is the checksum so far, a number below
 * 2^32, starting from the checksum of no bytes, `1`.
 *
 * It is the check the inflater makes after the last block
 * ([`todo/inflate.md`](../../../todo/inflate.md)), and a checksum, not a hash:
 * it vouches for nothing against an adversary.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Transducer } from '../../types/function/operator/types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { isWholeBytes, vec, u8ArrayMsb } from '../../types/bit_vec/module.f.mjs'
import { fromStateFold } from '../../types/function/operator/module.f.js'

/** The largest prime below 2^16. */
const modulus = 65_521

/** The weight of `b` in the checksum. */
const shift = 0x1_0000

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
 * The checksum machine: its state is the checksum of bytes read so far, and
 * its terminal result is thirty-two bits, the most significant byte first.
 *
 * @throws On a `v` that is not whole bytes.
 *
 * @type {Transducer<Vec, number, never, Vec>}
 */
export const adler32 = fromStateFold({
    init: 1,
    update: (state, v) => {
        assert(isWholeBytes(v), 'Adler-32 is over bytes')
        return appendBytes(u8ArrayMsb(v))(state)
    },
    end: state => vec(32n)(BigInt(state)),
})
