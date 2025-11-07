/**
 * Bit vectors that normalise the most-significant bit using signed `bigint` values.
 *
 * A value whose top bit is already set remains positive, while other values are
 * negated after toggling the leading bit so the stop bit is always `1`. The sign bit
 * therefore acts as the stop bit that encodes the logical length of the vector.
 * @module
 */
import { abs, bitLength, mask, max, xor, type Reduce as BigintReduce } from "../bigint/module.f.ts"
import type { Binary, Reduce as OpReduce } from "../function/operator/module.f.ts"
import { asBase, asNominal, type Nominal } from "../nominal/module.f.ts"

/**
 * A vector of bits represented as a signed `bigint`.
 */
export type Vec = Nominal<
    'bit_vec',
    '1a23a4336197e6158b6936cad34e90d146cd84b9b40ff7ab75a17c6d79e31d89',
    bigint>

/**
 * Calculates the length of the given vector of bits.
 */
export const length = (v: Vec): bigint => bitLength(asBase(v))

/**
 * An empty vector of bits.
 */
export const empty: Vec = asNominal(0n)

const lazyEmpty = () => empty

/**
 * Returns the unsigned integer representation of the vector by clearing the stop bit.
 */
export const uint = (v: Vec): bigint => {
    const b = asBase(v)
    if (b >= 0n) { return b }
    const u = -b
    const len = bitLength(u)
    return u ^ (1n << (len - 1n))
}

/**
 * Creates a vector of bits of the given `len` and the provided unsigned integer.
 */
export const vec = (len: bigint): (ui: bigint) => Vec => {
    if (len <= 0n) { return lazyEmpty }
    const m = mask(len)
    const last = len - 1n
    const lastBit = 1n << last
    return ui => {
        // normalize `u`
        const u = m & abs(ui)
        //
        const sign = u >> last
        const x = sign !== 0n ? u : -(u ^ lastBit)
        return asNominal(x)
    }
}

/**
 * Structure describing the unpacked view of a vector.
 */
export type Unpacked = {
    readonly length: bigint
    readonly uint: bigint
}

/**
 * Extracts the logical length and unsigned integer from the vector.
 */
export const unpack = (v: Vec): Unpacked => ({
    length: length(v),
    uint: uint(v),
})

/**
 * Creates an 8-bit vector from an unsigned integer.
 */
export const vec8: (ui: bigint) => Vec = vec(8n)

/**
 * Packs an unpacked representation back into a vector.
 */
export const pack = ({ length, uint }: Unpacked): Vec => vec(length)(uint)

/**
 * Concatenates two vectors in most-significant-bit (MSb) order.
 */
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

type NormOp = Binary<Unpacked, Unpacked, Norm>

const lsbNorm: NormOp = ({ length: al, uint: a }) => ({ length: bl, uint: b }) =>
    ({ len: max(al)(bl), a, b })

const msbNorm: NormOp = ({ length: al, uint: a }) => ({ length: bl, uint: b }) => {
    const len = max(al)(bl)
    return { len, a: a << (len - al), b: b << (len - bl) }
}

/**
 * Normalizes two vectors to the same length before applying a bigint reducer.
 */
const op = (norm: NormOp) => (op: BigintReduce): Reduce => ap => bp => {
    const { len, a, b } = norm(unpack(ap))(unpack(bp))
    return vec(len)(op(a)(b))
}

export type Reduce = OpReduce<Vec>

/**
 * Performs a least-significant-bit (LSb) xor operation between two vectors.
 */
export const lsbXor: Reduce = op(lsbNorm)(xor)

/**
 * Performs a most-significant-bit (MSb) xor operation between two vectors.
 */
export const msbXor: Reduce = op(msbNorm)(xor)

/**
 * Represents operations for handling bit vectors with a specific bit order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering
 */
export type BitOrder = {
    readonly front: (len: bigint) => (v: Vec) => bigint
    readonly removeFront: (len: bigint) => (v: Vec) => Vec
    readonly popFront: (len: bigint) => (v: Vec) => readonly [bigint, Vec]
}

export const lsb: BitOrder = {
    front: len => {
        const m = mask(len)
        return v => uint(v) & m
    },
    removeFront: len => {
        return v => {
            const { length, uint } = unpack(v)
            return vec(length - len)(uint >> len)
        }
    },
    popFront: len => {
        const m = mask(len)
        return v =>  {
            const { length, uint } = unpack(v)
            return [uint & m, vec(length - len)(uint >> len)]
        }
    },
}

export const msb: BitOrder = {
    front: len => {
        const m = mask(len)
        return v => {
            const { length, uint } = unpack(v)
            return (uint >> (length - len)) & m
        }
    },
    removeFront: len => v => {
        const { length, uint } = unpack(v)
        return vec(length - len)(uint)
    },
    popFront: len => {
        const m = mask(len)
        return v => {
            const { length, uint } = unpack(v)
            const d = length - len
            return [(uint >> d) & m, vec(d)(uint)]
        }
    },
}
