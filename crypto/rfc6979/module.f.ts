import { unpack, vec, type Vec } from "../../types/bit_vec/module.f.ts"

export const clearBits = (b: bigint) => (v: bigint) => v >> b << b

export const roundUpBits = (b: bigint): (v: bigint) => bigint => {
    const mask = (1n << b) - 1n
    const cb = clearBits(b)
    return (v: bigint) => cb(v + mask)
}

export const bits2int: (qlen: bigint) => (b: Vec) => bigint = qlen => b => {
    const { length, uint } = unpack(b)
    const diff = length - qlen
    return diff > 0n ? uint >> diff : uint
}

export const int2octets: (qlen: bigint) => (x: bigint) => Vec = qlen => x => {
    const rlen = roundUpBits(3n)(qlen)
    return vec(rlen)(x << (rlen - qlen))
}
