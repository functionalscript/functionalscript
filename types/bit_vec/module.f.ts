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
import { bitLength, divUp, mask, max, min, xor, type Reduce as BigintReduce } from '../bigint/module.f.ts'
import { flip } from '../function/module.f.ts'
import type { Binary, Fold, Reduce as OpReduce } from '../function/operator/module.f.ts'
import { fold, iterable, map, type List, type Thunk } from '../list/module.f.ts'
import { asBase, asNominal, type Nominal } from '../nominal/module.f.ts'
import { repeat as mRepeat } from '../monoid/module.f.ts'
import { cmp, type Sign } from '../function/compare/module.f.ts'

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
        const u = m & ui
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

export type PopFront<T> = (len: bigint) => (u: T) => readonly [bigint, T]

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
    readonly popFront: PopFront<Vec>
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
    readonly unpackPopFront: PopFront<Unpacked>
    readonly norm: NormOp
    /**
     * Lexically compares two vectors.
     *
     * a < b => -1
     * a > b => 1
     * a === b => 0
     */
    readonly cmp: (a: Vec) => (b: Vec) => Sign
    readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly[bigint, bigint]
    readonly unpackConcat: (a: Unpacked) => (b: Unpacked) => Unpacked
    readonly startsWith: (prefix: Vec) => (v: Vec) => boolean
}

type Base = {
    readonly front: (len: bigint) => (v: Vec) => bigint
    readonly removeFront: (len: bigint) => (v: Vec) => Vec
    readonly norm: NormOp
    readonly uintCmp: (a: bigint) => (b: bigint) => Sign
    readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly[bigint, bigint]
    readonly unpackConcatUint: (a: Unpacked) => (b: Unpacked) => bigint
}

const bo = ({ front, removeFront, norm, uintCmp, unpackSplit, unpackConcatUint }: Base): BitOrder => {
    const unpackPopFront = (len: bigint) => {
        const m = mask(len)
        const us = unpackSplit(len)
        return (v: Unpacked) => {
            const [uint, rest] = us(v)
            return [uint & m, { length: v.length - len, uint: rest }] as const
        }
    }
    const unpackConcat = (a: Unpacked) => (b: Unpacked) => ({
        length: a.length + b.length, uint: unpackConcatUint(a)(b)
    })
    const popFront: PopFront<Vec> = len => {
        const f = unpackPopFront(len)
        return v => {
            const [uint, u] = f(unpack(v))
            return [uint, pack(u)]
        }
    }
    return {
        front,
        removeFront,
        concat: a => b => {
            const au = unpack(a)
            const bu = unpack(b)
            return pack(unpackConcat(au)(bu))
        },
        xor: op(norm)(xor),
        unpackPopFront,
        popFront,
        norm,
        cmp: a => b => {
            const au = unpack(a)
            const bu = unpack(b)
            const al = au.length
            const bl = bu.length
            const { a: aui, b: bui } = norm(au)(bu)(min(al)(bl))
            const c = uintCmp(aui)(bui)
            return c === 0 ? cmp(al)(bl) : c
        },
        unpackSplit,
        unpackConcat,
        startsWith: prefix => {
            const { length: n, uint: u } = unpack(prefix)
            return v => length(v) < n ? false : popFront(n)(v)[0] === u
        }
    }
}

const lsbUnpackConcatUint = ({ uint: a, length }: Unpacked) => ({ uint: b }: Unpacked) => (b << length) | a

/**
 * Implements operations for handling vectors in a least-significant-bit (LSb) first order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering#LSb_0_bit_numbering
 *
 * Usually associated with Little-Endian (LE) byte order.
 */
export const lsb: BitOrder = bo({
    front: len => {
        const m = mask(len)
        return v => uint(v) & m
    },
    removeFront: len => v => {
        const { length, uint } = unpack(v)
        return vec(length - len)(uint >> len)
    },
    norm: ({ uint: a }) => ({ uint: b }) => () =>
        ({ a, b }),
    uintCmp: a => b => {
        const diff = a ^ b
        return diff === 0n ? 0 : (a & (diff & -diff)) === 0n ? -1 : 1
    },
    unpackSplit: len => ({ uint }) => [uint, uint >> len],
    unpackConcatUint: lsbUnpackConcatUint
})

/**
 * Implements operations for handling vectors in a most-significant-bit (MSb) first order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering#MSb_0_bit_numbering
 *
 * Usually associated with Big-Endian (BE) byte order.
 */
export const msb: BitOrder = bo({
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
    norm: ({ length: al, uint: a }) => ({ length: bl, uint: b }) => len =>
        ({ a: a << (len - al), b: b << (len - bl) }),
    uintCmp: cmp,
    unpackSplit: len => ({ length, uint }) => [uint >> (length - len), uint],
    unpackConcatUint: flip(lsbUnpackConcatUint),
})

const unpackEmpty = { length: 0n, uint: 0n } as const

/**
 * Converts a list of unsigned 8-bit integers to a bit vector using the provided bit order.
 *
 * @param bo The bit order for the conversion
 * @param list The list of unsigned 8-bit integers to be converted.
 * @returns The resulting vector based on the provided bit order.
 */
export const u8ListToVec = ({ unpackConcat }: BitOrder) => (list: List<number>): Vec => {
    let result: readonly Unpacked[] = []
    for (const b of iterable(list)) {
        let v: Unpacked = { length: 8n, uint: BigInt(b) }
        let i = 0
        while (true) {
            if (result.length <= i) {
                result = [...result, v]
                break;
            }
            const old = result[i]
            if (old.length === 0n) {
                result = result.toSpliced(i, 1, v)
                break
            }
            result = result.toSpliced(i, 1, unpackEmpty)
            v = unpackConcat(old)(v)
            i++
        }
    }
    return pack(result.reduce((p, c) => unpackConcat(c)(p), unpackEmpty))
}

/**
 * Chunks a bit vector into fixed-size pieces of `n` bits using the provided bit order.
 * The last chunk may be smaller than `n` bits if the vector length is not a multiple of `n`.
 *
 * @param bitOrder The bit order for the conversion.
 * @param n The chunk size in bits.
 * @param v The vector to be chunked.
 * @returns A thunk that produces a list of bit vectors, each representing one chunk.
 */
export const chunkList = ({ unpackSplit }: BitOrder) => (n: bigint): (v: Vec) => Thunk<Vec> => {
    const divUpN2 = divUp(n << 1n)
    return v => {
        if (v === empty) { return () => null }
        type Stack = readonly[Unpacked, Stack | undefined]
        const f = (stack: Stack) => () => {
            while (true) {
                const [first, rest] = stack
                const { length } = first
                if (length <= n) {
                    return { first: pack(first), tail: rest !== undefined ? f(rest) : null }
                }
                const aLength = divUpN2(length) * n
                const bLength = length - aLength
                const [a, b] = unpackSplit(aLength)(first)
                stack = [
                    { length: aLength, uint: a & mask(aLength) },
                    [{ length: bLength, uint: b & mask(bLength) }, rest],
                ]
            }
        }
        return f([unpack(v), undefined])
    }
}

const vecToU8 = ({ unpackSplit }: BitOrder): (chunk: Vec) => number => {
    const unpackSplit8 = unpackSplit(8n)
    return chunk => {
        const u = unpack(chunk)
        return Number(u.length < 8n ? unpackSplit8(u)[0] : u.uint)
    }
}

/**
 * Converts a bit vector to a list of unsigned 8-bit integers based on the provided bit order.
 *
 * @param bitOrder The bit order for the conversion.
 * @param v The vector to be converted.
 * @returns A thunk that produces a list of unsigned 8-bit integers.
 */
export const u8List = (bo: BitOrder) => (v: Vec): Thunk<number> =>
    map(vecToU8(bo))(chunkList(bo)(8n)(v))

/**
 * Concatenates a list of vectors using the provided bit order.
 */
export const listToVec = ({ concat }: BitOrder): (list: List<Vec>) => Vec =>
    fold(flip(concat))(empty)

/**
 * Repeats a vector to create a padded block of the desired length.
 */
export const repeat: Fold<bigint, Vec> =
    mRepeat({ identity: empty, operation: lsb.concat })

export const isVec = <T>(v: Vec | T): v is Vec =>
    typeof v === 'bigint'
