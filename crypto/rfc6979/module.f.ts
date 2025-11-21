import { bitLength, roundUpBits, type Unary } from "../../types/bigint/module.f.ts"
import { unpack, vec, type Vec } from "../../types/bit_vec/module.f.ts"

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
