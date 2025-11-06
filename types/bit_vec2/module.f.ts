import { bitLength, mask, max } from "../bigint/module.f.ts"
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

export type Unpacked = readonly[bigint, bigint]

export const unpack = (v: Vec): Unpacked => [length(v), uint(v)]

export const vec = (len: bigint) => (ui: bigint): Vec => {
    const m = mask(len)
    const u = m & ui
    const sign = u >> (len - 1n)
    const x = sign !== 0n ? u : -(m ^ u)
    return asNominal(x)
}

export const vec8 = vec(8n)

export const pack = ([len, u]: Unpacked): Vec => vec(len)(u)

export const msbConcat = (a: Vec) => (b: Vec): Vec => {
    const [al, au] = unpack(a)
    const [bl, bu] = unpack(b)
    return vec(al + bl)((au << bl) | bu)
}

export const lsbXor = (a: Vec) => (b: Vec): Vec => {
    const [al, au] = unpack(a)
    const [bl, bu] = unpack(b)
    return vec(max(al)(bl))(au ^ bu)
}

export const msbXor = (a: Vec) => (b: Vec): Vec => {
    const [al, au] = unpack(a)
    const [bl, bu] = unpack(b)
    const len = max(al)(bl)
    const a2 = au << (len - al)
    const b2 = bu << (len - bl)
    return vec(len)(a2 ^ b2)
}
