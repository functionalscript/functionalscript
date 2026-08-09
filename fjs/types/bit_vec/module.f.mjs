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

import { bitLength, divUp, mask, maxLength, xor } from '../bigint/module.f.mjs'
/** @import { Reduce as BigintReduce } from '../bigint/module.f.mjs' */

import { flip, identity } from '../function/module.f.mjs'

/** @import { Binary, Fold, Reduce as OpReduce } from '../function/operator/module.f.mjs' */

import { map, tryFold } from '../list/module.f.mjs'
/** @import { Accumulator, List, Thunk } from '../list/module.f.mjs' */

import { asBase, asNominal } from '../nominal/module.f.mjs'
/** @import { Nominal } from '../nominal/module.f.mjs' */

import { repeat as mRepeat } from '../../common/monoid/module.f.mjs'

import { cmp, max, min } from '../function/compare/module.f.mjs'
/** @import { Sign } from '../function/compare/module.f.mjs' */

import { mapUnwrap } from '../nullable/module.f.mjs'
/** @import { Nullable } from '../nullable/module.f.mjs' */

/** @typedef {'1a23a4336197e6158b6936cad34e90d146cd84b9b40ff7ab75a17c6d79e31d89'} Revision */

/**
 * A vector of bits represented as a signed `bigint`.
 *
 * @typedef {Nominal<'bit_vec', Revision, bigint>} Vec
 */

/**
 * Maximum length of a bit vector in bits (1_048_576 = 0x10_0000).
 * This limit is enforced by Bun's `bigint` size constraint, the minimal limit
 * across all runtime environments supported by FunctionalScript.
 */
export { maxLength }

export const maxLengthBytes = maxLength >> 3n

/**
 * An empty vector of bits.
 *
 * @type {Vec}
 */
export const empty = asNominal(0n)

/**
 * Calculates the length of the given vector of bits.
 *
 * @type {(v: Vec) => bigint}
 */
export const length = v => bitLength(asBase(v))

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
 *
 * @type {(len: bigint) => (ui: bigint) => Vec}
 */
export const vec = len => {
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
export const vec8 = vec(8n)

/**
 * Builds a vector from a bigint whose most-significant set bit is a sentinel
 * marking the start of the data.
 *
 * The sentinel does double duty: it fixes the length (`bitLength - 1`) and is
 * stripped from the result. This lets a plain hex literal carry leading zero
 * bits that would otherwise be lost — write `0x1` ahead of the data and the
 * `1` both delimits and disappears.
 *
 * @example
 *
 * ```js
 * uint(fromSentinel(0x1_89_50n))   // 0x8950n
 * length(fromSentinel(0x1_89_50n)) // 16n — the two data bytes, sentinel gone
 * fromSentinel(0x1_00_05n)         // a 16-bit vector holding 0x0005
 * ```
 *
 * @type {(raw: bigint) => Vec}
 */
export const fromSentinel = raw => vec(bitLength(raw) - 1n)(raw)

/**
 * Returns the unsigned integer representation of the vector by clearing the stop bit.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0x5n) // -0x85n
 * const result = uint(vector); // result is 0x5n
 * ```
 *
 * @type {(v: Vec) => bigint}
 */
export const uint = v => {
    const b = asBase(v)
    if (b >= 0n) { return b }
    const u = -b
    const len = bitLength(u)
    return u ^ (1n << (len - 1n))
}

/**
 * Structure describing the unpacked view of a vector.
 * @typedef {{
 *  readonly length: bigint
 *  readonly uint: bigint
 * }} Unpacked
 */

/**
 * Extracts the logical length and unsigned integer from the vector.
 *
 * @type {(v: Vec) => Unpacked}
 */
export const unpack = v => ({
    length: length(v),
    uint: uint(v),
})

/**
 * Packs an unpacked representation back into a vector.
 *
 * @type {({ length, uint }: Unpacked) => Vec}
 */
export const pack = ({ length, uint }) => vec(length)(uint)

/** @type {({ uint }: Unpacked) => bigint} */
export const unpackedUint = ({ uint }) => uint

/**
 * @typedef {(len: bigint) => {
 *  readonly a: bigint
 *  readonly b: bigint
 * }} Norm
 */

/** @typedef {Binary<Unpacked, Unpacked, Norm>} NormOp */

/** @typedef {OpReduce<Vec>} Reduce */

/**
 * Normalizes two vectors to the same length before applying a bigint reducer.
 *
 * @type {(norm: NormOp) => (op: BigintReduce) => Reduce}
 */
const op = norm => op => ap => bp => {
    const au = unpack(ap)
    const bu = unpack(bp)
    const len = max(au.length)(bu.length)
    const { a, b } = norm(au)(bu)(len)
    return vec(len)(op(a)(b))
}

/**
 * @template T
 * @typedef {(len: bigint) => (u: T) => readonly [bigint, T]} PopFront
 */

/**
 * Represents operations for handling bit vectors with a specific bit order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering
 *
 * @typedef {{
 *  readonly front: (len: bigint) => (v: Vec) => bigint
 *  readonly removeFront: (len: bigint) => (v: Vec) => Vec
 *  readonly popFront: PopFront<Vec>
 *  readonly concat: Reduce
 *  readonly tryListToVec: (list: List<Vec>) => Nullable<Vec>
 *  readonly listToVec: (list: List<Vec>) => Vec
 *  readonly xor: Reduce
 *  readonly unpackPopFront: PopFront<Unpacked>
 *  readonly norm: NormOp
 *  readonly cmp: (a: Vec) => (b: Vec) => Sign
 *  readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly[bigint, bigint]
 *  readonly unpackConcat: UnpackConcat
 *  readonly startsWith: (prefix: Vec) => (v: Vec) => boolean
 * }} BitOrder
 */

/**
 * @typedef {{
 *  readonly front: (len: bigint) => (v: Vec) => bigint
 *  readonly removeFront: (len: bigint) => (v: Vec) => Vec
 *  readonly norm: NormOp
 *  readonly uintCmp: (a: bigint) => (b: bigint) => Sign
 *  readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly[bigint, bigint]
 *  readonly unpackConcatUint: (a: Unpacked) => (b: Unpacked) => bigint
 * }} Base
 */

const unpackEmpty = /** @type {const} */{ length: 0n, uint: 0n }

/** @typedef {(a: Unpacked) => (b: Unpacked) => Unpacked} UnpackConcat */

/**
 * @typedef {{
 *  readonly len: bigint
 *  readonly stack: readonly Unpacked[]
 * }} ListToVecState
 */

/** @typedef {Accumulator<Unpacked, ListToVecState, Vec>} ListToVecOp */

/** @type {(unpackConcat: UnpackConcat) => ListToVecOp} */
const listToVecOp = unpackConcat => ({
    init: { len: 0n, stack: [] },
    update: (v, {len, stack}) => {
        len += v.length
        if (len > maxLength) { return null }
        let i = 0
        while (true) {
            if (stack.length <= i) {
                stack = [...stack, v]
                break
            }
            const old = stack[i]
            if (old.length === 0n) {
                stack = stack.toSpliced(i, 1, v)
                break
            }
            stack = stack.toSpliced(i, 1, unpackEmpty)
            v = unpackConcat(old)(v)
            i++
        }
        return { len, stack }
    },
    end: ({stack}) => pack(stack.reduce((p, c) => unpackConcat(c)(p), unpackEmpty))
})

/**
 * Concatenates a list of unpacked vectors using a binary-counter accumulator,
 * giving O(n log n) total `bigint` shifting work instead of the O(n²) of a
 * naive left fold.
 *
 * Slot `i` of `result` holds an already-combined run of the most recent
 * `2 ** i` elements. Each arriving element "carries" upward, merging only with
 * runs of comparable size — exactly like incrementing a binary number — so
 * every merge joins two runs of similar length. Left-to-right element order is
 * preserved: `unpackConcat(old)(cur)` keeps the earlier run on the left, and
 * the final reduce prepends higher (earlier) slots in front of accumulated
 * later runs. An empty list yields `unpackEmpty`.
 *
 * Returns `null` as soon as the accumulated length exceeds `maxLength`, which
 * `tryFold` propagates by abandoning the rest of the list.
 *
 * This is the bit-vector analogue of a builder that accumulates appended pieces
 * and materializes the combined result on demand, such as `StringBuilder`
 * (Java, C#) or `strings.Builder` (Go).
 *
 * @param {UnpackConcat} unpackConcat
 */
const unpackListToVec = unpackConcat => tryFold(listToVecOp(unpackConcat))

/** @type {(base: Base) => BitOrder} */
const bo = ({ front, removeFront, norm, uintCmp, unpackSplit, unpackConcatUint }) => {
    /** @param {bigint} len */
    const unpackPopFront = len => {
        const m = mask(len)
        const us = unpackSplit(len)
        /** @param {Unpacked} v */
        return v => {
            const [uint, rest] = us(v)
            return /** @type {const} */([uint & m, { length: v.length - len, uint: rest }])
        }
    }
    /** @type {UnpackConcat} */
    const unpackConcat = a => b => ({
        length: a.length + b.length,
        uint: unpackConcatUint(a)(b)
    })
    /** @type {PopFront<Vec>} */
    const popFront = len => {
        const f = unpackPopFront(len)
        return v => {
            const [uint, u] = f(unpack(v))
            return [uint, pack(u)]
        }
    }
    /** @type {Reduce} */
    const concat = a => b => {
        const au = unpack(a)
        const bu = unpack(b)
        return pack(unpackConcat(au)(bu))
    }
    /** @param {List<Vec>} list */
    const tryListToVec = list =>
        unpackListToVec(unpackConcat)(map(unpack)(list))
    return {
        front,
        removeFront,
        concat,
        tryListToVec,
        listToVec: mapUnwrap(tryListToVec),
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

const lsbUnpackConcatUint =
    (/** @type {Unpacked} */{ uint: a, length }) =>
    (/** @type {Unpacked} */{ uint: b }) => (b << length) | a

/**
 * Implements operations for handling vectors in a least-significant-bit (LSb) first order.
 *
 * https://en.wikipedia.org/wiki/Bit_numbering#LSb_0_bit_numbering
 *
 * Usually associated with Little-Endian (LE) byte order.
 */
export const lsb = bo({
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
export const msb = bo({
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

/**
 * Converts a list of unsigned 8-bit integers to a bit vector using the provided
 * bit order, like `u8ListToVec`, but returns `null` instead of throwing when the
 * result would exceed `maxLength`.
 *
 * @type {(_: BitOrder) => (list: List<number>) => Nullable<Vec>}
 */
export const tryU8ListToVec = ({ unpackConcat }) => list =>
    unpackListToVec(unpackConcat)(
        map(/** @type {(_: number) => Unpacked} */b => ({ length: 8n, uint: BigInt(b) }))(list))

/**
 * Converts a list of unsigned 8-bit integers to a bit vector using the provided bit order.
 *
 * @param {BitOrder} bo The bit order for the conversion
 * @param list The list of unsigned 8-bit integers to be converted.
 * @returns The resulting vector based on the provided bit order.
 */
export const u8ListToVec = bo =>
    mapUnwrap(tryU8ListToVec(bo))

/** @type {({ unpackSplit }: BitOrder) => (n: bigint) => (u: Unpacked) => Thunk<Unpacked>} */
const unpackChunkList = ({ unpackSplit }) => n => {
    const divUpN2 = divUp(n << 1n)
    return u => {
        if (u.length === 0n) { return () => null }
        /** @typedef {readonly[Unpacked, Stack | undefined]} Stack */
        const f = (/** @type {Stack} */stack) => () => {
            while (true) {
                const [first, rest] = stack
                const { length } = first
                if (length <= n) {
                    return { first, tail: rest !== undefined ? f(rest) : null }
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
        return f([u, undefined])
    }
}

/**
 * @type {<I>(g: (i: I) => Unpacked) =>
 *  <O>(f: (u: Unpacked) => O) =>
 *  (bo: BitOrder) =>
 *  (n: bigint) =>
 *  (i: I) =>
 *  Thunk<O>
 * }
 */
const mappedChunkList = g => f => bo => n => {
    const ucl = unpackChunkList(bo)(n)
    const mf = map(f)
    return i => mf(ucl(g(i)))
}

/**
 * Chunks an unpacked vector into fixed-size pieces of `n` bits using the provided bit order,
 * returning each chunk as an unsigned integer.
 * The last chunk may be smaller than `n` bits if the vector length is not a multiple of `n`.
 *
 * @type {(bo: BitOrder) => (n: bigint) => (u: Unpacked) => Thunk<bigint>}
 */
export const uintChunkList
    = mappedChunkList(identity/*<Unpacked>*/)(unpackedUint)

/**
 * Chunks a bit vector into fixed-size pieces of `n` bits using the provided bit order.
 * The last chunk may be smaller than `n` bits if the vector length is not a multiple of `n`.
 *
 * @type {(bo: BitOrder) => (n: bigint) => (v: Vec) => Thunk<Vec>}
 */
export const chunkList = mappedChunkList(unpack)(pack)

/** @type {({ unpackSplit }: BitOrder) => (chunk: Vec) => number} */
const vecToU8 = ({ unpackSplit }) => {
    const unpackSplit8 = unpackSplit(8n)
    return chunk => {
        const u = unpack(chunk)
        return Number(u.length < 8n ? unpackSplit8(u)[0] : u.uint)
    }
}

/**
 * Converts a bit vector to a list of unsigned 8-bit integers based on the provided bit order.
 *
 * @type {(bo: BitOrder) => (v: Vec) => Thunk<number>}
 */
export const u8List = bo => v =>
    map(vecToU8(bo))(chunkList(bo)(8n)(v))

/**
 * Repeats a vector to create a padded block of the desired length.
 *
 * @type {Fold<bigint, Vec>}
 */
export const repeat =
    mRepeat({ identity: empty, operation: lsb.concat })

export const isVec =
    /**
     * @template T
     * @param {Vec | T} v
     * @return {v is Vec}
     */
    v => typeof v === 'bigint'
