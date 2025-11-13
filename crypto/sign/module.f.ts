import { bitLength } from '../../types/bigint/module.f.ts'
import { listToVec, msb, uint, vec, vec8, length, type Vec } from '../../types/bit_vec/module.f.ts'
import { hmac } from '../hmac/module.f.ts'
import { curve, type Init } from '../secp/module.f.ts'
import type { Sha2 } from '../sha2/module.f.ts'

const concat = listToVec(msb)

const v00 = vec8(0x00n)
const v01 = vec8(0x01n)

/**
 * The size of the result equals the size of the hash.
 *
 * @param sha2 SHA2 hash function
 * @returns A function that accepts a private key, a message hash and returns `k`.
 */
const createK = (sha2: Sha2) => {
    const h = hmac(sha2)
    let vs = vec(sha2.hashLength)
    let k0 = vs(0x00n)
    let v0 = vs(0x01n)
    return (privateKey: Vec) => (messageHash: Vec): bigint => {
        const pm = concat([privateKey, messageHash])
        let k = k0
        let v = v0
        k = h(k)(concat([v, v00, pm]))
        v = h(k)(v)
        k = h(k)(concat([v, v01, pm]))
        v = h(k)(v)
        return uint(h(k)(v))
    }
}

export const newPrivateKey = (i: Init) => (random: Vec): bigint => {
    const { nf } = curve(i)
    if (bitLength(nf.max) < length(random)) {
        throw "need more random bits"
    }
    return uint(random) % nf.p
}

export const sign = (sha2: Sha2) => (curveInit: Init) => (privateKey: Vec) => (messageHash: Vec): readonly[bigint, bigint] => {
    const { mul, pf } = curve(curveInit)
    // const curveVec = vec(length(pf.max))

    //`k` is a unique for each `z` and secret.
    const k = createK(sha2)(privateKey)(messageHash) % pf.p

    // `R = G * k`.
    const rp = mul(k)(curveInit.g)

    // `r = R.x`
    const r = rp === null ? 0n : rp[0]

    // `s = ((z + r * d) / k)`.
    const d = uint(privateKey)
    const z = uint(messageHash)

    const rd = pf.mul(r)(d)
    const zrd = pf.add(z)(rd)
    const kn1 = pf.reciprocal(k)
    const s = pf.mul(zrd)(kn1)

    return [r, s]
}
