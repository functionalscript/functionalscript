/**
 * MSb is most-significant bit first.
 * ```
 * - byte: 0x53 = 0b0101_0011
 * -                0123_4567
 * ```
 * LSb is least-significant bit first.
 * ```
 * - byte: 0x53 = 0b0101_0011
 * -                7654_3210
 * ```
 * @module
 */
import { log2, mask } from '../bigint/module.f.ts'
import { flip } from '../function/module.f.ts'
import { fold, type List, type Thunk } from '../list/module.f.ts'
import { as_base, as_nominal, type Nominal } from '../nominal/module.f.ts'

/**
 * A vector of bits represented as a `bigint`.
 */
export type Vec = Nominal<'bit_vec_0cef502e4a951e6e42f421c62abd79e7e9b07bee3e63549638676ec2d8ed98e3', bigint>

export const unsafeVec: (u: bigint) => Vec = as_nominal

export const unsafeBigint: (v: Vec) => bigint = as_base

/**
 * An empty vector of bits.
 */
export const empty: Vec = unsafeVec(1n)

/**
 * Calculates the length of the given vector of bits.
 */
export const length = (v: Vec): bigint => log2(unsafeBigint(v))

const lazyEmpty = () => empty

/**
 * Creates a vector of bits of the given `len` and the given unsigned integer.
 *
 * @example
 *
 * ```js
 * const vec4 = vec(4n)
 * const v0 = vec4(5n)     // 0x15n = 0b1_0101
 * const v1 = vec4(0x5FEn) // 0x1En = 0b1_1110
 * ```
 */
export const vec = (len: bigint): (ui: bigint) => Vec => {
    if (len <= 0n) { return lazyEmpty }
    const stop = 1n << len
    const mask = stop - 1n
    return data => unsafeVec(stop | (data & mask))
}

/**
 * Creates an 8 bit vector from an unsigned integer.
 */
export const vec8: (u: bigint) => Vec = vec(8n)

/**
 * Returns the unsigned integer of the given vector by removing a stop bit.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0x5n) // 0x105n
 * const result = uint(vector); // result is 0x5n
 * ```
 */
export const uint = (v: Vec): bigint => unsafeBigint(v) ^ (1n << length(v))

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
     * const vector = vec(8n)(0xF5n) // 0x1F5n
     *
     * const resultL0 = lsb.front(4n)(vector)  // resultL0 is 5n
     * const resultL1 = lsb.front(16n)(vector) // resultL1 is 0xF5n
     *
     * const resultM0 = msb.front(4n)(vector)  // resultM0 is 0xFn
     * const resultM1 = msb.front(16n)(vector) // resultM1 is 0xF500n
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
     * const v = vec(16n)(0x3456n) // 0x13456n
     *
     * const rL0 = lsb.removeFront(4n)(v)  // 0x1345n
     * const rL1 = lsb.removeFront(24n)(v) // 0x1n
     *
     * const rM0 = msb.removeFront(4n)(v)  // 0x1456n
     * const rM1 = msb.removeFront(24n)(v) // 0x1n
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
     * ```js
     * const vector = vec(8n)(0xF5n) // 0x1F5n
     *
     * const [uL0, rL0] = lsb.popFront(4n)(vector)  // [5n, 0x1Fn]
     * const [uL1, rL1] = lsb.popFront(16n)(vector) // [0xF5n, 1n]
     *
     * const [uM0, rM0] = msb.popFront(4n)(vector)  // [0xFn, 0x15n]
     * const [uM1, rM1] = msb.popFront(16n)(vector) // [0xF500n, 1n]
     * ```
     */
    readonly popFront: (len: bigint) => (v: Vec) => readonly [bigint, Vec]
    /**
     * Concatenates two vectors.
     *
     * @param a - The first vector.
     * @returns A function that takes a second vector and returns the concatenated vector.
     *
     * @example
     *
     * ```js
     * const u8 = vec(8n)
     * const a = u8(0x45n) // 0x145n
     * const b = u8(0x89n) // 0x189n
     *
     * const abL = lsb.concat(a)(b) // 0x18945n
     * const abM = msb.concat(a)(b) // 0x14589n
     * ```
     */
    readonly concat: (a: Vec) => (b: Vec) => Vec
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
        return v => {
            const u = unsafeBigint(v)
            const result = u & m
            return result === u ? uint(v) : result
        }
    },
    removeFront: len => v => {
        const r = unsafeBigint(v) >> len
        return r === 0n ? empty : unsafeVec(r)
    },
    popFront: len => {
        const m = mask(len)
        return v => {
            const u = unsafeBigint(v)
            const result = u & m
            return result === u ? [uint(v), empty] : [result, unsafeVec(u >> len)]
        }
    },
    concat: a => {
        const aLen = length(a)
        const m = mask(aLen)
        return b => unsafeVec((unsafeBigint(b) << aLen) | (unsafeBigint(a) & m))
    },
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
        return v => (unsafeBigint(v) >> (length(v) - len)) & m
    },
    removeFront: len => v => vec(length(v) - len)(unsafeBigint(v)),
    popFront: len => {
        const m = mask(len)
        return v => {
            const u = unsafeBigint(v)
            const d = length(v) - len
            return [(u >> d) & m, vec(d)(u)]
        }
    },
    concat: flip(lsb.concat),
}

const appendU8 = ({ concat }: BitOrder) => (u8: number) => (a: Vec) =>
    concat(a)(vec8(BigInt(u8)))

/**
 * Converts a list of unsigned 8-bit integers to a bit vector.
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

export const listToVec = ({ concat }: BitOrder): (list: List<Vec>) => Vec => fold(concat)(empty)
