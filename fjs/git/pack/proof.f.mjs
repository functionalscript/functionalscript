/**
 * @import { Oid } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { msb, u8List } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { of, toHex, tryFromHex } from '../oid/module.f.mjs'
import {
    latin1, packDelta, packDeltaBase, packEntryObject, packEntryOfsDelta, packHeader,
} from '../testlib.f.mjs'
import { tryApplyDelta, tryEntry, tryHeader } from './module.f.mjs'

const entry = tryEntry(20)

const idOf = of(20)

/** @type {(hex: string) => Oid} */
const id = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null)
    return i
}

/** @type {(oid: Oid) => string} */
const hex = oid => codePointListToString(toHex(oid))

/** @type {(oid: Oid) => readonly number[]} */
const idBytes = oid => toArray(u8List(msb)(oid))

/** The commit the delta's base is, as `git verify-pack -v` names it. */
const baseId = /** @type {const} */ ('bba8d20c99a645a8a98620700c15ff9262574c94')

/** The commit the delta builds, as the same listing names it. */
const targetId = /** @type {const} */ ('6b031e456ef1c7522e0b088db90655bef54da841')

/**
 * What is left of a size after the first byte's four bits, as seven-bit groups
 * least significant first, each but the last with its top bit set.
 *
 * @type {(rest: number) => readonly number[]}
 */
const sizeTail = rest =>
    rest === 0
        ? []
        : [...(rest < 128 ? [rest] : [rest % 128 + 128]), ...sizeTail(Math.floor(rest / 128))]

/**
 * An entry header built from a type code and a size, for the cases a real pack
 * does not happen to contain.
 *
 * The size goes out four bits at a time first and then seven at a time, which
 * is the encoding {@link tryEntry} reads and the reason a hand-written case is
 * worth having: the fixtures cover two shapes and this covers the boundaries
 * between one byte and two.
 *
 * @type {(code: number, size: number) => readonly number[]}
 */
const header = (code, size) => {
    const tail = sizeTail(Math.floor(size / 16))
    return [code * 16 + size % 16 + (tail.length === 0 ? 0 : 128), ...tail]
}

export const proof = {
    // The header of a pack Git 2.43.0 wrote.
    header: () => {
        assertStructurallySame(tryHeader(packHeader), { version: 2, count: 18 })
    },
    // Not a pack: a signature that is not `PACK`, too few bytes, and a version
    // this does not read. Version 3 is refused rather than read as 2 would be,
    // since a layout this does not know is not one to guess at.
    headerRefused: () => {
        assertEq(tryHeader([...latin1('PACX'), ...packHeader.slice(4)]), null)
        assertEq(tryHeader(packHeader.slice(0, 11)), null)
        assertEq(tryHeader([]), null)
        for (const v of [0, 1, 3, 4]) {
            assertEq(tryHeader([...packHeader.slice(0, 4), 0, 0, 0, v, ...packHeader.slice(8)]), null)
        }
    },
    // The first entry of that pack: a whole commit of 475 bytes, whose stream
    // begins two bytes in.
    entryObject: () => {
        assertStructurallySame(entry(packEntryObject), {
            kind: 'object', type: 'commit', size: 475, dataAt: 2,
        })
    },
    // The `ofsDelta` entry at offset 726. Its size is the *delta's* 152 bytes
    // and not the 427 of the object the delta builds, which is the column
    // `git verify-pack -v` prints too. Its distance back is 360, so its base
    // is the entry at 366 — the id that listing names as the base.
    entryOfsDelta: () => {
        assertStructurallySame(entry(packEntryOfsDelta), {
            kind: 'ofsDelta', size: 152, baseBack: 360, dataAt: 4,
        })
        assertEq(726 - 360, 366)
    },
    // The builder above agrees with both captured headers, which is what makes
    // the hand-written cases below evidence about the same encoding.
    builder: () => {
        assertStructurallySame(header(1, 475), [...packEntryObject.slice(0, 2)])
        assertStructurallySame(header(6, 152), [...packEntryOfsDelta.slice(0, 2)])
    },
    // Sizes either side of the one-byte boundary. The first byte carries four
    // bits, so 15 fits and 16 does not, and the groups after it carry seven.
    entrySizes: () => {
        for (const size of [0, 1, 15, 16, 17, 127, 128, 2047, 2048, 1048576]) {
            const e = entry([...header(3, size), 0x78, 0x01])
            assert(e !== null && e.kind === 'object')
            assertEq(e.size, size)
        }
    },
    // A `refDelta` names its base by id rather than by distance. Git 2.43.0
    // writes this only into a thin pack, and would not write one here — a
    // forced repack with `pack.useOfsDelta=false` reused the existing pack,
    // and a thin pack of one commit came out with no delta at all — so the
    // bytes are built. The id is the same base the captured delta has.
    entryRefDelta: () => {
        const base = id(baseId)
        const e = entry([...header(7, 152), ...idBytes(base), 0x78, 0x01])
        assert(e !== null && e.kind === 'refDelta')
        assertEq(e.size, 152)
        assertEq(hex(e.baseId), baseId)
        assertEq(e.dataAt, 2 + 20)
    },
    // Type codes 0 and 5 are unused and reserved, so an entry claiming either
    // is refused rather than read as some other kind.
    entryRefused: () => {
        for (const code of [0, 5]) {
            assertEq(entry([...header(code, 10), 0x78, 0x01]), null)
        }
        assertEq(entry([]), null)
        // a size varint that never ends
        assertEq(entry([0x9F, 0x80, 0x80]), null)
        // a `refDelta` whose id the bytes are too short to hold
        assertEq(entry([...header(7, 1), ...Array.from({ length: 19 }, () => 0)]), null)
        // an `ofsDelta` whose distance back runs off the end
        assertEq(entry([...header(6, 1), 0x80]), null)
        // and one whose distance back is zero, which would make it its own base
        assertEq(entry([...header(6, 1), 0x00]), null)
    },
    // A varint past what a `number` holds exactly is refused rather than
    // rounded, in both encodings. These become lengths and offsets that go on
    // to `readBytes`, which takes a `number`, and 2^53 bytes is 8 PiB, so such
    // an entry is corrupt and not large.
    entryVarintTooLarge: () => {
        const continued = Array.from({ length: 9 }, () => 0xFF)
        // a size that keeps going: type 3 with the continuation bit set, so
        // `0x80` for the bit, `0x30` for the code and `0x0F` for four size bits
        assertEq(entry([0xBF, ...continued, 0x7F]), null)
        // a distance back that keeps going
        assertEq(entry([...header(6, 1), ...continued, 0x7F]), null)
    },
    // The delta from that pack applied to its base, checked by hashing rather
    // than against a stored copy: the result is the commit
    // `6b031e45…`, which is the id `git verify-pack -v` gives the entry, so a
    // wrong byte anywhere gives a different id.
    applyDelta: () => {
        // the base is the object its own id says it is, so the delta is being
        // applied to what Git applied it to
        assertEq(hex(idOf('commit', packDeltaBase)), baseId)
        const out = tryApplyDelta(packDeltaBase, packDelta)
        assert(out !== null)
        assertEq(out.length, 427)
        assertEq(hex(idOf('commit', out)), targetId)
    },
    // Both sizes in a delta's header are checked. The source size says which
    // base the delta was made against, so a base of another length is refused
    // rather than half-applied, and the target size is the only statement of
    // what the result should be.
    applyDeltaSizes: () => {
        assertEq(tryApplyDelta([...packDeltaBase, 0], packDelta), null)
        assertEq(tryApplyDelta(packDeltaBase.slice(0, 474), packDelta), null)
        // a target size one too large, with the instructions unchanged
        const [, ...rest] = packDelta.slice(2)
        assertEq(tryApplyDelta(packDeltaBase, [...packDelta.slice(0, 2), packDelta[2] + 1, ...rest]), null)
    },
    // A copy of size zero means 65536, the one number the format spells by
    // leaving every size byte out. Built, because a real delta only copies
    // that much from a base at least that long.
    applyDeltaWholeCopy: () => {
        const base = Array.from({ length: 65536 }, (_, i) => i % 251)
        // source 65536, target 65536, then one copy with no offset or size byte
        const delta = [0x80, 0x80, 0x04, 0x80, 0x80, 0x04, 0x80]
        const out = tryApplyDelta(base, delta)
        assert(out !== null)
        assertStructurallySame(out.length, 65536)
        assertEq(out.every((v, i) => v === base[i]), true)
    },
    // An instruction that cannot be followed refuses the whole delta rather
    // than answering what it managed: an insert of zero, which no encoder
    // writes and which would make a stream stand still; an insert or a copy
    // running off the end; and a copy from outside the base.
    applyDeltaRefused: () => {
        const base = [1, 2, 3, 4]
        /** @type {(instructions: readonly number[]) => readonly number[]} */
        const d = instructions => [4, 4, ...instructions]
        // An insert of zero, followed by instructions that do build the whole
        // target. Without the tail the delta would be refused for building too
        // little, and the case would pass whether or not the zero itself is
        // refused — it went in that way first and the mutation proved it.
        assertEq(tryApplyDelta(base, d([0x00, 0x90, 4])), null)
        // an insert whose bytes are not all there
        assertEq(tryApplyDelta(base, d([0x03, 1, 2])), null)
        // A copy running one byte past the end of the base, with a target size
        // of what the truncated copy would produce. Stated that way for the
        // same reason as above: with a target size of four, the short result
        // would be refused for its length and the copy's own bound would go
        // untested.
        assertEq(tryApplyDelta(base, [4, 1, 0x91, 3, 2]), null)
        // a copy whose size bytes are missing
        assertEq(tryApplyDelta(base, d([0x91, 3])), null)
        // instructions that build fewer bytes than the target size claims
        assertEq(tryApplyDelta(base, d([0x02, 9, 9])), null)
        // a copy whose offset bytes are missing, where the size bytes above
        // were present
        assertEq(tryApplyDelta(base, d([0x81])), null)
        // a target size that runs off the end, before any instruction
        assertEq(tryApplyDelta(base, [4, 0x80]), null)
        // and the one that works, so the refusals above are each about their
        // own fault
        assertStructurallySame(tryApplyDelta(base, d([0x90, 4])), [1, 2, 3, 4])
    },
    throw: {
        // Bytes that are no bytes, the same refusal every reader here makes.
        headerNotBytes: () => tryHeader([256]),
        entryNotBytes: () => entry([256]),
        deltaBaseNotBytes: () => tryApplyDelta([256], packDelta),
        deltaNotBytes: () => tryApplyDelta(packDeltaBase, [256]),
    },
}
