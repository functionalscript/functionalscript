/**
 * @import { Oid } from '../types.ts'
 * @import { Idx } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { toHex, tryFromHex } from '../oid/module.f.mjs'
import { latin1, packIdx1, packIdx2 } from '../testlib.f.mjs'
import { offsetOf, tryIdx } from './module.f.mjs'

const read = tryIdx(20)

/** @type {(hex: string) => Oid} */
const id = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null)
    return i
}

/** @type {(oid: Oid) => readonly number[]} */
const idBytes = oid => toArray(u8List(msb)(oid))

/**
 * What `git verify-pack -v` reports for the pack both fixtures index: each
 * object's id and where its entry begins. Ascending by id, which is the order
 * the files store them in and not the order the pack does.
 */
const entries = /** @type {const} */ ([
    ['1881c433d8e416edcd0de9c5ee468185bc1987cd', 12],
    ['2561a62d4223eb7660d3b6b02b707048382f4019', 340],
    ['c1b0730e0133447badcfd47fd144e254807b06e1', 330],
])

/** The pack both files name, which is also the checksum in each trailer. */
const packName = /** @type {const} */ ('6565001cf42de4aac5fa4f9a260ab4588951ee17')

/** @type {(idx: Idx) => readonly (readonly [string, number])[]} */
const seen = idx => idx.ids.map((v, i) => [codePointListToString(toHex(v)), idx.offsets[i]])

/** @type {(bytes: readonly number[]) => Idx} */
const decoded = bytes => {
    const idx = read(bytes)
    assert(idx !== null)
    return idx
}

/** A big-endian 32-bit word as bytes, for the synthetic indexes below. */
const u32 = /** @type {(v: number) => readonly number[]} */ (v => [
    Math.floor(v / 16777216) % 256,
    Math.floor(v / 65536) % 256,
    Math.floor(v / 256) % 256,
    v % 256,
])

/**
 * A version 1 index over no objects: a fanout of zeros, no entries, and the
 * two checksums. Also the tail of the version 2 spelling of the same, which
 * adds only the magic and the version word in front of it.
 */
const emptyV1 = /** @type {const} */ ([
    ...Array.from({ length: 256 }, () => u32(0)).flat(),
    ...Array.from({ length: 40 }, () => 0),
])

/**
 * A version 2 index over one id, whose offset sits in the 8-byte table.
 *
 * Built rather than captured, and it is the one shape that has to be: a
 * 4-byte offset covers the first 2 GiB of a pack, so Git writes this table
 * only for a pack larger than that, which is no fixture to check in. The
 * layout around it is the captured file's, which the cases below read.
 *
 * @type {(only: Oid, offset: readonly number[]) => readonly number[]}
 */
const withLargeOffset = (only, offset) => {
    const oid = idBytes(only)
    return [
        0xFF, 0x74, 0x4F, 0x63, ...u32(2),
        // one id, whose first byte is 0x18, so the fanout steps there
        ...Array.from({ length: 256 }, (_, k) => k).flatMap(k => u32(k < oid[0] ? 0 : 1)),
        ...oid,
        ...u32(0),
        // the high bit says "an index into the table below", and it is index 0
        ...u32(0x80000000),
        ...offset,
        ...oid,
        ...oid,
    ]
}

/** @type {(bytes: readonly number[], at: number, with_: readonly number[]) => readonly number[]} */
const replaced = (bytes, at, with_) => [...bytes.slice(0, at), ...with_, ...bytes.slice(at + with_.length)]

/**
 * A version 2 index over these ids, in the order given, with a fanout that
 * counts them.
 *
 * The fanout is a count per first byte and so is right whatever order the ids
 * are in, which is what lets a case be about the order alone: the file it
 * builds disagrees with itself in exactly one way.
 *
 * @type {(ids: readonly Oid[]) => readonly number[]}
 */
const v2With = ids => {
    const firsts = ids.map(o => idBytes(o)[0])
    return [
        0xFF, 0x74, 0x4F, 0x63, ...u32(2),
        ...Array.from({ length: 256 }, (_, k) => u32(firsts.filter(v => v <= k).length)).flat(),
        ...ids.flatMap(idBytes),
        ...ids.flatMap(() => u32(0)),
        ...ids.flatMap((_, i) => u32(12 + i)),
        ...idBytes(ids[0]), ...idBytes(ids[0]),
    ]
}

const only = id('1881c433d8e416edcd0de9c5ee468185bc1987cd')

export const proof = {
    // A version 2 index as Git 2.43.0 wrote it, read against what
    // `git verify-pack -v` says is in the pack beside it. The trailer's
    // checksum is the pack's name, which is how the two files are tied
    // together.
    version2: () => {
        const idx = decoded(packIdx2)
        assertStructurallySame(seen(idx), entries)
        assertEq(codePointListToString(toHex(idx.packChecksum)), packName)
    },
    // Version 1, which Git still writes under `pack.indexVersion 1` and
    // still reads. Its layout shares only the fanout with version 2 — no
    // magic, no version word, and the offsets interleaved with the ids
    // rather than in tables of their own.
    version1: () => {
        const idx = decoded(packIdx1)
        assertStructurallySame(seen(idx), entries)
        assertEq(codePointListToString(toHex(idx.packChecksum)), packName)
    },
    // The same answer from both files, which is the point of reading them
    // into one shape: the version says how the bytes were laid out and
    // nothing about what they mean.
    sameAnswer: () => {
        assertStructurallySame(seen(decoded(packIdx1)), seen(decoded(packIdx2)))
        assertStructurallySame(
            codePointListToString(toHex(decoded(packIdx1).packChecksum)),
            codePointListToString(toHex(decoded(packIdx2).packChecksum)))
    },
    // The lookup finds every id the pack holds, at either version, and
    // answers nothing for an id it does not.
    lookup: () => {
        for (const bytes of [packIdx1, packIdx2]) {
            const at = offsetOf(decoded(bytes))
            for (const [hex, offset] of entries) {
                assertEq(at(id(hex)), offset)
            }
            // Ids below, between and above the three stored, so the search
            // misses at each end and in the middle rather than only once.
            for (const hex of [
                '0000000000000000000000000000000000000000',
                '2000000000000000000000000000000000000000',
                'ffffffffffffffffffffffffffffffffffffffff',
            ]) {
                assertEq(at(id(hex)), null)
            }
        }
    },
    // An offset in the 8-byte table, which is what the high bit of a 4-byte
    // offset means. Git writes this only for a pack over 2 GiB.
    largeOffset: () => {
        const idx = decoded(withLargeOffset(only, [...u32(0), ...u32(0x80000000)]))
        assertEq(offsetOf(idx)(only), 2147483648)
        // And one past 4 GiB, to show the high word is read and not dropped.
        const far = decoded(withLargeOffset(only, [...u32(1), ...u32(0)]))
        assertEq(offsetOf(far)(only), 4294967296)
    },
    // An 8-byte offset a `number` cannot hold exactly is refused rather than
    // rounded, because it goes on to `readBytes`, which takes a `number`.
    // 2^53 bytes is 8 PiB, so such a file is corrupt and not large.
    largeOffsetTooLarge: () => {
        assertEq(read(withLargeOffset(only, [...u32(0x00200000), ...u32(1)])), null)
        // One below the bound still reads, so the refusal is the bound's and
        // not the table's.
        assertEq(offsetOf(decoded(withLargeOffset(only, [...u32(0x001FFFFF), ...u32(0xFFFFFFFF)])))(only), 9007199254740991)
    },
    // An index of no objects: a fanout of zeros and nothing between it and
    // the checksums. The lookup answers nothing rather than searching.
    empty: () => {
        const v1 = decoded(emptyV1)
        assertStructurallySame(seen(v1), [])
        assertEq(offsetOf(v1)(only), null)
        const v2 = decoded([0xFF, 0x74, 0x4F, 0x63, ...u32(2), ...emptyV1])
        assertStructurallySame(seen(v2), [])
    },
    // A length the tables do not add up to is refused. The length is the
    // only thing that says how long the 8-byte offset table is, so it is
    // checked exactly rather than as a lower bound.
    length: () => {
        for (const bytes of [packIdx1, packIdx2]) {
            assertEq(read(bytes.slice(0, bytes.length - 1)), null)
            assertEq(read([...bytes, 0]), null)
            assertEq(read(bytes.slice(0, 100)), null)
            assertEq(read([]), null)
        }
    },
    // A version 2 word that is not 2 is refused rather than guessed at: the
    // magic says a version follows, and an unknown one is a layout this
    // reader does not know.
    version: () => {
        for (const v of [0, 1, 3, 0xFFFFFFFF]) {
            assertEq(read([...packIdx2.slice(0, 4), ...u32(v), ...packIdx2.slice(8)]), null)
        }
    },
    // A fanout that does not count the ids below it is refused. Checked and
    // not trusted, because the lookup is a search: Git leans on the order
    // without re-deriving it, so a file this refuses is one Git would read
    // and answer wrongly from.
    fanout: () => {
        // `fanout[255]` is the object count, so a wrong one misplaces every
        // table after it.
        assertEq(read(replaced(packIdx2, 8 + 255 * 4, u32(2))), null)
        // A bucket in the middle that counts an id that is not there.
        assertEq(read(replaced(packIdx2, 8 + 0x20 * 4, u32(2))), null)
        // Version 1 is checked the same way, and its fanout sits at 0 rather
        // than at 8, so the two are separate arithmetic and not one path.
        assertEq(read(replaced(packIdx1, 255 * 4, u32(2))), null)
        assertEq(read(replaced(packIdx1, 0x20 * 4, u32(2))), null)
    },
    // An offset word whose high bit says "look in the 8-byte table" but whose
    // index is past the end of it. The table's length is only implied by the
    // file's, so an index into it has to be checked against that.
    //
    // The id is chosen so the bytes just past the table — the trailer, which
    // is where an unchecked index would read — spell the valid offset 1. An
    // id with large leading bytes would spell a number above the safe bound
    // instead, and then this case would pass through *that* refusal and pin
    // nothing: it went in that way first, and removing the index check left
    // the suite green.
    largeOffsetPastTable: () => {
        const small = id('0000000000000001000000000000000000000000')
        const built = withLargeOffset(small, [...u32(0), ...u32(12)])
        // the word sits after the magic, the version, the fanout, the id and
        // the CRC
        const wordAt = 4 + 4 + 256 * 4 + 20 + 4
        assertEq(read(replaced(built, wordAt, u32(0x80000001))), null)
        // the same file with index 0 reads, so the refusal is the index's
        assertEq(offsetOf(decoded(built))(small), 12)
    },
    // Ids out of order are refused, and the case that matters is two ids
    // inside one bucket. They share a first byte, so the fanout counts them
    // correctly either way and a check of first bytes alone would pass them —
    // and the search inside a bucket is exactly where that would then miss.
    order: () => {
        const low = id('1800000000000000000000000000000000000000')
        const high = id('1800000000000000000000000000000000000001')
        const other = id('2500000000000000000000000000000000000000')
        // In order, so the shape itself is readable and the refusals below
        // are about the order and nothing else.
        assertStructurallySame(seen(decoded(v2With([low, high]))), [
            ['1800000000000000000000000000000000000000', 12],
            ['1800000000000000000000000000000000000001', 13],
        ])
        assertEq(read(v2With([high, low])), null)
        // And across buckets, where the first bytes stop ascending too.
        assertEq(read(v2With([other, low])), null)
    },
    // The width is the repository's. The same file read at the other width
    // puts the trailer in the wrong place, which the length check catches,
    // so a mismatch refuses rather than mis-parses.
    width: () => {
        for (const bytes of [packIdx1, packIdx2]) {
            assertEq(tryIdx(32)(bytes), null)
        }
    },
    throw: {
        // An id of another width than the index holds is a caller mixing two
        // repositories, not an id the pack lacks: a 20-byte and a 32-byte
        // `Vec` can have the same value through leading zeros, so answering
        // `null` would hide the bug behind a plausible miss.
        lookupWidth: () => offsetOf(decoded(packIdx2))(id('8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')),
        // The same, in an index of no objects, where every lookup misses
        // anyway. The width is the index's and not its first id's, so there
        // is something to check even here: reading it from `ids[0]` had
        // nothing to read and answered `null`, reporting a caller mixing two
        // repositories as an id the pack lacks.
        emptyLookupWidth: () =>
            offsetOf(decoded(emptyV1))(id('8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')),
        // Bytes that are no bytes, the same refusal every reader here makes.
        notBytes: () => read([256]),
    },
}
