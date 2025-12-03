import type { Array2 } from '../../types/array/module.f.ts'
import { bitLength, divUp, roundUp, type Unary } from '../../types/bigint/module.f.ts'
import { empty, length, listToVec, msb, repeat, unpack, vec, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { hmac } from '../hmac/module.f.ts'
import type { Curve } from '../secp/module.f.ts'
import { computeSync, type Sha2 } from '../sha2/module.f.ts'

// qlen to rlen
const roundUp8: Unary = roundUp(8n)

const divUp8 = divUp(8n)

export type All = {
    readonly q: bigint
    readonly qlen: bigint
    readonly bits2int: (b: Vec) => bigint
    readonly int2octets: (x: bigint) => Vec
    readonly bits2octets: (b: Vec) => Vec
}

export const all = (q: bigint): All => {
    const qlen = bitLength(q)
    const bits2int = (b: Vec) => {
        const { length, uint } = unpack(b)
        const diff = length - qlen
        return diff > 0n ? uint >> diff : uint
    }
    const int2octets = vec(roundUp8(qlen))
    return {
        q,
        qlen,
        bits2int,
        int2octets,
        // since z2 < 2*q, we can use simple mod with `z1 < q ? z1 : z1 - q`
        bits2octets: b => int2octets(bits2int(b) % q),
    }
}

export const fromCurve = (c: Curve): All => all(c.nf.p)

const x01 = vec8(0x01n)
const x00 = vec8(0x00n)

const ltov = listToVec(msb)

export const concat = (...x: readonly Vec[]): Vec => ltov(x)

export const computeK: (_: All) => (_: Sha2) => (x: bigint) => (m: Vec) => bigint
= ({ q, bits2int, qlen, int2octets, bits2octets }) => hf => {
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
    const rep = repeat(divUp8(hf.hashLength))
    const v0 = rep(x01)
    // c. Set:
    //      K = 0x00 0x00 0x00 ... 0x00
    //    such that the length of K, in bits, is equal to 8*ceil(hlen/8).
    const k0 = rep(x00)
    //
    return x => m => {
        let v = v0
        let k = k0
        // a. Process m through the hash function H, yielding:
        //      h1 = H(m)
        //   (h1 is a sequence of hlen bits).
        const h1 = computeSync(hf)([m])
        // d. Set:
        //      K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1))
        //    where '||' denotes concatenation.
        const xh1 = concat(int2octets(x), bits2octets(h1))
        k = hmacf(k)(concat(v, x00, xh1))
        // e. Set:
        //      V = HMAC_K(V)
        v = hmacf(k)(v)
        // f. Set:
        //      K = HMAC_K(V || 0x01 || int2octets(x) || bits2octets(h1))
        k = hmacf(k)(concat(v, x01, xh1))
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
                t = concat(t, v)
            }
            //    3. Compute `k = bits2int(T)`. If `k` is not in `[1, q-1]` or `kG = 0` then
            //       - `K = HMAC_K(V || 0x00)`
            //       - `V = HMAC_K(V)`
            //       and loop (try to generate a new `T`, and so on). Return to step `1`.
            const result = bits2int(t)
            if (0n < result && result < q) {
                return result
            }
            k = hmacf(k)(concat(v, x00))
            v = hmacf(k)(v)
        }
    }
}

type Signature = Array2<bigint>

export const sign = (c: Curve) => (hf: Sha2) => (x: bigint) => (m: Vec): Signature => {
    // 2.4 Signature Generation
    const { nf: { p: q, div }, g } = c
    const a = all(q)
    const { bits2int } = a
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
    const h = bits2int(hm) % q
    // 2. A random value modulo q, dubbed k, is generated.  That value
    //    shall not be 0; hence, it lies in the [1, q-1] range.  Most of
    //    the remainder of this document will revolve around the process
    //    used to generate k.  In plain DSA or ECDSA, k should be selected
    //    through a random selection that chooses a value among the q-1
    //    possible values with uniform probability.
    const k = computeK(a)(hf)(x)(m)
    // 3.  A value r (modulo q) is computed from k and the key parameters:
    //
    //     *  For ECDSA: the point kG is computed; its X coordinate (a
    //        member of the field over which E is defined) is converted to
    //        an integer, which is reduced modulo q, yielding r.
    //
    //     If r turns out to be zero, a new k should be selected and r
    //     computed again (this is an utterly improbable occurrence).
    const rxy = c.mul(k)(g)
    if (rxy === null) { throw 'rxy === null' }
    const [r] = rxy
    // 4.  The value s (modulo q) is computed:
    //
    //        s = (h+x*r)/k mod q
    //
    //     The pair (r, s) is the signature.  How a signature is to be
    //     encoded is not covered by the DSA and ECDSA standards themselves;
    //     a common way is to use a DER-encoded ASN.1 structure (a SEQUENCE
    //     of two INTEGERs, for r and s, in that order).
    const s = div(h + x*r)(k)
    return [r, s]
}
