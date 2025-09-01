import { length, listToVec, msb, uint, vec, vec8, type Vec } from "../../types/bit_vec/module.f.ts"
import { hmac } from "../hmac/module.f.ts"
import type { Sha2 } from "../sha2/module.f.ts"

const concat = listToVec(msb)

const v00 = vec8(0x00n)
const v01 = vec8(0x01n)

/**
 * Note: we assume that `privateKey` is always less than `q`.
 *
 * @param qlen The bit length of `q`.
 * @returns A bit vector of length `(qlen + 7) & ~7`.
 */
const int2octets = (qlen: bigint) => vec((qlen + 7n) & ~7n)

/**
 * The bits2int transform takes as input a sequence of blen bits and
   outputs a non-negative integer that is less than 2^qlen.

 * @param qlen
 * @returns
 */
const bits2int = (qlen: bigint) => (v: Vec): bigint => {
    const vlen = length(v)
    if (vlen > qlen) {
        v = msb.front(qlen)(v)
    }
    return uint(v)
}

const bits2octets = (q: bigint) => (v: Vec): Vec => {
    const qlen = length(q) + 1n
    const z1 = bits2int(qlen)(v)
    const z2 = z1 >= q ? z1 - q : z1
    return int2octets(qlen)(z2)
}

// const bitsToOctets =

/**
 * The size of the result equals the size of the hash.
 * See [RFC6979](https://www.rfc-editor.org/rfc/rfc6979).
 *
 * @param sha2 SHA2 hash function
 * @returns A function that accepts a private key, a message hash and returns `k`.
 */
export const nonce = (sha2: Sha2) => (q: bigint) => {
    const h = hmac(sha2)
    let vs = vec(sha2.hashLength)
    let k0 = vs(0x00n)
    let v0 = vs(0x01n)
    const qLen = length(q) + 1n
    const i2o = int2octets(qLen)
    return (privateKey: bigint) => (messageHash: Vec): bigint => {
        const pm = concat([i2o(privateKey), messageHash])
        let k = k0
        let v = v0
        k = h(k)(concat([v, v00, pm]))
        v = h(k)(v)
        k = h(k)(concat([v, v01, pm]))
        v = h(k)(v)
        return uint(h(k)(v))
    }
}
