/**
 * A pack index, `.idx`: from an object id to where its entry begins in the
 * `.pack` beside it.
 *
 * A pack is length-framed rather than delimiter-framed, so this is a decoder
 * in the [`fjs/asn.1`](../../asn.1/module.f.mjs) style and not a grammar over
 * the byte alphabet like the ref files and the object headers. It reads a
 * whole file and refuses one whose tables do not add up to its length.
 *
 * Every claim below was measured against Git 2.43.0 on packs it wrote.
 *
 * **Two versions are live, and the second is not a superset of the first.**
 * Version 2 begins with the four bytes `\377tOc` and a version word; version
 * 1 has neither and begins with the fanout table. Git writes 2 by default
 * and still writes 1 under `pack.indexVersion 1` — measured, not assumed —
 * and reads both, so both are read here.
 *
 * The version test is the magic and it cannot be ambiguous. A version 1 file
 * begins with `fanout[0]`, the number of ids whose first byte is zero, so
 * reading it as the magic would need a pack of about 4.28 billion such
 * objects. The two layouts differ in more than a header:
 *
 * | | version 1 | version 2 |
 * | --- | --- | --- |
 * | magic and version | absent | `\377tOc`, then `2` |
 * | fanout | 256 words at 0 | 256 words at 8 |
 * | ids and offsets | interleaved, offset first | two tables, ids then CRCs then offsets |
 * | offsets over 2 GiB | cannot be spelled | a second table of 8-byte offsets |
 *
 * **The fanout is a cumulative count, not a count.** `fanout[k]` is how many
 * ids have a first byte of `k` or less, so `fanout[255]` is the object count
 * and the pair `fanout[k - 1] .. fanout[k]` bounds the ids starting with `k`.
 * Measured over every `k` on a real pack of 19 objects, and it is what makes
 * the lookup a search of one bucket rather than of the file.
 *
 * **The id width is the repository's.** A SHA-256 pack stores 32-byte ids
 * and 32-byte checksums, measured: the same file read at the wrong width has
 * a trailer of the wrong size, which is how a mismatch is refused rather
 * than mis-parsed.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { Idx } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { length, msb, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'

const toVec = u8ListToVec(msb)

/** The four bytes a version 2 index begins with: `\377tOc`. */
const magic = /** @type {const} */ ([0xFF, 0x74, 0x4F, 0x63])

/** How many entries the fanout table has, one per possible first byte. */
const fanout = 256

/**
 * A big-endian 32-bit word, read as arithmetic rather than with shifts.
 *
 * `<<` in JavaScript is a 32-bit *signed* operation, so `b[at] << 24` is
 * negative for a first byte of 0x80 or more and needs an unsigned coercion
 * to undo. Multiplying never has that shape.
 *
 * @type {(b: readonly number[], at: number) => number}
 */
const u32 = (b, at) => b[at] * 16777216 + b[at + 1] * 65536 + b[at + 2] * 256 + b[at + 3]

/**
 * A big-endian 64-bit word, or `null` where it is too large to be a byte
 * offset this repository can use.
 *
 * A `number` holds an integer exactly up to 2^53 - 1, and the offsets go on
 * to `readBytes`, which takes one. So an offset above that is refused rather
 * than rounded: 2^53 bytes is 8 PiB, which no pack is, and a value that big
 * is a corrupt file rather than a large one.
 *
 * @type {(b: readonly number[], at: number) => Nullable<number>}
 */
const u64 = (b, at) => {
    const high = u32(b, at)
    const low = u32(b, at + 4)
    const v = high * 4294967296 + low
    return Number.isSafeInteger(v) ? v : null
}

/** @type {(b: readonly number[], at: number, width: number) => Oid} */
const oidAt = (b, at, width) => toVec(b.slice(at, at + width))

/**
 * Whether the fanout table agrees with the ids that follow it: every
 * `fanout[k]` is the number of ids whose first byte is `k` or less, and the
 * ids ascend.
 *
 * Checked rather than trusted, because a lookup is a search and a search over
 * ids that do not ascend answers *wrongly* instead of failing. Git leans on
 * the order without re-deriving it, so a file this refuses is one Git would
 * quietly mis-read — which is the trade
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * settles the other way.
 *
 * @type {(b: readonly number[], fanoutAt: number, idsAt: number, stride: number, n: number, width: number) => boolean}
 */
const fanoutAgrees = (b, fanoutAt, idsAt, stride, n, width) => {
    /**
     * Whether the id at `i` is strictly below the one at `i + 1`, compared
     * over every byte.
     *
     * Over every byte and not over the first one: two ids sharing a first
     * byte sit in the same fanout bucket, so a check of first bytes alone
     * would pass a bucket whose own order is wrong, and the search inside a
     * bucket is where that would answer falsely.
     */
    const ascends = Array.from({ length: n === 0 ? 0 : n - 1 }, (_, i) => i).every(i => {
        const x = idsAt + i * stride
        const y = x + stride
        const at = Array.from({ length: width }, (_, k) => k).find(k => b[x + k] !== b[y + k])
        return at !== undefined && b[x + at] < b[y + at]
    })
    if (!ascends) { return false }
    /** The first byte of each id, which is the bucket the fanout counts. */
    const firsts = Array.from({ length: n }, (_, i) => b[idsAt + i * stride])
    /** @type {(k: number) => number} */
    const upTo = k => firsts.filter(v => v <= k).length
    return Array.from({ length: fanout }, (_, k) => k).every(k => u32(b, fanoutAt + k * 4) === upTo(k))
}

/**
 * Version 1: the fanout, then one entry per object of a 4-byte offset and an
 * id, then the two checksums.
 *
 * There is no second offset table, so a version 1 index cannot name a byte
 * past 4 GiB at all. That is the reason version 2 exists and not a gap in
 * this reader.
 *
 * @type {(b: readonly number[], oidBytes: OidBytes) => Nullable<Idx>}
 */
const tryV1 = (b, oidBytes) => {
    const width = oidBytes
    const n = u32(b, (fanout - 1) * 4)
    const stride = 4 + width
    const entriesAt = fanout * 4
    if (b.length !== entriesAt + n * stride + 2 * width) { return null }
    if (!fanoutAgrees(b, 0, entriesAt + 4, stride, n, width)) { return null }
    return {
        oidBytes,
        ids: Array.from({ length: n }, (_, i) => oidAt(b, entriesAt + i * stride + 4, width)),
        offsets: Array.from({ length: n }, (_, i) => u32(b, entriesAt + i * stride)),
        packChecksum: oidAt(b, entriesAt + n * stride, width),
    }
}

/**
 * The bit a 4-byte offset sets to mean "this is an index into the 8-byte
 * table" rather than an offset, and so also the first offset that cannot be
 * spelled in four bytes.
 */
const largeOffsetFlag = 0x80000000

/**
 * Version 2: the magic and version, the fanout, the ids, a CRC per object,
 * a 4-byte offset per object, then as many 8-byte offsets as the file has
 * room for, then the two checksums.
 *
 * The CRCs are skipped. They check an entry's compressed bytes, which is a
 * question for a reader of the pack and not for the lookup, and keeping them
 * here would be data with no consumer.
 *
 * The count of 8-byte offsets is not stored anywhere. Git derives it from the
 * file's length alone and indexes into whatever that leaves, which is not
 * enough: with every 4-byte offset's high bit clear, an extra eight bytes
 * before the checksums still divides evenly, so the file reads and the table is
 * a block longer than anything refers to. That block is not idle — it turns an
 * index *past* the table, which the length alone would have refused, into one
 * inside it, and the garbage there reads as an offset. So the count is checked
 * against the words that name it: the table holds exactly as many entries as
 * the largest index needs and none spare, which is what Git writes. A file
 * whose table is longer is one Git would read and this refuses, the trade
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * settles that way, and the exact length check is still what says where the
 * table ends.
 *
 * @type {(b: readonly number[], oidBytes: OidBytes) => Nullable<Idx>}
 */
const tryV2 = (b, oidBytes) => {
    const width = oidBytes
    if (u32(b, 4) !== 2) { return null }
    const fanoutAt = 8
    const n = u32(b, fanoutAt + (fanout - 1) * 4)
    const idsAt = fanoutAt + fanout * 4
    const offsetsAt = idsAt + n * width + n * 4
    const largeAt = offsetsAt + n * 4
    const largeBytes = b.length - largeAt - 2 * width
    if (largeBytes < 0 || largeBytes % 8 !== 0) { return null }
    const large = largeBytes / 8
    if (!fanoutAgrees(b, fanoutAt, idsAt, width, n, width)) { return null }
    /** The 4-byte offset words, each either an offset or an index into the table. */
    const words = Array.from({ length: n }, (_, i) => u32(b, offsetsAt + i * 4))
    /** The largest index the words name, or `-1` where none of them names one. */
    const highest = words.reduce(
        (m, w) => w < largeOffsetFlag ? m : Math.max(m, w - largeOffsetFlag),
        -1)
    // The table is exactly long enough for that index and no longer. This is
    // also what refuses an index past the table, which needs no check of its
    // own once the table's length is the one the words ask for.
    if (large !== highest + 1) { return null }
    const offsets = words.map(w =>
        w < largeOffsetFlag ? w : u64(b, largeAt + (w - largeOffsetFlag) * 8))
    if (!offsets.every(o => o !== null)) { return null }
    return {
        oidBytes,
        ids: Array.from({ length: n }, (_, i) => oidAt(b, idsAt + i * width, width)),
        offsets: /** @type {readonly number[]} */ (offsets),
        packChecksum: oidAt(b, largeAt + large * 8, width),
    }
}

/**
 * A `.idx` decoded, or `null` where it is one Git would not read at this
 * width: a length its tables do not add up to, a version 2 word that is not
 * 2, a fanout that disagrees with the ids, or an 8-byte offset too large to
 * be one.
 *
 * The width is the repository's, the same argument every reader here takes,
 * and reading a SHA-256 index at 20 bytes refuses rather than mis-parses —
 * the trailer lands in the wrong place and the length check catches it.
 *
 * @throws If the input is not a list of bytes.
 *
 * @type {(oidBytes: OidBytes) => (input: Bytes) => Nullable<Idx>}
 */
export const tryIdx = oidBytes => input => {
    const b = byteArray(input)
    if (b.length < fanout * 4 + 2 * oidBytes) { return null }
    return magic.every((v, i) => b[i] === v) ? tryV2(b, oidBytes) : tryV1(b, oidBytes)
}

/**
 * Where an id's entry begins in the pack, or `null` where the pack does not
 * hold it.
 *
 * A search and not a scan, which is what the ids being sorted buys and why
 * {@link tryIdx} refuses a file whose order it cannot trust.
 *
 * Two ids are compared as a width and a value, never as a value alone. A
 * `Vec` of 20 bytes holding 1 and one of 32 bytes holding 1 have the same
 * `uint`, so comparing values alone would let a short id match a long one
 * through its leading zeros. Within one index every id has the repository's
 * width, so the widths are equal for every comparison the search makes and
 * the ordering is the value's.
 *
 * The width comes from the index and not from its first id, so an index of no
 * objects checks it too. An empty pack holds no id at all, so a lookup in one
 * always misses — but a miss and a caller mixing two repositories are
 * different answers, and reading the width from `ids[0]` would have had
 * nothing to read and would have reported the first as the second.
 *
 * @throws On an id of another width than the index holds, which is a caller
 * mixing two repositories rather than an id the pack lacks.
 *
 * @type {(idx: Idx) => (id: Oid) => Nullable<number>}
 */
export const offsetOf = ({ oidBytes, ids, offsets }) => id => {
    assert(length(id) === BigInt(oidBytes) * 8n, ['not an id of the index width', id])
    const target = uint(id)
    /** @type {(lo: number, hi: number) => Nullable<number>} */
    const search = (lo, hi) => {
        if (lo >= hi) { return null }
        const mid = lo + Math.floor((hi - lo) / 2)
        const v = uint(ids[mid])
        if (v === target) { return offsets[mid] }
        return v < target ? search(mid + 1, hi) : search(lo, mid)
    }
    return search(0, ids.length)
}
