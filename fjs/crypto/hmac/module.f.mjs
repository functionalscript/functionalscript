/**
 * Provides an implementation of HMAC (Hash-based Message Authentication Code).
 *
 * https://en.wikipedia.org/wiki/HMAC
 * https://www.rfc-editor.org/rfc/rfc2104
 *
 * @module
 *
 * @example
 *
 * ```ts
 * import { vec } from '../../types/bit_vec/module.f.mjs'
 * import { msbUtf8 } from '../../text/module.f.mjs'
 * import { sha256 } from '../sha2/module.f.mjs'
 *
 * const r = hmac(sha256)(msbUtf8('key'))(msbUtf8('The quick brown fox jumps over the lazy dog'))
 * if (r !== vec(256n)(0xf7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8n)) { throw r }
 * ```
 *
 * @import { Vec, Reduce } from '../../types/bit_vec/types.ts'
 * @import { Hash } from '../sha2/types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { length, msb, vec, vec8, repeat } from '../../types/bit_vec/module.f.mjs'
import { computeSync } from '../sha2/module.f.mjs'

const { concat, xor } = msb

/**
 * Outer padding.
 */
const oPad = vec8(0x5cn)

/**
 * Inner padding.
 */
const iPad = vec8(0x36n)

/**
 * Generates an HMAC (Hash-based Message Authentication Code) using the specified hash function.
 *
 * Any hash whose end answers a `Vec` will do, over a state of its own: the
 * construction reads the block length and folds the blocks, and nothing
 * else of the hash. So `hmac(sha1)` is HMAC-SHA1 and `hmac(sha256)` is
 * HMAC-SHA256, at no cost to either — which is the reason `Hash` is
 * parameterized over its state at all.
 *
 * Three things it does need of the hash, which RFC 2104 needs of one and
 * no type can say, since `Hash` spells each of them a bare `bigint`.
 *
 * Its block is a whole number of bytes, since the padding is a byte
 * repeated to the block's length and a block of nine bits holds no whole
 * number of them.
 *
 * Its digest is at least one bit. A hash whose digest is none answers the
 * same empty tag for every key and every message, which authenticates
 * nothing while looking like a tag.
 *
 * And its digest is no longer than its block, since a key longer than the
 * block is replaced by its digest and then padded *to* the block.
 *
 * The last two together say what a fourth condition would have: a digest
 * that is positive and fits the block leaves no room for a block of none
 * or of fewer than none, so the `repeat` that pads cannot be handed a
 * negative count to shift towards a zero it never reaches. Stating it
 * separately would have been a condition no proof could pin on its own.
 *
 * Every hash here is all three — the SHA-2 variants, and SHA-1 — and a hash
 * that is not is a caller's mistake rather than a message's, so it is
 * refused here, once, where the hash is given and not where each message
 * arrives.
 *
 * @throws On a hash whose block is not a whole number of bytes, or whose
 * digest is not positive, or whose digest is longer than its block.
 *
 * @template S
 * @param {Hash<S>} hashFunc - The hash function implementation to use.
 * @returns {Reduce} A function that takes a key and returns another function
 * that takes a message and computes the HMAC.
 */
export const hmac = hashFunc => {
    const { blockLength, blockBytes, hashLength } = hashFunc
    assert(blockBytes << 3n === blockLength, ['block is not whole bytes', blockLength])
    assert(0n < hashLength, ['digest is not positive', hashLength])
    assert(hashLength <= blockLength, ['digest is longer than the block', hashLength, blockLength])
    const p = repeat(blockBytes)
    const ip = p(iPad)
    const op = p(oPad)
    const c = computeSync(hashFunc)
    return k => {
        const k1 = length(k) > blockLength ? c([k]) : k
        const k2 = concat(k1)(vec(blockLength - length(k1))(0n))
        const xk2 = xor(k2)
        /** @type {(p: Vec) => (msg: Vec) => Vec} */
        const f = p => {
            const x = xk2(p)
            return msg => c([x, msg])
        }
        const fip = f(ip)
        const fop = f(op)
        return m => fop(fip(m))
    }
}
