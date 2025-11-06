import { bitLength, mask } from "../bigint/module.f.ts"
import { asBase, asNominal, type Nominal } from "../nominal/module.f.ts"

export type Vec = Nominal<
    'bit_vec',
    '1a23a4336197e6158b6936cad34e90d146cd84b9b40ff7ab75a17c6d79e31d89',
    bigint>

export const length = (v: Vec): bigint => bitLength(asBase(v))

export const empty: Vec = asNominal(0n)

export const uint = (v: Vec): bigint => {
    const b = asBase(v)
    if (b >= 0n) { return b }
    const u = -b
    return mask(bitLength(u)) ^ u
}

export const vec = (len: bigint) => (ui: bigint): Vec => {
    const m = mask(len)
    const u = m & ui
    const sign = u >> (len - 1n)
    const x = sign !== 0n ? u : -(m ^ u)
    return asNominal(x)
}

const isNegative = (v: bigint) => v < 0

export const msbConcat = (a: Vec) => (b: Vec): Vec => {
    const bLen = length(b)
    return vec(length(a) + bLen)((uint(a) << bLen) | uint(b))
}
