/**
 * A packfile's framing, and the delta instructions inside one.
 *
 * A pack is length-framed throughout, so this is a decoder in the
 * [`fjs/asn.1`](../../asn.1/module.f.mjs) style rather than a grammar over
 * the byte alphabet. It has no effects and does not walk the file: an entry's
 * payload is a zlib stream, and nothing can say where one entry ends without
 * inflating it, so walking belongs to the reader that has `inflate` and this
 * module answers one entry at a time.
 *
 * Every claim below was measured against Git 2.43.0, on a pack it wrote, and
 * the delta decoding was checked by rebuilding an object and comparing it to
 * `git cat-file`.
 *
 * **Three varints, and they are not one encoding.** This is the part a reader
 * is most likely to get wrong, because two of them look alike:
 *
 * | where | groups | order | and |
 * | --- | --- | --- | --- |
 * | an entry's type and size | 4 bits, then 7 | least first | 3 type bits above the first 4 |
 * | a delta's two sizes | 7 bits | least first | |
 * | an `ofsDelta`'s distance back | 7 bits | **most** first | each continuation adds one |
 *
 * The third is the odd one. Its value is built as `(v + 1) << 7 | next` per
 * continuation byte, so the same number has one spelling and a two-byte
 * sequence cannot encode what one byte already can. Reading it as the other
 * kind gives a base in the wrong place, which is why it is measured rather
 * than assumed: a delta at offset 726 resolves to a base at 366 only under
 * this reading, and that base is the id `git verify-pack -v` names for it.
 *
 * **A delta is copy and insert, against one base.** After the two sizes, each
 * instruction is one byte and its top bit says which kind. An insert's low
 * seven bits are a length, 1 to 127, and that many literal bytes follow. A
 * copy's low four bits say which of four offset bytes are present and the
 * next three which of three size bytes, each least significant first, and a
 * size of zero means 65536 — the one place the format spells a number by
 * leaving it out.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { Entry, PackHeader } from './types.ts'
 */

import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { concat, flat, toArray } from '../../types/list/module.f.mjs'

const toVec = u8ListToVec(msb)

/** The four bytes a pack begins with. */
const signature = /** @type {const} */ ([0x50, 0x41, 0x43, 0x4B])

/**
 * The versions this reads. Git writes 2; 3 was defined for a reftable-era
 * change that never shipped in a pack Git writes, so it is refused rather
 * than read as 2 would be.
 */
const version2 = /** @type {const} */ (2)

/** How long a pack's header is: the signature, the version, the count. */
const headerBytes = /** @type {const} */ (12)

/** @type {(b: readonly number[], at: number) => number} */
const u32 = (b, at) => b[at] * 16777216 + b[at + 1] * 65536 + b[at + 2] * 256 + b[at + 3]

/**
 * The object kind each of the four object type codes names. Index 0 is unused
 * and 5 is reserved, so both read as `undefined` and refuse the entry; 6 and
 * 7 are the two delta kinds and are not objects.
 *
 * @type {readonly (ObjectType | undefined)[]}
 */
const objectTypes = [undefined, 'commit', 'tree', 'blob', 'tag']

/**
 * A pack's header, or `null` where the bytes are not one: a signature that is
 * not `PACK`, a version this does not read, or fewer than twelve bytes.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(input: Bytes) => Nullable<PackHeader>}
 */
export const tryHeader = input => {
    const b = byteArray(input)
    if (b.length < headerBytes) { return null }
    if (!signature.every((v, i) => b[i] === v)) { return null }
    const version = u32(b, 4)
    return version === version2 ? { version, count: u32(b, 8) } : null
}

/**
 * A value read as 7 bits per byte, least significant group first, and where it
 * ends — or `null` where the bytes run out or the value grows past what a
 * `number` holds exactly.
 *
 * `value` and `scale` are where the reading starts, so that the one encoding
 * serves both places it appears: a delta's sizes begin at zero with a scale of
 * one, and an entry's size begins with the four bits already taken from the
 * first byte and so with a scale of sixteen. Passing them in is also what
 * keeps this closed over nothing.
 *
 * The bound is the pack index's: these become lengths and offsets that go on
 * to `readBytes`, which takes a `number`, so a value above 2^53 - 1 is refused
 * rather than rounded.
 *
 * @type {(b: readonly number[], at: number, value: number, scale: number) => Nullable<readonly [number, number]>}
 */
const littleVarint = (b, at, value, scale) => {
    if (at >= b.length) { return null }
    const c = b[at]
    const next = value + (c % 128) * scale
    if (!Number.isSafeInteger(next)) { return null }
    return c < 128 ? [next, at + 1] : littleVarint(b, at + 1, next, scale * 128)
}

/**
 * The distance back to an `ofsDelta`'s base, and where it ends.
 *
 * Most significant group first, and each continuation byte adds one to what
 * came before it: `(value + 1) * 128 + group`. That `+ 1` is what makes the
 * encoding one-to-one, since it removes the shorter spelling a longer
 * sequence would otherwise duplicate, and it is the difference between
 * landing on the base and landing in the middle of another entry.
 *
 * @type {(b: readonly number[], at: number, value: number) => Nullable<readonly [number, number]>}
 */
const backVarint = (b, at, value) => {
    if (at >= b.length) { return null }
    const c = b[at]
    if (c < 128) { return [value + c, at + 1] }
    const next = (value + (c % 128) + 1) * 128
    return Number.isSafeInteger(next) ? backVarint(b, at + 1, next) : null
}

/**
 * One entry's header, read from bytes that begin at the entry, or `null` where
 * they are not one: a reserved or unused type code, a varint that runs off the
 * end, or a base id the bytes are too short to hold.
 *
 * The bytes need not be the whole pack, and usually are not: a caller that has
 * the entry's offset hands over a window from there, and reads the base of an
 * `ofsDelta` at `offset - baseBack`. Nothing here needs to know the offset,
 * which is why nothing here is told it.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<Entry>}
 */
export const tryEntry = oidBytes => input => {
    const b = byteArray(input)
    if (b.length === 0) { return null }
    const first = b[0]
    const code = Math.floor(first / 16) % 8
    // the first byte carries the low four bits of the size, and the rest of
    // the size continues from the fifth bit
    const low = first % 16
    /** @type {Nullable<readonly [number, number]>} */
    const sized = first < 128 ? [low, 1] : littleVarint(b, 1, low, 16)
    if (sized === null) { return null }
    const [bytes, after] = sized
    if (code === 6) {
        const back = backVarint(b, after, 0)
        if (back === null || back[0] === 0) { return null }
        return { kind: 'ofsDelta', size: bytes, baseBack: back[0], dataAt: back[1] }
    }
    if (code === 7) {
        if (b.length < after + oidBytes) { return null }
        return { kind: 'refDelta', size: bytes, baseId: toVec(b.slice(after, after + oidBytes)), dataAt: after + oidBytes }
    }
    const type = objectTypes[code]
    return type === undefined ? null : { kind: 'object', type, size: bytes, dataAt: after }
}

/**
 * How long a copy of size zero is. The format spells 65536 by leaving every
 * size byte out, which is the one number it encodes by absence.
 */
const wholeCopy = /** @type {const} */ (65536)

/**
 * A little-endian value from the bytes a bit mask selects, and where it ends.
 *
 * A copy instruction names its offset with four optional bytes and its size
 * with three, each present only if its bit is set, and each less significant
 * than the next. Absent bytes contribute nothing, so an instruction that sets
 * no bit names offset zero and, through {@link wholeCopy}, a size of 65536.
 *
 * `k` and `value` are where the reading is up to, passed in rather than closed
 * over so that this recurses on itself and carries no context.
 *
 * @type {(b: readonly number[], at: number, mask: number, count: number, k: number, value: number) => Nullable<readonly [number, number]>}
 */
const selected = (b, at, mask, count, k, value) => {
    if (k === count) { return [value, at] }
    if (Math.floor(mask / Math.pow(2, k)) % 2 === 0) { return selected(b, at, mask, count, k + 1, value) }
    if (at >= b.length) { return null }
    return selected(b, at + 1, mask, count, k + 1, value + b[at] * Math.pow(256, k))
}

/**
 * The pieces a delta's instructions name, from `at` onwards, or `null` where
 * one of them is not an instruction this can follow.
 *
 * The pieces are collected and joined once by the caller rather than appended
 * to a growing array, which would copy what is already there for every
 * instruction and so cost the square of the object's length. They are a
 * {@link List} and not an array for the same reason one step down: `concat`
 * copies nothing, where a fresh array per instruction would copy every piece
 * named so far and make the *count* of instructions quadratic even though the
 * bytes are only sliced.
 *
 * **A loop and not a recursion, because the instruction count is the input's.**
 * One frame per instruction is one frame an untrusted pack chooses: measured on
 * node 22, a delta of 5,000 one-byte inserts — a few kilobytes of pack, since
 * such a stream compresses to almost nothing — died with
 * `RangeError: Maximum call stack size exceeded`, where 3,000 answered. That is
 * the shape [`fjs/effects`](../../effects/module.f.mjs)' `_walkLoop` removes
 * for a walk, and the same answer applies here: depth is constant in the
 * instruction count, and the only bound left is the target size the header
 * declares. A limit of this module's own would be a number Git does not have.
 *
 * Everything it needs is a parameter, so this closes over nothing: `d` is the
 * delta and `src` the base.
 *
 * @type {(d: readonly number[], src: readonly number[], at: number) => Nullable<List<readonly number[]>>}
 */
const deltaPieces = (d, src, at) => {
    /** @type {List<readonly number[]>} */
    let found = null
    let i = at
    while (true) {
        if (i === d.length) { return found }
        const c = d[i]
        if (c < 128) {
            // an insert of nothing is written by no encoder, and a stream of
            // them would make no progress
            if (c === 0 || i + 1 + c > d.length) { return null }
            found = concat(found)([d.slice(i + 1, i + 1 + c)])
            i += 1 + c
            continue
        }
        const offset = selected(d, i + 1, c, 4, 0, 0)
        if (offset === null) { return null }
        const size = selected(d, offset[1], Math.floor(c / 16), 3, 0, 0)
        if (size === null) { return null }
        const length = size[0] === 0 ? wholeCopy : size[0]
        if (offset[0] + length > src.length) { return null }
        found = concat(found)([src.slice(offset[0], offset[0] + length)])
        i = size[1]
    }
}

/**
 * The object a delta builds from its base, or `null` where the delta does not
 * describe it: a size that disagrees with the base or with the result, an
 * instruction that runs off the end, a copy outside the base, or an insert of
 * length zero, which no encoder writes and which would let a stream make no
 * progress.
 *
 * Both sizes in the delta's header are checked rather than skipped. The source
 * size says which base the delta was made against, so a mismatch means the
 * base is the wrong object — the thing a `refDelta` chain gets wrong when an
 * id collides or a pack is stitched together — and the target size is the only
 * statement of what the result should be.
 *
 * @throws If either input is not a list of bytes.
 *
 * @type {(base: Bytes, delta: Bytes) => Nullable<readonly number[]>}
 */
export const tryApplyDelta = (base, delta) => {
    const src = byteArray(base)
    const d = byteArray(delta)
    const sourceSize = littleVarint(d, 0, 0, 1)
    if (sourceSize === null || sourceSize[0] !== src.length) { return null }
    const targetSize = littleVarint(d, sourceSize[1], 0, 1)
    if (targetSize === null) { return null }
    const [want, start] = targetSize
    const named = deltaPieces(d, src, start)
    if (named === null) { return null }
    const out = toArray(flat(named))
    return out.length === want ? out : null
}
