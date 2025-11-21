import { bitLength, type Reduce, type Unary } from "../../types/bigint/module.f.ts"
import { unpack, vec, type Vec } from "../../types/bit_vec/module.f.ts"

export const clearBits: Reduce = b => v => v >> b << b

export const roundUpBits: Reduce = b => {
    const mask = (1n << b) - 1n
    const cb = clearBits(b)
    return v => cb(v + mask)
}

// qlen to rlen
export const roundUp8: Unary = roundUpBits(3n)

export const bits2int: (qlen: bigint) => (b: Vec) => bigint = qlen => b => {
    const { length, uint } = unpack(b)
    const diff = length - qlen
    return diff > 0n ? uint >> diff : uint
}

export const int2octets: (qlen: bigint) => (x: bigint) => Vec = qlen => vec(roundUp8(qlen))

export const bits2octets: (q: bigint) => (b: Vec) => Vec = q => {
    const qlen = bitLength(q)
    const b2i = bits2int(qlen)
    const i2o = int2octets(roundUp8(qlen))
    return b => {
        const z1 = b2i(b)
        const z2 = z1 % q // since z2 < 2*q, we can use simple mod with `z1 < q ? z1 : z1 - q`
        return i2o(z2)
    }
}
