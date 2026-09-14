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
import { maxLengthBytes, msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { concat, flat, toArray } from '../../types/list/module.f.mjs'

const toVec = u8ListToVec(msb)

/** The four bytes a pack begins with. */
const signature = /** @type {const} */ ([0x50, 0x41, 0x43, 0x4B])

/**
 * The versions this reads, which are the versions Git reads.
 *
 * Git writes 2 and reads 2 or 3, treating them identically — `pack_version_ok`
 * admits both and nothing downstream branches on which it was. Measured on Git
 * 2.43.0 by taking a pack it wrote, changing the version word to 3 and
 * recomputing the trailing checksum: `git index-pack --strict` indexes it and
 * `git verify-pack -v` lists every object.
 *
 * So a version 3 pack is read here as a version 2 one, and the header answers
 * whichever number it carried. An earlier revision of this doc said 3 was
 * "defined for a reftable-era change that never shipped" and refused it, which
 * made a pack Git reads unreadable — the same mistake as a rule narrower than
 * Git's, in the one place a whole file hangs on it.
 */
const versions = /** @type {readonly number[]} */ ([2, 3])

/**
 * How long a pack's header is: the signature, the version, the count.
 *
 * Exported because it is where the entries begin, and so the bound a reader
 * holding offsets checks them against: a pack's first entry is at 12, and an
 * offset below that — an `ofsDelta` whose distance back overshoots the front of
 * the file — names no entry.
 */
export const headerBytes = /** @type {const} */ (12)

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
 * not `PACK`, a version this does not read — see {@link versions} — or fewer
 * than twelve bytes.
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
    return versions.includes(version) ? { version, count: u32(b, 8) } : null
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
 * **A group of no bits is added and not multiplied.** The encoding lets a value
 * be padded with continuation bytes that carry nothing, and Git reads such a
 * varint — measured on 2.43.0, where `git index-pack --strict` accepts a one-blob
 * pack whose entry header is `0xb1` and 146 bytes of `0x80` before its
 * terminator, an entry of size 1 spelled the long way. Multiplying would refuse
 * it: the scale doubles seven bits per group, so the 147th group's scale is past
 * what a double holds, `0 * Infinity` is `NaN`, and the bound above would refuse
 * a value that is still 1. A group that is *not* zero at that scale names a value
 * no repository has, and the bound refuses it, which is what the check is for.
 *
 * **A loop and not a recursion**, because after the rule above the number of
 * groups is the input's rather than the bound's: a window of `0x80` bytes is read
 * to its end, and a `readBytes` window reaches 128 KiB. As a recursion that was
 * one frame per byte, so reading a padded varint would have traded a wrong
 * refusal for a stack overflow — measured on node 22, the recursive form read
 * 5,500 groups and died with `RangeError` at 6,000, where this reads 100,000
 * without noticing. Depth is constant, and
 * the bound left is the one the format has: a value that does not fit a `number`.
 *
 * @type {(b: readonly number[], at: number, value: number, scale: number) => Nullable<readonly [number, number]>}
 */
const littleVarint = (b, at, value, scale) => {
    let i = at
    let v = value
    let s = scale
    while (true) {
        if (i >= b.length) { return null }
        const c = b[i]
        const group = c % 128
        const next = group === 0 ? v : v + group * s
        if (!Number.isSafeInteger(next)) { return null }
        if (c < 128) { return [next, i + 1] }
        v = next
        s = s * 128
        i += 1
    }
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
        const walked = backVarint(b, after, 0)
        if (walked === null) { return null }
        const [baseBack, dataAt] = walked
        // a distance of nothing back is the entry itself, which no encoder
        // writes and which would make a chain that cannot end
        if (baseBack === 0) { return null }
        return { kind: 'ofsDelta', size: bytes, baseBack, dataAt }
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
 * **The declared target size is a bound and not a tally.** It is checked as the
 * pieces are named, not once at the end, because the end is too late to have
 * refused the work: a delta declaring a target of nothing and then repeating the
 * bare copy instruction `0x80` — offset zero, and through {@link wholeCopy} a
 * size of 65536 — names a whole 64 KiB base per byte of delta. Measured on node
 * 22, five hundred such bytes against a 64 KiB base took 3.4 s and 1.16 GB of
 * resident memory before answering `null`, which a few hundred bytes of an
 * untrusted pack should not be able to ask for. Checked as it goes, the same
 * delta is refused at the first instruction, and no delta can name more bytes
 * than its own header promised.
 *
 * Only a copy is bounded as it goes, and an insert is not, because only a copy
 * amplifies: an insert's bytes come out of the delta, so what the inserts
 * together can build is already bounded by the delta's own length, while one
 * byte of copy instruction names up to 65536 bytes of base. A check on the
 * insert branch would refuse the same deltas a step earlier and none of them
 * differently — it cannot change an answer, and a mutation removing it failed no
 * case, which is how it came out. An overshooting insert is refused by the
 * exactness above instead.
 *
 * That the count of instructions is also the caller's is this loop's other
 * bound, and the loop is why: see the paragraph above.
 *
 * Everything it needs is a parameter, so this closes over nothing: `d` is the
 * delta, `src` the base, and `want` the size the delta's header declares.
 *
 * @type {(d: readonly number[], src: readonly number[], at: number, want: number) => Nullable<List<readonly number[]>>}
 */
const deltaPieces = (d, src, at, want) => {
    /** @type {List<readonly number[]>} */
    let found = null
    let i = at
    let total = 0
    while (true) {
        // The instructions have to build the target exactly, so a delta that
        // stops short is refused here rather than by a length check outside:
        // one place states the rule and one place enforces it.
        if (i === d.length) { return total === want ? found : null }
        const c = d[i]
        if (c < 128) {
            // an insert of nothing is written by no encoder, and a stream of
            // them would make no progress
            if (c === 0 || i + 1 + c > d.length) { return null }
            found = concat(found)([d.slice(i + 1, i + 1 + c)])
            total += c
            i += 1 + c
            continue
        }
        const offset = selected(d, i + 1, c, 4, 0, 0)
        if (offset === null) { return null }
        const [from, afterOffset] = offset
        const size = selected(d, afterOffset, Math.floor(c / 16), 3, 0, 0)
        if (size === null) { return null }
        const [count, afterSize] = size
        const length = count === 0 ? wholeCopy : count
        if (from + length > src.length || total + length > want) { return null }
        found = concat(found)([src.slice(from, from + length)])
        total += length
        i = afterSize
    }
}

/**
 * The longest object a delta may build: what a `Vec` holds, 128 KiB.
 *
 * Not a number of this module's choosing — it is the bound the host effects
 * around it already impose on every other object, and the one
 * [`todo/inflate.md`](../../../todo/inflate.md) lifts.
 */
const maxTargetBytes = Number(maxLengthBytes)

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
 * **A target past {@link maxTargetBytes} is refused before anything is built.**
 * The instruction bound added earlier stops a delta from building *more* than it
 * declared; it does nothing about one that declares the amplification honestly.
 * A hundred bytes of copy instructions against a 64 KiB base can name 6.5 MB and
 * be telling the truth, and measured on node 22 that read raised RSS from 54 MiB
 * to 222 MiB — a byte of object costs about ten of heap here, since `Bytes` is a
 * list of numbers and the pieces are held while they are joined. Joining them
 * differently does not help: the same delta through `toArray(named).flat()`
 * instead of a list flatten runs faster, 246 ms against 747, and dies at exactly
 * the same size — under a 256 MiB heap both build 6.5 MB and neither builds 25.
 *
 * So the answer is a ceiling rather than a cleverer join, and the ceiling is the
 * one the rest of this layer already has: `inflate` and `readFile` each answer a
 * `Vec`, so a loose object over 128 KiB is refused, and so is a packed one
 * stored whole. Only a delta could exceed it, which made this the one path that
 * could build an object the reader beside it could not have read. Lifting the
 * bound is [`todo/inflate.md`](../../../todo/inflate.md), and it lifts all three
 * together.
 *
 * @throws If either input is not a list of bytes.
 *
 * @type {(base: Bytes, delta: Bytes) => Nullable<readonly number[]>}
 */
export const tryApplyDelta = (base, delta) => {
    const src = byteArray(base)
    const d = byteArray(delta)
    const sourceSize = littleVarint(d, 0, 0, 1)
    if (sourceSize === null) { return null }
    const [source, afterSource] = sourceSize
    if (source !== src.length) { return null }
    const targetSize = littleVarint(d, afterSource, 0, 1)
    if (targetSize === null) { return null }
    const [want, start] = targetSize
    if (want > maxTargetBytes) { return null }
    const named = deltaPieces(d, src, start, want)
    return named === null ? null : toArray(flat(named))
}
