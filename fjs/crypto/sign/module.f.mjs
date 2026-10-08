/**
 * ECDSA signing and verification built on secp and SHA-2 primitives. See `./types.ts`
 * for the `Rfc6979` and `Signer` types.
 *
 * @module
 *
 * @import { FixedArray } from '../../types/array/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Curve, Point } from '../secp/types.ts'
 * @import { Sha2 } from '../sha2/types.ts'
 * @import { Rfc6979, Signer, _Signature } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { bitLength } from '../../types/bigint/module.f.mjs'
import { empty, length, msb, repeat, unpack, vec8, wholeBytes } from '../../types/bit_vec/module.f.mjs'
import { hmac } from '../hmac/module.f.mjs'
import { computeSync } from '../sha2/module.f.mjs'

/**
 * Builds RFC6979 helper conversions for a subgroup order.
 *
 * @param {bigint} q - Subgroup order.
 * @returns {Rfc6979} Conversion helpers used by deterministic nonce generation.
 */
export const all = q => {
    const qlen = bitLength(q)
    /** @type {(b: Vec) => bigint} */
    const bits2int = b => {
        const { length, uint } = unpack(b)
        const diff = length - qlen
        return diff > 0n ? uint >> diff : uint
    }
    // RFC 6979's extra modular reduction. Since `bits2int(b) < 2*q`, it is no
    // more than a conditional subtraction: `z1 < q ? z1 : z1 - q`.
    /** @type {(b: Vec) => bigint} */
    const bits2intModQ = b => bits2int(b) % q
    const int2octets = wholeBytes(qlen)
    return {
        q,
        qlen,
        bits2int,
        bits2intModQ,
        int2octets,
        bits2octets: b => int2octets(bits2intModQ(b)),
    }
}

/**
 * Builds the signing context of a curve: the RFC6979 conversions for its
 * subgroup order, and the curve parts `sign` uses.
 *
 * @type {(c: Curve) => Signer}
 */
export const fromCurve = ({ nf, mul, g }) => ({ rfc6979: all(nf.p), nf, mul, g })

const x01 = vec8(0x01n)
const x00 = vec8(0x00n)

const { concat, listToVec } = msb

/**
 * RFC6979 §3.2 from step b on: the nonce `k` for the digest `h1 = H(m)`.
 * Step a, hashing the message, is the caller's, so that `sign` can hash
 * once and derive both `h` and the nonce from one digest. Private, because
 * `h1` must be a digest of `hf`, which no check on a `Vec` can establish:
 * its only callers are `computeK` and `sign`, and both make `h1` with `hf`.
 *
 * @type {(_: Rfc6979) => (_: Sha2) => (x: bigint) => (h1: Vec) => bigint}
 */
const computeKFromDigest =
    ({ q, bits2int, qlen, int2octets, bits2octets }) => hf => {
        // TODO: Look at https://www.rfc-editor.org/rfc/rfc6979#section-3.3 to reformulate
        //       it using `HMAC_DRBG`.
        const hmacf = hmac(hf)
        // b. Set:
        //      V = 0x01 0x01 0x01 ... 0x01
        //    such that the length of V, in bits, is equal to 8*ceil(hlen/8).
        //    For instance, on an octet-based system, if H is SHA-256, then V
        //    is set to a sequence of 32 octets of value 1.  Note that in this
        //    step and all subsequent steps, we use the same H function as the
        //    one used in step 'a' to process the input message; this choice
        //    will be discussed in more detail in Section 3.6.
        const rep = repeat(hf.hashBytes)
        const v0 = rep(x01)
        // c. Set:
        //      K = 0x00 0x00 0x00 ... 0x00
        //    such that the length of K, in bits, is equal to 8*ceil(hlen/8).
        const k0 = rep(x00)
        //
        return x => h1 => {
            let v = v0
            let k = k0
            // a. Process m through the hash function H, yielding:
            //      h1 = H(m)
            //   (h1 is a sequence of hlen bits).
            //    The caller's step: `h1` is the parameter.
            // d. Set:
            //      K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1))
            //    where '||' denotes concatenation.
            const xh1 = concat(int2octets(x))(bits2octets(h1))
            k = hmacf(k)(listToVec([v, x00, xh1]))
            // e. Set:
            //      V = HMAC_K(V)
            v = hmacf(k)(v)
            // f. Set:
            //      K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
            k = hmacf(k)(listToVec([v, x01, xh1]))
            // g. Set:
            //      V = HMAC_K(V)
            v = hmacf(k)(v)
            // h. Apply the following algorithm until a proper value is for `k`:
            while (true) {
                // h. Apply the following algorithm until a proper value is for `k`:
                //    1. Set `T` to the empty sequence, so `tlen = 0`.
                let t = empty
                //    2. while `tlen < qlen` do:
                //       - `V = HMAC_K(V)`
                //       - `T = T || V`
                // Possible optimizations:
                // - precompute number of iterations
                // - `qlen` can't be 0, so we can avoid the first check and
                //   first concatenation.
                while (length(t) < qlen) {
                    v = hmacf(k)(v)
                    t = concat(t)(v)
                }
                //    3. Compute `k = bits2int(T)`. If `k` is not in `[1, q-1]` or `kG = 0` then
                //       - `K = HMAC_K(V || 0x00)`
                //       - `V = HMAC_K(V)`
                //       and loop (try to generate a new `T`, and so on). Return to step `1`.
                const result = bits2int(t)
                if (0n < result && result < q) {
                    return result
                }
                k = hmacf(k)(concat(v)(x00))
                v = hmacf(k)(v)
            }
        }
    }

/**
 * Computes deterministic ECDSA nonce `k` as described by RFC6979.
 *
 * @type {(_: Rfc6979) => (_: Sha2) => (x: bigint) => (m: Vec) => bigint}
 */
export const computeK = a => hf => {
    const f = computeKFromDigest(a)(hf)
    return x => m => f(x)(computeSync(hf)([m]))
}

/**
 * Signs a message bit vector and returns an ECDSA `(r, s)` signature pair.
 *
 * @type {(c: Curve) => (hf: Sha2) => (x: bigint) => (m: Vec) => _Signature}
 */
export const sign = c => hf => x => m => {
    // 2.4 Signature Generation
    const { rfc6979, nf: { div }, mul, g } = fromCurve(c)
    // The following steps are then applied:
    //
    // 1. H(m) is transformed into an integer modulo q using the bits2int
    //    transform and an extra modular reduction:
    //
    //       h = bits2int(H(m)) mod q
    //
    //     As was noted in the description of bits2octets, the extra modular
    //     reduction is no more than a conditional subtraction.
    const hm = computeSync(hf)([m])
    const h = rfc6979.bits2intModQ(hm)
    // 2. A random value modulo q, dubbed k, is generated.  That value
    //    shall not be 0; hence, it lies in the [1, q-1] range.  Most of
    //    the remainder of this document will revolve around the process
    //    used to generate k.  In plain DSA or ECDSA, k should be selected
    //    through a random selection that chooses a value among the q-1
    //    possible values with uniform probability.
    const k = computeKFromDigest(rfc6979)(hf)(x)(hm)
    // 3.  A value r (modulo q) is computed from k and the key parameters:
    //
    //     *  For ECDSA: the point kG is computed; its X coordinate (a
    //        member of the field over which E is defined) is converted to
    //        an integer, which is reduced modulo q, yielding r.
    //
    //     If r turns out to be zero, a new k should be selected and r
    //     computed again (this is an utterly improbable occurrence).
    // TODO: implement the loop. `computeK` should either
    // - accept a state (current `k`).
    // - accept a `is_valid` function.
    // Until then, a zero `r` or `s` is refused rather than returned.
    const rxy = assertNotNullish(mul(k)(g), 'rxy === null')
    const r = rxy[0] % rfc6979.q
    assert(r !== 0n, 'r === 0')
    // 4.  The value s (modulo q) is computed:
    //
    //        s = (h+x*r)/k mod q
    //
    //     The pair (r, s) is the signature.  How a signature is to be
    //     encoded is not covered by the DSA and ECDSA standards themselves;
    //     a common way is to use a DER-encoded ASN.1 structure (a SEQUENCE
    //     of two INTEGERs, for r and s, in that order).
    const s = div(h + x*r)(k)
    assert(s !== 0n, 's === 0')
    return [r, s]
}

/**
 * Verifies an ECDSA `(r, s)` signature of a message bit vector against the
 * public key `u = xG`, as the inverse of `sign`.
 *
 * @type {(c: Curve) => (hf: Sha2) => (u: Point) => (m: Vec) => (sig: _Signature) => boolean}
 */
export const verify = c => hf => u => m => ([r, s]) => {
    const { rfc6979: { q, bits2intModQ }, nf: { mul: mulQ, reciprocal }, mul, g } = fromCurve(c)
    const { add } = c
    // `r` and `s` are nonzero residues modulo `q`; anything else is refused.
    // So is the point at infinity as `u`: `(r/s)u` would vanish, and
    // `r = x((h/s)G)` would pass for any message without a private key.
    /** @type {(v: bigint) => boolean} */
    const inRange = v => 0n < v && v < q
    if (u === null || !inRange(r) || !inRange(s)) {
        return false
    }
    // The same `h` as `sign` step 1.
    const h = bits2intModQ(computeSync(hf)([m]))
    // `s = (h + x*r)/k`, so `(h/s)G + (r/s)U = ((h + x*r)/s)G = kG`.
    const w = reciprocal(s)
    const xy = add(mul(mulQ(h)(w))(g))(mul(mulQ(r)(w))(u))
    // The point at infinity has no X coordinate to compare.
    return xy !== null && xy[0] % q === r
}
