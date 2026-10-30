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
 * @import { Nullable } from '../nullable/types.ts'
 * @import { BitOrder, PopFront, Reduce, Unpacked, Vec, _Base, _NormOp, _UnpackConcat, } from './types.ts'
 */

import { bitLength, divUp, mask, maxLength as bigintMaxLength, roundUp8, xor } from '../bigint/module.f.mjs'
import { compose, flip, identity } from '../function/module.f.js'
import { map, next } from '../list/module.f.mjs'
import { toArray } from '../list/alt/module.f.mjs'
import { isByte } from '../number/module.f.mjs'
import { asBase, asNominal } from '../nominal/module.f.js'
import { foldAbsorbing, repeat as mRepeat } from '../../common/monoid/module.f.mjs'
import { cmp, max, min } from '../function/compare/module.f.js'
import { mapUnwrap } from '../nullable/module.f.js'
import { assert } from '../../asserts/module.f.js'

/**
 * Maximum length of a bit vector in bits (1_048_576 = 0x10_0000).
 * This limit is enforced by Bun's `bigint` size constraint, the minimal limit
 * across all runtime environments supported by FunctionalScript.
 */
export const maxLength = bigintMaxLength

/**
 * `bits`, asserted to be a count. A negative one has no byte meaning, and the
 * arithmetic below would answer it anyway: `-1n >> 3n` is `-1n`, and `-8n` is
 * a multiple of eight. A caller can reach one only by subtracting lengths
 * wrongly, so it panics rather than returns.
 *
 * @type {(bits: bigint) => bigint}
 */
const bitCount = bits => {
    assert(bits >= 0n, ['negative bit count', bits])
    return bits
}

/**
 * The whole bytes in `bits`; `bits` need not be a multiple of eight, and a
 * trailing partial byte is not counted.
 *
 * The primitive takes a bit count rather than a `Vec`, so a consumer that
 * holds only a running length, never the vector, asks the same question.
 *
 * @throws On a negative `bits`.
 *
 * @type {(bits: bigint) => bigint}
 */
export const bytesIn = bits => bitCount(bits) >> 3n

/**
 * Whether `bits` is a whole number of bytes.
 *
 * @throws On a negative `bits`.
 *
 * @type {(bits: bigint) => boolean}
 */
export const isWholeBytesIn = bits => (bitCount(bits) & 0b111n) === 0n

/**
 * The bits in `bytes` whole bytes; the inverse of {@link bytesIn} on a
 * whole-byte count.
 *
 * @throws On a negative `bytes`.
 *
 * @type {(bytes: bigint) => bigint}
 */
export const bitsIn = bytes => {
    assert(bytes >= 0n, ['negative byte count', bytes])
    return bytes << 3n
}

/** {@link maxLength} in whole bytes. */
export const maxLengthBytes = bytesIn(maxLength)

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

/**
 * The whole bytes in `v`: {@link bytesIn} of its {@link length}.
 *
 * @type {(v: Vec) => bigint}
 */
export const byteLength = v => bytesIn(length(v))

/**
 * Whether `v` is a whole number of bytes: {@link isWholeBytesIn} of its
 * {@link length}.
 *
 * @type {(v: Vec) => boolean}
 */
export const isWholeBytes = v => isWholeBytesIn(length(v))

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
 * {@link vec} with `len` rounded up to whole bytes: the unsigned integer as a
 * big-endian run of whole bytes, zero-padded at the front.
 *
 * @example
 *
 * ```js
 * const v = wholeBytes(9n)(0x1FFn) // vec(16n)(0x1FFn)
 * ```
 *
 * @throws On a negative `len`.
 *
 * @type {(len: bigint) => (ui: bigint) => Vec}
 */
export const wholeBytes = len => vec(roundUp8(bitCount(len)))

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
 * Lifts a binary operation over `Unpacked` to one over `Vec`: the one binary
 * crossing of the representation, shared by every operation that combines two
 * vectors.
 *
 * @type {<T>(f: (a: Unpacked) => (b: Unpacked) => T) => (a: Vec) => (b: Vec) => T}
 */
const lift2 = f => a => b => f(unpack(a))(unpack(b))

/**
 * Normalizes two vectors to the same length before applying a bigint reducer.
 *
 * @type {(norm: _NormOp) => (op: BigintReduce) => Reduce}
 */
const op = norm => op => lift2(au => bu => {
    const len = max(au.length)(bu.length)
    const { a, b } = norm(au)(bu)(len)
    return vec(len)(op(a)(b))
})

const unpackEmpty = /** @type {const} */{ length: 0n, uint: 0n }

/**
 * The element-to-`Unpacked` maps the two {@link mappedListToVec} instances
 * differ by. Neither depends on a bit order, so both are bound once here
 * (`fjs/AGENTS.md` §3.3).
 *
 * An item that is no byte is refused here, where it becomes an 8-bit piece:
 * a wider `uint` would otherwise be carried into the concatenation as it is,
 * and its extra bits would land in a neighbour — `[64, 256]` read as
 * `[65, 0]` — a plausible wrong answer where a refusal is owed
 * (`doc/DESIGN.md` §10). It is a caller's mistake, not an input to handle,
 * so it panics, as `fjs/ebnf/byte`'s `byteArray` does.
 *
 * @throws If `b` is not a byte.
 *
 * @type {(_: number) => Unpacked}
 */
const u8ToUnpacked = b => {
    assert(isByte(b), ['not a byte', b])
    return { length: 8n, uint: BigInt(b) }
}

/**
 * Stands for every concatenation longer than `maxLength`: a vector that is
 * itself longer, so a merge with it is longer still and {@link tryUnpackConcat}
 * answers it again. It is one value, told apart by identity, never packed.
 *
 * @type {Unpacked}
 */
const overflow = { length: maxLength + 1n, uint: 0n }

/** The vector packed, or `null` for {@link overflow}. @type {(u: Unpacked) => Nullable<Vec>} */
const packUnlessOverflow = u => u === overflow ? null : pack(u)

/**
 * Concatenation as a monoid over `Unpacked`, where {@link overflow} means "the
 * concatenation is longer than `maxLength`" and is an **absorbing** element:
 * combining it with anything is `overflow` again. The identity is the empty
 * vector, and a vector weighs its bit count.
 *
 * This is a lawful monoid, so `monoid.fold` may re-associate it freely. Length
 * is additive and non-negative, so any partial combine is at most the total: a
 * partial can only overflow when the total does, and the top-level combine
 * always sees the full total. The result is therefore `overflow` **iff** the
 * total length exceeds `maxLength`, whatever the grouping.
 *
 * The cap is checked on the operands' lengths rather than on the concatenated
 * result because the result is what must not be built: `maxLength` is the
 * smallest `bigint` size supported across FunctionalScript's runtimes. The two
 * lengths are exact and additive — this is the length, not an estimate of it
 * (`doc/DESIGN.md` §6).
 *
 * Being absorbing is also what keeps the fold's walk bounded: `foldAbsorbing`
 * stops at the first merge that overflows instead of reading the rest of a list
 * whose answer is already decided. `List<T>` includes `Thunk<T>`, so that is
 * the difference between answering and never returning on an unbounded lazy
 * list — and at `maxLength` = 128 KiB, overflow is an ordinary outcome for a
 * stream, not an exotic one. A single vector is never `overflow`, so only a
 * merge can reach it, and the merge waits until the vectors pushed above the
 * pair outweigh the run beneath them: the stop lags the element that crossed
 * the cap by about that many bits of input.
 *
 * @type {(unpackConcat: _UnpackConcat) => Absorbing<Unpacked>}
 */
const tryUnpackConcat = unpackConcat => ({
    monoid: {
        identity: unpackEmpty,
        operation: a => b =>
            a.length + b.length > maxLength ? overflow : unpackConcat(a)(b),
        weight: u => Number(u.length),
    },
    absorbing: overflow,
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
    compose(foldAbsorbing(tryUnpackConcat(unpackConcat)))(packUnlessOverflow)

/**
 * Concatenates a list of `I` values into one vector, mapping each element to
 * its `Unpacked` form first; `null` when the result would exceed `maxLength`.
 *
 * The concatenation counterpart of {@link mappedChunkList}. Everything about
 * the operation is fixed except how one element becomes `Unpacked`, so each
 * element type supplies just that map. The `bo` parameter is structural rather
 * than a whole `BitOrder` because `bo`'s own body applies this before the
 * record exists.
 *
 * @type {<I>(g: (i: I) => Unpacked) => (bo: { readonly unpackConcat: _UnpackConcat }) => (list: List<I>) => Nullable<Vec>}
 */
const mappedListToVec = g => ({ unpackConcat }) => {
    const f = unpackListToVec(unpackConcat)
    const mg = map(g)
    return list => f(mg(list))
}

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
    /**
     * `unpackPopFront` over `Vec` input: the one unary crossing of the
     * representation, shared by `front`, `removeFront` and `popFront`.
     *
     * @type {(len: bigint) => (v: Vec) => readonly [bigint, Unpacked]}
     */
    const onUnpacked = len => {
        const f = unpackPopFront(len)
        return v => f(unpack(v))
    }
    // `front`, `removeFront` and `popFront` are the three projections of
    // `onUnpacked`, so each bit order supplies only `unpackSplit` and all
    // three fall out of it. `front` never packs the rest it does not return,
    // and `pack` re-masks, so `removeFront` can hand on the unmasked rest.
    /** @type {(len: bigint) => (v: Vec) => bigint} */
    const front = len => {
        const f = onUnpacked(len)
        return v => f(v)[0]
    }
    /** @type {(len: bigint) => (v: Vec) => Vec} */
    const removeFront = len => {
        const f = onUnpacked(len)
        return v => pack(f(v)[1])
    }
    /** @type {_UnpackConcat} */
    const unpackConcat = a => b => ({
        length: a.length + b.length,
        uint: unpackConcatUint(a)(b)
    })
    /** @type {PopFront<Vec>} */
    const popFront = len => {
        const f = onUnpacked(len)
        return v => {
            const [uint, u] = f(v)
            return [uint, pack(u)]
        }
    }
    /** @type {Reduce} */
    const concat = lift2(a => b => pack(unpackConcat(a)(b)))
    const { operation } = tryUnpackConcat(unpackConcat).monoid
    /** @type {(a: Vec) => (b: Vec) => Nullable<Vec>} */
    const tryConcat = lift2(a => b => packUnlessOverflow(operation(a)(b)))
    const tryListToVec = mappedListToVec(unpack)({ unpackConcat })
    return {
        front,
        removeFront,
        concat,
        tryConcat,
        tryListToVec,
        listToVec: mapUnwrap(tryListToVec),
        xor: op(norm)(xor),
        unpackPopFront,
        popFront,
        norm,
        cmp: lift2(au => bu => {
            const al = au.length
            const bl = bu.length
            const { a: aui, b: bui } = norm(au)(bu)(min(al)(bl))
            const c = uintCmp(aui)(bui)
            return c === 0 ? cmp(al)(bl) : c
        }),
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
 * `null` means only that: an item that is no byte is the caller's mistake, not
 * an overflow, so it throws. The one exception is an item the fold never reads
 * because the list overflowed first — the answer is `null` either way.
 *
 * @throws If an item it reads is not a byte.
 *
 * @type {(_: BitOrder) => (list: List<number>) => Nullable<Vec>}
 */
export const tryU8ListToVec = mappedListToVec(u8ToUnpacked)

/**
 * Converts a list of unsigned 8-bit integers to a bit vector using the provided bit order.
 *
 * @throws If an item is not a byte, or the result would exceed `maxLength`.
 *
 * @param {BitOrder} bo The bit order for the conversion
 * @param list The list of unsigned 8-bit integers to be converted.
 * @returns The resulting vector based on the provided bit order.
 */
export const u8ListToVec = bo =>
    mapUnwrap(tryU8ListToVec(bo))

/**
 * `tryU8ListToVec(msb)`: a vector from its bytes, most significant first — the
 * byte order of every byte-oriented format in this repository — or `null` when
 * the result would exceed `maxLength`.
 *
 * @type {(list: List<number>) => Nullable<Vec>}
 */
export const tryU8ListToVecMsb = tryU8ListToVec(msb)

/**
 * `u8ListToVec(msb)`: {@link tryU8ListToVecMsb}, throwing where it answers
 * `null`.
 *
 * @throws As `u8ListToVec` does.
 *
 * @type {(list: List<number>) => Vec}
 */
export const u8ListToVecMsb = mapUnwrap(tryU8ListToVecMsb)

/** `u8ListToVec(lsb)`, bound once for {@link u8ListToVecChunksMsb}. */
const u8ListToVecLsb = u8ListToVec(lsb)

/**
 * A byte list as the `Vec`s it takes to hold it, `chunkBytes` at a time and
 * the last one shorter, made as a consumer asks for them: one chunk is held
 * at a time and never the whole list as an array, so a list longer than an
 * array would hold is cut all the same. No bytes, no chunks.
 *
 * A `Vec` holds at most {@link maxLengthBytes}, so a byte sequence that may
 * be longer is hashed or written as a list of these. {@link u8ListToVecMsb}
 * is one chunk.
 *
 * Every byte is walked once, and a chunk stops where the list ends. The tail
 * the gathering reached is what the next chunk starts from, not the list with
 * a count dropped from its front: a dropped list walks the bytes it drops, and
 * a chunk over a list dropped over a list would walk every byte before it,
 * once per chunk, which is quadratic in the list.
 *
 * A chunk is gathered in reverse, last byte first, onto a list that is never
 * reversed: the last byte is the least significant in the most significant
 * byte first order, so the reversed list read least significant first is the
 * same `Vec`.
 *
 * @throws If `chunkBytes` is not a whole number from 1 to {@link maxLengthBytes};
 * and when a chunk is read, if one of its items is not a byte.
 *
 * @type {(chunkBytes: number) => (list: List<number>) => List<Vec>}
 */
export const u8ListToVecChunksMsb = chunkBytes => {
    assert(
        Number.isInteger(chunkBytes) && chunkBytes >= 1 && chunkBytes <= Number(maxLengthBytes),
        ['not a chunk length', chunkBytes])
    /** @type {(list: List<number>) => List<Vec>} */
    const chunks = list => () => {
        let rest = list
        let taken = 0
        /** @type {List<number>} */
        let gathered = null
        while (taken < chunkBytes) {
            const r = next(rest)
            if (r === null) { break }
            gathered = { first: r.first, tail: gathered }
            rest = r.tail
            taken += 1
        }
        return taken === 0
            ? null
            : { first: u8ListToVecLsb(gathered), tail: chunks(rest) }
    }
    return chunks
}

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
 * {@link mappedChunkList} over a bit vector: `unpack` depends on neither the
 * chunk mapping, `bo` nor `n`, so this layer is shared by every chunk list
 * that starts from a `Vec`.
 */
const vecMappedChunkList = mappedChunkList(unpack)

/**
 * Chunks a bit vector into fixed-size pieces of `n` bits using the provided bit order.
 * The last chunk may be smaller than `n` bits if the vector length is not a multiple of `n`.
 *
 * @type {(bo: BitOrder) => (n: bigint) => (v: Vec) => Thunk<Vec>}
 */
export const chunkList = vecMappedChunkList(pack)

/**
 * The unsigned value of an `n`-bit chunk. A chunk shorter than `n` is
 * zero-extended at the tail of the bit order: `unpackSplit`'s shift amount
 * goes negative, which per spec becomes a left shift. Under `msb` the value
 * is shifted left (`101` reads as `10100000`, zeros in the low bits); under
 * `lsb` it is unchanged (zeros in the high bits).
 *
 * @type {({ unpackSplit }: BitOrder) => (n: bigint) => (u: Unpacked) => bigint}
 */
const tailPaddedUint = ({ unpackSplit }) => n => {
    const us = unpackSplit(n)
    return u => u.length < n ? us(u)[0] : u.uint
}

/**
 * Chunks a bit vector into fixed-size pieces of `n` bits using the provided bit order,
 * returning each chunk as an unsigned `n`-bit integer. A short trailing chunk is
 * zero-extended at the tail of the bit order — under `msb` the value is shifted
 * left (zeros in the low bits), under `lsb` it is unchanged (zeros in the high bits).
 *
 * @type {(bo: BitOrder) => (n: bigint) => (v: Vec) => Thunk<bigint>}
 */
export const tailPaddedUintChunkList = bo => {
    const boTailPaddedUint = tailPaddedUint(bo)
    return n => vecMappedChunkList(boTailPaddedUint(n))(bo)(n)
}

/** @type {(list: List<bigint>) => Thunk<number>} */
const numberList = map(Number)

/**
 * Converts a bit vector to a list of unsigned 8-bit integers based on the provided bit order.
 *
 * @type {(bo: BitOrder) => (v: Vec) => Thunk<number>}
 */
export const u8List = bo =>
    compose(tailPaddedUintChunkList(bo)(8n))(numberList)

/**
 * `u8List(msb)`: the bytes of a vector, most significant first. A trailing
 * partial byte is zero-padded in its low bits (`vec(9n)(0x83n)` gives
 * `[0x41, 0x80]`), so this inverts `u8ListToVecMsb` only on whole-byte
 * vectors.
 *
 * @type {(v: Vec) => Thunk<number>}
 */
export const u8ListMsb = u8List(msb)

/**
 * {@link u8ListMsb}'s bytes as an array, for a caller that holds them all
 * at once: a header to cut, a fixture to compare, a block to fold.
 *
 * @type {(v: Vec) => readonly number[]}
 */
export const u8ArrayMsb = v => toArray(u8ListMsb(v))

/**
 * `v` cut for padding to a multiple of `block` bits with a terminator — a `1`
 * then zeros, most significant first: the whole blocks of `v`, and its last
 * block completed with the terminator, exactly `block` bits. Their
 * concatenation is the padded `v`, which is never built: it can be up to
 * `block` bits longer than `v`, so for a `v` near {@link maxLength} it would be
 * past what some runtimes' `bigint` can hold.
 *
 * The terminator is always there, so {@link unpadMsb} can find it: a `v`
 * already a multiple of `block` bits gets a whole block of it, `1` and
 * `block - 1` zeros.
 *
 * This is the bit padding of Merkle–Damgård hashes without their length field.
 *
 * @example
 *
 * ```js
 * padLastBlockMsb(5n)(vec(7n)(0x5An)) // [vec(5n)(0x16n), vec(5n)(0x14n)]: 10110 10|100
 * padLastBlockMsb(5n)(empty)          // [empty, vec(5n)(0x10n)]: |10000
 * ```
 *
 * @throws On a `block` that is not positive.
 *
 * @type {(block: bigint) => (v: Vec) => readonly [Vec, Vec]}
 */
export const padLastBlockMsb = block => {
    assert(block > 0n, ['non-positive block', block])
    return v => {
        const len = length(v)
        const wholeLen = len - len % block
        const [whole, rest] = msb.popFront(wholeLen)(v)
        const fill = block - (len - wholeLen)
        return [vec(wholeLen)(whole), msb.concat(rest)(vec(fill)(1n << (fill - 1n)))]
    }
}

/**
 * `v` without its terminator, the last `1` and the zeros after it, most
 * significant first; `null` when `v` has no `1`. It inverts
 * {@link padLastBlockMsb} on its last block, and needs no block size: the
 * terminator is found from the end.
 *
 * A caller that holds the padded vector in pieces, such as a decoder reading
 * a character at a time, gives it the last piece that is not all zeros and
 * concatenates the pieces before it: the padded whole is never built.
 *
 * @example
 *
 * ```js
 * unpadMsb(vec(5n)(0x14n)) // vec(2n)(0x2n): 10|100
 * unpadMsb(vec(5n)(0x10n)) // empty: |10000
 * unpadMsb(vec(5n)(0n))    // null
 * ```
 *
 * @type {(v: Vec) => Nullable<Vec>}
 */
export const unpadMsb = v => {
    const { length: n, uint: u } = unpack(v)
    if (u === 0n) { return null }
    // The lowest `1` and the zeros after it: one past its trailing zeros.
    const cut = bitLength(u & -u)
    return vec(n - cut)(u >> cut)
}

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
