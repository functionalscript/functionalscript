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
 * **Reading an index costs the whole file, whatever a caller wants from it.**
 * Hashing the whole file to check its trailer and materialising every id as a
 * bit vector are both linear in the index and neither is optional: the first is
 * what refuses a corrupt file, and the second is the shape of {@link Idx} rather
 * than a mistake in a loop. Together they dominate the read, and a lookup uses
 * about `log2(n)` of the ids it built. That is
 * [`todo/lazy-index-ids.md`](./todo/lazy-index-ids.md) and not a change here;
 * the figures are there, pinned to the commit they were taken at.
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
 * | largest offset | just under 4 GiB | any, through a second table |
 * | how | the whole 4-byte word | the high bit indexes 8-byte offsets |
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
import { u8ListToVecMsb, uint } from '../../types/bit_vec/module.f.mjs'
import { take } from '../../types/list/module.f.mjs'
import { digestOf, isOidOf } from '../oid/module.f.mjs'

/** The four bytes a version 2 index begins with: `\377tOc`. */
const magic = /** @type {const} */ ([0xFF, 0x74, 0x4F, 0x63])

/** How many entries the fanout table has, one per possible first byte. */
const fanout = /** @type {const} */ (256)

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
const oidAt = (b, at, width) => u8ListToVecMsb(b.slice(at, at + width))

/**
 * The first byte position at which the ids at `x` and `y` differ, or `width`
 * where they are equal.
 *
 * A recursion over the width rather than a `find` over an array of positions,
 * because the array was allocated once per *pair of ids*: on a 100,000-object
 * index that is a hundred thousand throwaway arrays of twenty numbers, and it
 * measured tens of times slower than this. The depth is the id width — 20 or
 * 32 — so it is bounded by the format and not by the file.
 *
 * @type {(b: readonly number[], x: number, y: number, width: number, k: number) => number}
 */
const differsAt = (b, x, y, width, k) =>
    k === width ? width : b[x + k] !== b[y + k] ? k : differsAt(b, x, y, width, k + 1)

/**
 * How many of `firsts` are `k` or less — a search and not a scan.
 *
 * `firsts` is the first byte of each id in file order, so it is non-decreasing
 * *because* {@link fanoutAgrees} has already refused a file whose ids do not
 * ascend. That is a real dependency and not a coincidence: this function is
 * wrong on an unsorted list, and the only caller checks the order first.
 *
 * A filter per bucket instead is 256 full passes over the ids, which is the
 * shape this replaced: linear in the index per bucket against logarithmic, and
 * measured hundreds of times slower on an index of a hundred thousand.
 *
 * The range it searches is a parameter rather than a capture, as `k` and the list
 * are, so this is closed and lives at module scope like {@link differsAt}: one
 * function for the whole file instead of a fresh closure per call, and there are
 * 256 calls per index — one per bucket the fanout names.
 *
 * @type {(firsts: readonly number[], k: number, lo: number, hi: number) => number}
 */
const upTo = (firsts, k, lo, hi) => {
    if (lo >= hi) { return lo }
    const mid = lo + Math.floor((hi - lo) / 2)
    return firsts[mid] <= k ? upTo(firsts, k, mid + 1, hi) : upTo(firsts, k, lo, mid)
}

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
        const at = differsAt(b, x, y, width, 0)
        return at !== width && b[x + at] < b[y + at]
    })
    if (!ascends) { return false }
    /** The first byte of each id, which is the bucket the fanout counts. */
    const firsts = Array.from({ length: n }, (_, i) => b[idsAt + i * stride])
    return Array.from({ length: fanout }, (_, k) => k)
        .every(k => u32(b, fanoutAt + k * 4) === upTo(firsts, k, 0, firsts.length))
}

/**
 * Whether the index's own checksum — the last of the two in the trailer —
 * is the hash of everything before it.
 *
 * The first of the two is the pack's, which this file cannot check because the
 * pack is not here; it is handed back as {@link Idx}'s `packChecksum` so a
 * reader of the pack can. The second is this file's own, and checking it is what
 * catches the corruption no structural rule can see: a flipped byte inside an id
 * or an offset leaves every length, every fanout count and every table index
 * exactly as it was, so the file still adds up and the lookup answers a wrong
 * place in the pack.
 *
 * Git does not check it on every read — it maps the file and trusts it, and
 * verifies only under `index-pack --strict` and `verify-pack`. Reading it here
 * costs a hash of the file per open, which is the same price
 * [`fjs/git/store`](../store/module.f.mjs) already pays per object, for the same
 * reason: nothing above these readers is in a position to notice.
 *
 * @type {(b: readonly number[], oidBytes: OidBytes) => boolean}
 */
const checksumAgrees = (b, oidBytes) => {
    const at = b.length - oidBytes
    // `take` and not `slice`, so the bytes are walked rather than copied
    return digestOf(oidBytes)(take(at)(b)) === oidAt(b, at, oidBytes)
}

/**
 * Version 1: the fanout, then one entry per object of a 4-byte offset and an
 * id, then the two checksums.
 *
 * There is no second offset table, so a version 1 index cannot name a byte
 * past 4 GiB at all. That is the reason version 2 exists and not a gap in
 * this reader.
 *
 * The whole word is the offset, with no bit reserved: `0x80000001` is 2 GiB and
 * one byte here, where the same word in a version 2 index is an *index* into the
 * 8-byte table — see {@link largeOffsetFlag}. So version 1's ceiling is higher
 * than version 2's 4-byte table and lower than what version 2 can reach at all.
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
    if (!checksumAgrees(b, oidBytes)) { return null }
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
const largeOffsetFlag = /** @type {const} */ (0x80000000)

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
    const fanoutAt = /** @type {const} */ (8)
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
    /** The indexes into the 8-byte table, in the order the words name them. */
    const named = words.filter(w => w >= largeOffsetFlag).map(w => w - largeOffsetFlag)
    // Every slot is named, exactly once, and in order: the k-th word that sets
    // the high bit names slot k. That is what Git writes — it walks the objects
    // and hands out the next slot to each one whose offset needs eight bytes —
    // and checking the *count* alone was not enough. Two words naming the same
    // highest slot satisfied a count: a two-slot table holding `[12, 24]` with
    // two words for slot 1 gave both objects offset 24 and left slot 0 unread,
    // which is an index disagreeing with itself answered as two plausible
    // offsets. An index past the table and a table longer than its words ask
    // for are both refused by the same line.
    //
    // The *order* half is Git's rule and not this module's own: measured on Git
    // 2.43.0, `git show-index` given a two-object index whose two words name
    // slots 1 and 0 answers `fatal: inconsistent 64b offset index` and exits
    // 128, and reads the same table in order. So this is not one of the three
    // divergences at {@link tryIdx} — Git's index reader refuses it too, and it
    // is Git's *object* reader, which takes such a file, that disagrees.
    if (large !== named.length || named.some((at, k) => at !== k)) { return null }
    const offsets = words.map(w =>
        w < largeOffsetFlag ? w : u64(b, largeAt + (w - largeOffsetFlag) * 8))
    if (!offsets.every(o => o !== null)) { return null }
    if (!checksumAgrees(b, oidBytes)) { return null }
    return {
        oidBytes,
        ids: Array.from({ length: n }, (_, i) => oidAt(b, idsAt + i * width, width)),
        offsets: /** @type {readonly number[]} */ (offsets),
        packChecksum: oidAt(b, largeAt + large * 8, width),
    }
}

/**
 * A `.idx` decoded, or `null` where it is one this reader will not read at the
 * given width: a length its tables do not add up to, a version 2 word that is
 * not 2, a fanout that disagrees with the ids, or an 8-byte offset too large to
 * be one.
 *
 * **That is a stricter subset than Git's, in three places, each on purpose.**
 * Each is a file Git reads and this refuses, measured on a 42-object index:
 *
 * - a version 2 index whose 8-byte offset table is longer than any 4-byte word
 *   refers to — see {@link tryV2}: the spare block turns an index *past* the
 *   table into one inside it, and the garbage there reads as an offset;
 * - a file whose own trailing checksum does not match its bytes — Git maps the
 *   file and trusts it, verifying only under `index-pack --strict` and
 *   `verify-pack`, and reads all 42 objects out of a corrupted one where this
 *   answers `null`. See {@link checksumAgrees} for why the price is paid here;
 * - a file whose ids do not ascend inside a fanout bucket — Git's bisection
 *   leans on the order without re-deriving it and still found 41 of the 42,
 *   quietly missing one, where this answers `null`. See {@link fanoutAgrees}.
 *
 * So `null` here means "not one of the indexes this reads", and a caller that
 * needs Git's exact set needs all three cases.
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
 * Where the id a value spells sits in the index's offsets, or `null` where the
 * index does not hold it: the bisection {@link offsetOf} is, over the range
 * `[lo, hi)`.
 *
 * Closed and at module scope, like {@link upTo} and {@link differsAt} above: the
 * tables, the value searched for and the range are parameters, so a lookup
 * allocates no closure and the function has an identity of its own (§3.3). The
 * value and not the id, because an id is a `Vec` and comparing two of them means
 * comparing their values — the width is the index's and {@link offsetOf} has
 * already checked it, so every comparison here is between equal widths.
 *
 * @type {(ids: readonly Oid[], offsets: readonly number[], target: bigint, lo: number, hi: number) => Nullable<number>}
 */
const offsetIn = (ids, offsets, target, lo, hi) => {
    if (lo >= hi) { return null }
    const mid = lo + Math.floor((hi - lo) / 2)
    const v = uint(ids[mid])
    if (v === target) { return offsets[mid] }
    return v < target
        ? offsetIn(ids, offsets, target, mid + 1, hi)
        : offsetIn(ids, offsets, target, lo, mid)
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
export const offsetOf = ({ oidBytes, ids, offsets }) => {
    const isOid = isOidOf(oidBytes)
    return id => {
        assert(isOid(id), ['not an id of the index width', id])
        return offsetIn(ids, offsets, uint(id), 0, ids.length)
    }
}

/**
 * {@link after}'s fold: the least of the offsets past the one asked about.
 *
 * A leading parameter rather than a capture, so the step has an identity of its
 * own (§3.3).
 *
 * @type {(offset: number) => (best: Nullable<number>, v: number) => Nullable<number>}
 */
const nextStep = offset => (best, v) =>
    v > offset && (best === null || v < best) ? v : best

/**
 * Where the entry beginning at `offset` ends: the least offset in the index
 * greater than it, or `null` where no entry begins after it and what follows is
 * the pack's trailing checksum.
 *
 * **A pack entry carries no length.** Its header says how many bytes the object
 * *inflates to* and says nothing about how many bytes of the file its zlib
 * stream takes, so nothing in the entry itself says where it ends. That is what
 * makes this the index's question: every object in the pack has an entry here,
 * so the offsets are exactly where the entries begin, and the next one up is
 * where this one ends.
 *
 * The window has to be exact rather than generous, because `inflate` refuses
 * bytes after the end of a stream — a file that holds them is not the object
 * its stream spells — so a reader that hands the host a few bytes too many
 * hands it the beginning of the entry after this one and is refused. Measured
 * on a pack Git 2.43.0 wrote of six objects, two of them deltas: every entry's
 * window taken this way inflated with nothing left over, and the last one ended
 * at the pack's length less its checksum.
 *
 * A scan and not a search: `offsets` runs parallel to `ids` and so is in id
 * order, not in pack order. One pass per entry read, which a delta chain pays
 * per link. The alternative is a table in pack order, which is what Git's own
 * reverse index is and what [`fjs/git/README.md`](../README.md) leaves out of
 * this reader: building one costs a sort of the whole index per read unless it
 * is kept, and keeping it is a second shape {@link Idx} does not have.
 *
 * @type {(idx: Idx) => (offset: number) => Nullable<number>}
 */
export const after = ({ offsets }) => offset =>
    offsets.reduce(nextStep(offset), /** @type {Nullable<number>} */ (null))

/**
 * Whether an entry of the pack begins at this offset.
 *
 * The index's question for the same reason {@link after} is: every object in the
 * pack has an entry here, so these offsets are exactly where entries begin, and
 * a byte position that is not one of them is not the start of anything.
 *
 * **A reader of an `ofsDelta` needs this, and Git makes the same check.** That
 * entry names its base by a distance back rather than by id, and nothing about
 * the distance says it lands on a boundary — so a corrupt or crafted one can
 * point into the middle of another entry, where the bytes may still inflate into
 * something. Measured on Git 2.43.0 by moving one such distance six bytes into
 * the entry before it and recomputing both checksums, so the pair agrees with
 * itself and no framing check can tell:
 *
 * ```
 * $ git index-pack --strict bad.pack   # fatal: pack has 1 unresolved delta
 * $ git cat-file -p <the delta's id>   # error: bad offset for revindex
 *                                      # fatal: Cannot read object …
 * $ git verify-pack -v bad.idx         # fatal: pack has 1 unresolved delta
 * ```
 *
 * Git's revindex is this same list in pack order, so `bad offset for revindex`
 * is exactly the answer this gives.
 *
 * A scan, for the reason {@link after}'s is: `offsets` is in id order rather
 * than pack order, and one pass per link is what a chain pays either way.
 *
 * @type {(idx: Idx) => (offset: number) => boolean}
 */
export const holdsEntryAt = ({ offsets }) => offset => offsets.includes(offset)
