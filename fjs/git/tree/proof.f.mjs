/**
 * @import { Oid } from '../types.ts'
 * @import { TreeEntry } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { hole, latin1, rootTree } from '../testlib.f.mjs'
import { mode, tryRead, validate, write } from './module.f.mjs'

const read20 = tryRead(20)

const write20 = write(20)

/** @type {(payload: readonly number[]) => readonly TreeEntry[]} */
const read = payload => {
    const t = read20(payload)
    assert(t !== null)
    return t
}

/** @type {(e: TreeEntry) => readonly [string, string, string]} */
const text = e => [
    codePointListToString(e.mode),
    codePointListToString(e.name),
    toArray(u8List(msb)(e.oid)).map(b => b.toString(16).padStart(2, '0')).join(''),
]

/** An id from its hex spelling. @type {(hex: string) => Oid} */
const oid = hex => u8ListToVec(msb)(Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(2 * i, 2 * i + 2), 16)))

/** @type {(mode: string, name: string, id: string) => TreeEntry} */
const entry = (mode, name, id) => ({ mode: latin1(mode), name: latin1(name), oid: oid(id) })

const idA = '0'.repeat(40)

const idB = 'ff'.repeat(20)

export const proof = {
    // The root tree of a real commit: 27 entries in Git's order, subtrees
    // and an executable among them, each id 20 raw bytes; vouched for as
    // Git wrote it, and written back to the same bytes.
    root: () => {
        const t = read(rootTree)
        assertEq(t.length, 27)
        assertStructurallySame(text(t[0]), ['40000', '.cargo', '51790504014de60f795462ec0995fd82d6caad56'])
        assertStructurallySame(text(t[15]), ['100755', 'dev.sh', '708d1660c3d411cf99ab30a30eb3fd3a9046c9a5'])
        assertStructurallySame(text(t[26]), ['100644', 'wrangler.jsonc', 'df228e2892189a7503babfdc4b6549bee875652d'])
        assertStructurallySame([...new Set(t.map(mode))].sort(), [0o100644, 0o100755, 0o40000].sort())
        assertStructurallySame(validate(t), ['ok', t])
        assertStructurallySame(toArray(write20(t)), rootTree)
    },
    // The empty tree is no entries, and writes to no bytes.
    empty: () => {
        assertStructurallySame(read([]), [])
        assertStructurallySame(toArray(write20([])), [])
        assertStructurallySame(validate([]), ['ok', []])
    },
    // A name is bytes, and an id is every byte value.
    binary: () => {
        const payload = [...latin1('100644 '), 0xE9, 0xFF, 0x2F, 0, ...Array.from({ length: 20 }, (_, i) => i * 13 & 0xFF)]
        const [e] = read(payload)
        assertStructurallySame(toArray(e.name), [0xE9, 0xFF, 0x2F])
        assertStructurallySame(toArray(write20([e])), payload)
    },
    // The mode is the number its digits spell, padded or not.
    mode: () => {
        assertEq(mode(entry('100644', 'a', idA)), 0o100644)
        assertEq(mode(entry('0100644', 'a', idA)), 0o100644)
        assertEq(mode(entry('40000', 'a', idA)), 0o40000)
    },
    // The other id width: 32 bytes, and 20 is then cut short.
    sha256: () => {
        const payload = [...latin1('100644 a\0'), ...Array.from({ length: 32 }, () => 0xAB)]
        const [e] = tryRead(32)(payload) ?? []
        assert(e !== undefined)
        assertStructurallySame(toArray(u8List(msb)(e.oid)), Array.from({ length: 32 }, () => 0xAB))
        assertStructurallySame(toArray(write(32)([e])), payload)
        assertEq(read20(payload), null)
    },
    // Each refusal of the reader, one per condition.
    refused: () => {
        const id = Array.from({ length: 20 }, () => 1)
        for (const payload of [
            [...latin1('100644 a\0'), ...id.slice(1)],       // id cut short
            [...latin1('100644 a\0'), ...id, 0x31],          // bytes after the last entry
            [...latin1('100644 a'), ...id],                  // no NUL
            [...latin1('100644a\0'), ...id],                 // no SP
            [...latin1('100648 a\0'), ...id],                // not octal
            [...latin1(' a\0'), ...id],                      // no mode
            [...latin1('100644 \0'), ...id],                 // empty name
        ]) {
            assertEq(read20(payload), null)
        }
    },
    // The reader reads what `fsck` would flag, and `validate` is what says
    // no: one refusal per rule, naming the entry.
    validate: () => {
        assertStructurallySame(validate([entry('0100644', 'a', idA)]), ['error', 'zero-padded mode at 0'])
        assertStructurallySame(validate([entry('100664', 'a', idA)]), ['error', 'unknown mode at 0'])
        assertStructurallySame(validate([{ mode: latin1('100644'), name: [], oid: oid(idA) }]), ['error', 'empty name at 0'])
        assertStructurallySame(validate([entry('100644', 'a/b', idA)]), ['error', 'slash in name at 0'])
        assertStructurallySame(validate([entry('100644', '.', idA)]), ['error', 'dot name at 0'])
        assertStructurallySame(validate([entry('40000', '..', idA)]), ['error', 'dot name at 0'])
        assertStructurallySame(validate([entry('100644', '...', idA)])[0], 'ok')
        assertStructurallySame(validate([entry('100644', 'a', idA), entry('100644', 'a', idB)]), ['error', 'not sorted at 1'])
        assertStructurallySame(validate([entry('100644', 'b', idA), entry('100644', 'a', idB)]), ['error', 'not sorted at 1'])
        assertStructurallySame(validate([entry('100644', 'a', idA), entry('100644', 'ab', idB)])[0], 'ok')
        assertStructurallySame(validate([entry('100644', 'ab', idA), entry('100644', 'a', idB)]), ['error', 'not sorted at 1'])
        // A subtree sorts as if its name ended in `/`, which is above `.`:
        // `a.txt` comes before the subtree `a`, and after the file `a`.
        assertStructurallySame(validate([entry('100644', 'a.txt', idA), entry('40000', 'a', idB)])[0], 'ok')
        assertStructurallySame(validate([entry('40000', 'a', idB), entry('100644', 'a.txt', idA)]), ['error', 'not sorted at 1'])
        assertStructurallySame(validate([entry('100644', 'a', idA), entry('100644', 'a.txt', idB)])[0], 'ok')
        // The second problem is not reached while the first stands.
        assertStructurallySame(validate([entry('100644', 'b', idA), entry('0100644', 'a', idB)]), ['error', 'zero-padded mode at 1'])
    },
    // The writer refuses what the format cannot spell.
    write: {
        throw: {
            emptyMode: () => toArray(write20([{ mode: [], name: latin1('a'), oid: oid(idA) }])),
            notOctal: () => toArray(write20([entry('100648', 'a', idA)])),
            emptyName: () => toArray(write20([{ mode: latin1('100644'), name: [], oid: oid(idA) }])),
            nulInName: () => toArray(write20([entry('100644', 'a\0b', idA)])),
            shortId: () => toArray(write20([entry('100644', 'a', '00'.repeat(19))])),
            wideId: () => toArray(write20([entry('100644', 'a', '00'.repeat(32))])),
            nonByteInName: () => toArray(write20([{ mode: latin1('100644'), name: [0x100], oid: oid(idA) }])),
            holeInName: () => toArray(write20([{ mode: latin1('100644'), name: hole, oid: oid(idA) }])),
            modeOfNonOctal: () => mode(entry('9', 'a', idA)),
            readHole: () => read20(hole),
        },
    },
}
