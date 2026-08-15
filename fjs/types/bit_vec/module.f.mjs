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
 *
 * @import { Reduce as BigintReduce } from '../bigint/types.ts'
 * @import { Fold } from '../function/operator/types.ts'
 * @import { List, Thunk } from '../list/types.ts'
 * @import { Absorbing } from '../../common/monoid/types.ts'
 * @import { Sign } from '../function/compare/types.ts'
 * @import { Nullable } from '../nullable/types.ts'
 * @import { BitOrder, PopFront, Reduce, Unpacked, Vec, _NormOp, _UnpackConcat, } from './types.ts'
 */

import { bitLength, divUp, mask, maxLength, xor } from '../bigint/module.f.mjs'
import { compose, flip, identity } from '../function/module.f.mjs'
import { map } from '../list/module.f.mjs'
import { asBase, asNominal } from '../nominal/module.f.mjs'
import { foldAbsorbing, repeat as mRepeat } from '../../common/monoid/module.f.mjs'
import { cmp, max, min } from '../function/compare/module.f.mjs'
import { map as nullableMap, mapUnwrap } from '../nullable/module.f.mjs'

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
 * Normalizes two vectors to the same length before applying a bigint reducer.
 *
 * @type {(norm: _NormOp) => (op: BigintReduce) => Reduce}
 */
const op = norm => op => ap => bp => {
    const au = unpack(ap)
    const bu = unpack(bp)
    const len = max(au.length)(bu.length)
    const { a, b } = norm(au)(bu)(len)
    return vec(len)(op(a)(b))
}

/**
 * @typedef {{
 *  readonly norm: _NormOp
 *  readonly uintCmp: (a: bigint) => (b: bigint) => Sign
 *  readonly unpackSplit: (len: bigint) => (u: Unpacked) => readonly[bigint, bigint]
 *  readonly unpackConcatUint: (a: Unpacked) => (b: Unpacked) => bigint
 * }} _Base
 */

const unpackEmpty = /** @type {const} */{ length: 0n, uint: 0n }

/**
 * Neither of these depends on a bit order or on the list being mapped, so both
 * are bound once here rather than rebuilt per call (`fjs/AGENTS.md` §3.3).
 */
const mapUnpack = map(unpack)

/** @type {(_: number) => Unpacked} */
const u8ToUnpacked = b => ({ length: 8n, uint: BigInt(b) })

const mapU8ToUnpacked = map(u8ToUnpacked)

/**
 * Concatenation as a monoid over `Nullable<Unpacked>`, where `null` means "the
 * concatenation is longer than `maxLength`" and is an **absorbing** element:
 * combining it with anything is `null` again. The identity is the empty vector.
 *
 * This is a lawful monoid, so `monoid.fold` may re-associate it freely. Length
 * is additive and non-negative, so any partial combine is at most the total: a
 * partial can only overflow when the total does, and the top-level combine
 * always sees the full total. The result is therefore `null` **iff** the total
 * length exceeds `maxLength`, whatever the grouping.
 *
 * The cap is checked on the operands' lengths rather than on the concatenated
 * result because the result is what must not be built: `maxLength` is the
 * smallest `bigint` size supported across FunctionalScript's runtimes. The two
 * lengths are exact and additive — this is the length, not an estimate of it
 * (`DESIGN.md` §6).
 *
 * Being absorbing is also what keeps the fold's walk bounded: `foldAbsorbing`
 * stops at the first merge that overflows instead of reading the rest of a list
 * whose answer is already `null`. `List<T>` includes `Thunk<T>`, so that is the
 * difference between answering and never returning on an unbounded lazy list —
 * and at `maxLength` = 128 KiB, overflow is an ordinary outcome for a stream,
 * not an exotic one. Since a single vector is never `null`, only a merge can
 * reach the absorbing element, so the stop lags the element that crossed the cap
 * by at most one doubling of the run size (measured: 65 536 elements read for a
 * cap crossed at 32 769, and 4 for a cap crossed at 3).
 *
 * @type {(unpackConcat: _UnpackConcat) => Absorbing<Nullable<Unpacked>>}
 */
const tryUnpackConcat = unpackConcat => ({
    monoid: {
        identity: unpackEmpty,
        operation: a => b =>
            a === null || b === null || a.length + b.length > maxLength
                ? null
                : unpackConcat(a)(b)
    },
    absorbing: null,
})

/**
 * Concatenates a list of unpacked vectors, or `null` if the result would be
 * longer than `maxLength`.
 *
 * `monoid.foldAbsorbing` reduces as a balanced binary tree, so each merge joins
 * two runs of comparable size — O(n log n) total `bigint` shifting work instead
 * of the O(n²) a left fold would spend growing one accumulator against small
 * operands — and stops reading at the first overflow.
 *
 * This is the bit-vector analogue of a builder that accumulates appended pieces
 * and materializes the combined result on demand, such as `StringBuilder`
 * (Java, C#) or `strings.Builder` (Go).
 *
 * @param {_UnpackConcat} unpackConcat
 */
const unpackListToVec = unpackConcat =>
    compose(foldAbsorbing(tryUnpackConcat(unpackConcat)))(nullableMap(pack))

/** @type {(base: _Base) => BitOrder} */
const bo = ({ norm, uintCmp, unpackSplit, unpackConcatUint }) => {
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
    // `front` and `removeFront` are the two projections of `unpackPopFront`,
    // so each bit order supplies only `unpackSplit` and both fall out of it.
    // `pack` re-masks, so `removeFront` can hand on the unmasked rest.
    /** @type {(len: bigint) => (v: Vec) => bigint} */
    const front = len => {
        const f = unpackPopFront(len)
        return v => f(unpack(v))[0]
    }
    /** @type {(len: bigint) => (v: Vec) => Vec} */
    const removeFront = len => {
        const f = unpackPopFront(len)
        return v => pack(f(unpack(v))[1])
    }
    /** @type {_UnpackConcat} */
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
    const unpackedListToVec = unpackListToVec(unpackConcat)
    /** @param {List<Vec>} list */
    const tryListToVec = list => unpackedListToVec(mapUnpack(list))
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
            const f = front(n)
            return v => length(v) < n ? false : f(v) === u
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
export const tryU8ListToVec = ({ unpackConcat }) => {
    const unpackedListToVec = unpackListToVec(unpackConcat)
    return list => unpackedListToVec(mapU8ToUnpacked(list))
}

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
