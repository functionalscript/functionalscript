import { todo } from '../../dev/module.f.ts'
import { bitLength, roundUpBits, type Unary } from '../../types/bigint/module.f.ts'
import { empty, length, listToVec, msb, repeat, unpack, vec, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { hmac } from '../hmac/module.f.ts'
import type { Curve } from '../secp/module.f.ts'
import { computeSync, type Sha2 } from '../sha2/module.f.ts'

// qlen to rlen
const roundUp8: Unary = roundUpBits(3n)

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

const v0 = vec8(0x01n)
const k0 = vec8(0x00n)

const concat = listToVec(msb)

export const k = ({ bits2int, qlen, int2octets, bits2octets }: All) => (hf: Sha2) => (x: bigint) => (m: Vec) =>{
    const hmacf = hmac(hf)
    const h1 = computeSync(hf)([m])
    const rhlen = roundUp8(hf.hashLength) // in bits
    const hlenBytes = rhlen >> 3n
    const rep = repeat(hlenBytes)
    let v = rep(v0)
    let k = rep(k0)
    k = hmacf(k)(concat([v, k0, int2octets(x), bits2octets(h1)]))
    v = hmacf(k)(v)
    // h. Apply the following algorithm until a proper value is for `k`:
    //    1. Set `T` to the empty sequence, so `tlen = 0`.
    //    2. while `tlen < qlen` do:
    //       - `V = HMAC_K(V)`
    //       - `T = T || V`
    let t = empty
    while (length(t) < qlen) {
        v = hmacf(k)(v)
        t = concat([t, v])
    }
    // TODO:
    //    3. Compute `k = bits2int(T)`. If `k` is not in `[1, q-1]` or `kG = 0` then
    //       - `K = HMAC_K(V || 0x00)`
    //       - `V = HMAC_K(V)`
    //       and loop (try to generate a new `T`, and so on). Return to step `1`.
    const result = bits2int(t)
    return result
}

export const sign = (a: All) => (hf: Sha2) => (x: bigint) => (m: Vec): bigint => {
    const hm = computeSync(hf)([m])
    const h = a.bits2int(hm) % a.q
    ///
    return todo()
}
