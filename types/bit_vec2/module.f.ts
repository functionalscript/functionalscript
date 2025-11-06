import { bitLength, mask, max, xor, type Reduce as BigintReduce } from "../bigint/module.f.ts"
import type { Binary, Reduce as OpReduce } from "../function/operator/module.f.ts"
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

export type Unpacked = {
    readonly length: bigint
    readonly uint: bigint
}

export const unpack = (v: Vec): Unpacked => ({
    length: length(v),
    uint: uint(v),
})

export const vec = (len: bigint): (ui: bigint) => Vec => {
    const m = mask(len)
    return ui => {
        const u = m & ui
        const sign = u >> (len - 1n)
        const x = sign !== 0n ? u : -(m ^ u)
        return asNominal(x)
    }
}

export const vec8: (ui: bigint) => Vec = vec(8n)

export const pack = ({ length, uint }: Unpacked): Vec => vec(length)(uint)

export const msbConcat = (a: Vec) => (b: Vec): Vec => {
    const { length: al, uint: au } = unpack(a)
    const { length: bl, uint: bu } = unpack(b)
    return vec(al + bl)((au << bl) | bu)
}

type Norm = {
    readonly len: bigint
    readonly a: bigint
    readonly b: bigint
}

type NormOp = Binary<Vec, Vec, Norm>

const lsbNorm: NormOp = ap => bp => {
    const { length: al, uint: a } = unpack(ap)
    const { length: bl, uint: b } = unpack(bp)
    return { len: max(al)(bl), a, b }
}

const msbNorm: NormOp = ap => bp => {
    const { length: al, uint: a } = unpack(ap)
    const { length: bl, uint: b } = unpack(bp)
    const len = max(al)(bl)
    return { len, a: a << (len - al), b: b << (len - bl) }
}

const op = (norm: NormOp) => (op: BigintReduce): Reduce => ap => bp => {
    const { len, a, b } = norm(ap)(bp)
    return vec(len)(op(a)(b))
}

export type Reduce = OpReduce<Vec>

export const lsbXor: Reduce = op(lsbNorm)(xor)

export const msbXor: Reduce = op(msbNorm)(xor)
