/**
 * Bit vectors that normalize the most-significant bit using signed `bigint` values.
 *
 * A value whose top bit is already set remains positive, while other values are
 * negated after toggling the leading bit so the stop bit is always `1`. The sign bit
 * therefore acts as the stop bit that encodes the logical length of the vector.
 *
 * MSb is most-significant bit first.
 *
 * ```
 * - byte: 0x53 = 0b0101_0011
 * -                0123_4567
 * ```
 *
 * LSb is least-significant bit first.
 *
 * ```
 * - byte: 0x53 = 0b0101_0011
 * -                7654_3210
 * ```
 *
 * @module
 */
import { abs, bitLength, mask, max, xor, type Reduce as BigintReduce } from "../bigint/module.f.ts"
import { flip } from "../function/module.f.ts"
import type { Binary, Reduce as OpReduce } from "../function/operator/module.f.ts"
import { fold, type List, type Thunk } from "../list/module.f.ts"
import { asBase, asNominal, type Nominal } from "../nominal/module.f.ts"
import { repeat as mRepeat } from "../monoid/module.f.ts"

/**
 * A vector of bits represented as a signed `bigint`.
 */
export type Vec = Nominal<
    'bit_vec',
    '1a23a4336197e6158b6936cad34e90d146cd84b9b40ff7ab75a17c6d79e31d89',
    bigint>

/**
 * An empty vector of bits.
 */
export const empty: Vec = asNominal(0n)

/**
 * Calculates the length of the given vector of bits.
 */
export const length = (v: Vec): bigint => bitLength(asBase(v))

const lazyEmpty = () => empty

/**
 * Creates a vector of bits of the given `len` and the provided unsigned integer.
 *
 * @example
 *
 * ```js
 * const vec4 = vec(4n)
 * const v0 = vec4(5n)     // -0xDn = -0b1101
 * const v1 = vec4(0x5FEn) //  0xEn =  0b1110
 * ```
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
 * Creates an 8-bit vector from an unsigned integer.
 */
export const vec8: (ui: bigint) => Vec = vec(8n)

/**
 * Returns the unsigned integer representation of the vector by clearing the stop bit.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0x5n) // -0x85n
 * const result = uint(vector); // result is 0x5n
 * ```
 */
export const uint = (v: Vec): bigint => {
    const b = asBase(v)
    if (b >= 0n) { return b }
    const u = -b
    const len = bitLength(u)
    return u ^ (1n << (len - 1n))
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
 * Packs an unpacked representation back into a vector.
 */
export const pack = ({ length, uint }: Unpacked): Vec => vec(length)(uint)

type Norm = (len: bigint) => {
    readonly a: bigint
    readonly b: bigint
}

type NormOp = Binary<Unpacked, Unpacked, Norm>

const lsbNorm: NormOp = ({ length: al, uint: a }) => ({ length: bl, uint: b }) => (len: bigint) =>
    ({ a, b })

const msbNorm: NormOp = ({ length: al, uint: a }) => ({ length: bl, uint: b }) => (len: bigint) =>
    ({ a: a << (len - al), b: b << (len - bl) })

/**
 * Normalizes two vectors to the same length before applying a bigint reducer.
 */
const op = (norm: NormOp) => (op: BigintReduce): Reduce => ap => bp => {
    const au = unpack(ap)
    const bu = unpack(bp)
    const len = max(au.length)(bu.length)
    const { a, b } = norm(au)(bu)(len)
    return vec(len)(op(a)(b))
}

export type Reduce = OpReduce<Vec>

/**
 * Represents operations for handling bit vectors with a specific bit order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering
 */
export type BitOrder = {
    /**
     * Retrieves the first unsigned integer of the specified length from the given vector.
     *
     * @param len - The number of bits to read from the start of the vector.
     * @returns A function that takes a vector and returns the extracted unsigned integer.
     *
     * @example
     *
     * ```js
     * const vector = vec(8n)(0xF5n)
     *
     * const resultL0 = lsb.front(4n)(vector)  // 5n
     * const resultL1 = lsb.front(16n)(vector) // 0xF5n
     *
     * const resultM0 = msb.front(4n)(vector)  // 0xFn
     * const resultM1 = msb.front(16n)(vector) // 0xF500n
     * ```
     */
    readonly front: (len: bigint) => (v: Vec) => bigint
    /**
     * Removes a specified number of bits from the start of the given vector.
     *
     * @param len - The number of bits to remove from the vector.
     * @returns A function that takes a vector and returns the remaining vector.
     *
     * @example
     *
     * ```js
     * const v = vec(16n)(0x3456n)
     *
     * const rL0 = lsb.removeFront(4n)(v)  // uint(rL0) is 0x345n
     * const rL1 = lsb.removeFront(24n)(v) // rL1 === empty
     *
     * const rM0 = msb.removeFront(4n)(v)  // uint(rM0) is 0x456n
     * const rM1 = msb.removeFront(24n)(v) // rM1 === empty
     * ```
     */
    readonly removeFront: (len: bigint) => (v: Vec) => Vec
    /**
     * Removes a specified number of bits from the start of the vector and returns
     * the removed bits and the remaining vector.
     *
     * @param len - The number of bits to remove from the vector.
     * @returns A function that takes a vector and returns
     * a tuple containing the removed bits as an unsigned integer and the remaining vector.
     *
     * @example
     *
     * ```js
     * const vector = vec(8n)(0xF5n)
     *
     * const [uL0, rL0] = lsb.popFront(4n)(vector)  // [5n, uint(rL0) is 0xFn]
     * const [uL1, rL1] = lsb.popFront(16n)(vector) // [0xF5n, rL1 === empty]
     *
     * const [uM0, rM0] = msb.popFront(4n)(vector)  // [0xFn, uint(rM0) is 0x5n]
     * const [uM1, rM1] = msb.popFront(16n)(vector) // [0xF500n, rM1 === empty]
     * ```
     */
    readonly popFront: (len: bigint) => (v: Vec) => readonly [bigint, Vec]
    /**
     * Concatenates two vectors.
     *
     * @returns A function that takes a second vector and returns the concatenated vector.
     *
     * @example
     *
     * ```js
     * const u8 = vec(8n)
     * const a = u8(0x45n)
     * const b = u8(0x89n)
     *
     * const abL = lsb.concat(a)(b) // uint(abL) is 0x8945n
     * const abM = msb.concat(a)(b) // uint(abM) is 0x4589n
     * ```
     */
    readonly concat: Reduce
    /**
     * Computes the bitwise exclusive OR of two vectors after normalizing their lengths.
     *
     * @returns A function that takes a second vector and returns the XOR result.
     */
    readonly xor: Reduce
}

/**
 * Implements operations for handling vectors in a least-significant-bit (LSb) first order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering#LSb_0_bit_numbering
 *
 * Usually associated with Little-Endian (LE) byte order.
 */
export const lsb: BitOrder = {
    front: len => {
        const m = mask(len)
        return v => uint(v) & m
    },
    removeFront: len => v => {
        const { length, uint } = unpack(v)
        return vec(length - len)(uint >> len)
    },
    popFront: len => {
        const m = mask(len)
        return v =>  {
            const { length, uint } = unpack(v)
            return [uint & m, vec(length - len)(uint >> len)]
        }
    },
    concat: (a: Vec) => (b: Vec): Vec => {
        const { length: al, uint: au } = unpack(a)
        const { length: bl, uint: bu } = unpack(b)
        return vec(al + bl)((bu << al) | au)
    },
    xor: op(lsbNorm)(xor)
}

/**
 * Implements operations for handling vectors in a most-significant-bit (MSb) first order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering#MSb_0_bit_numbering
 *
 * Usually associated with Big-Endian (BE) byte order.
 */
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
    concat: flip(lsb.concat),
    xor: op(msbNorm)(xor)
}

const appendU8 = ({ concat }: BitOrder) => (u8: number) => (a: Vec) =>
    concat(a)(vec8(BigInt(u8)))

/**
 * Converts a list of unsigned 8-bit integers to a bit vector using the provided bit order.
 *
 * @param bo The bit order for the conversion
 * @param list The list of unsigned 8-bit integers to be converted.
 * @returns The resulting vector based on the provided bit order.
 */
export const u8ListToVec = (bo: BitOrder): (list: List<number>) => Vec =>
    fold(appendU8(bo))(empty)

/**
 * Converts a bit vector to a list of unsigned 8-bit integers based on the provided bit order.
 *
 * @param bitOrder The bit order for the conversion.
 * @param v The vector to be converted.
 * @returns A thunk that produces a list of unsigned 8-bit integers.
 */
export const u8List = ({ popFront }: BitOrder): (v: Vec) => Thunk<number> => {
    const f = (v: Vec) => () => {
        if (v === empty) { return null }
        const [first, tail] = popFront(8n)(v)
        return { first: Number(first), tail: f(tail) }
    }
    return f
}

/**
 * Concatenates a list of vectors using the provided bit order.
 */
export const listToVec = ({ concat }: BitOrder): (list: List<Vec>) => Vec =>
    fold(flip(concat))(empty)

export const repeat = mRepeat({ identity: empty, operation: lsb.concat })
