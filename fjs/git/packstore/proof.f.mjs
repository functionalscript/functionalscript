/**
 * @import { Dirent, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { IoChannel, IoErrorInfo } from '../../effects/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Oid } from '../types.ts'
 * @import { Held } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { inflateTrailingCode, inflateTrailingMessage, notAFileCode, notAFileMessage } from '../../effects/node/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { maxLengthBytes, u8ListMsb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { digestOf, of, toHex, tryFromHex } from '../oid/module.f.mjs'
import { hex, storedBytes, streams } from '../../zlib/testlib.f.mjs'
import { hexBytes, latin1, packMixed, packMixedIdx } from '../testlib.f.mjs'
import { maxDeltaBytes } from '../pack/module.f.mjs'
import { packEntryCode, packFileCode, packIdxCode, packsIn, tryRead } from './module.f.mjs'
import { max } from '../../types/number/max/module.f.js'
import { encodeScalar } from '../../basen/base16/module.f.mjs'

/** The first 8 hex digits of a fixture id, its other 32 being zeros. */
const idPrefixHex = encodeScalar(8)

/** How many bytes of a file one chunk of a `readWhole` carries at most. */
const chunkBytes = Number(maxLengthBytes)

/**
 * A file as the chunks one open takes, each a `Vec` and so each within the cap —
 * which is what the node host's `readWhole` answers, and what makes an index
 * larger than the cap arrive in more than one piece.
 *
 * @type {(b: readonly number[]) => readonly Vec[]}
 */
const chunked = b => Array.from(
    { length: max(1, Math.ceil(b.length / chunkBytes)) },
    (_, k) => u8ListToVecMsb(b.slice(k * chunkBytes, (k + 1) * chunkBytes)))

/** How wide an id is in every fixture here, and so how long each checksum is. */
const width = /** @type {const} */ (20)

/** @type {(hex: string) => Oid} */
const id = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null)
    return i
}

/** @type {(oid: Oid) => readonly number[]} */
const idBytes = oid => toArray(u8ListMsb(oid))

/** A big-endian 32-bit word as bytes. */
const u32 = /** @type {(v: number) => readonly number[]} */ (v => [
    Math.floor(v / 0x100_0000) % 0x100,
    Math.floor(v / 0x1_0000) % 0x100,
    Math.floor(v / 0x100) % 0x100,
    v % 0x100,
])

/** The checksum {@link packMixed} ends with, which is also what Git named it. */
const packName = /** @type {const} */ ('9a32788c2cd72bdef63b26b7320c2fc2729359bf')

/** The name both of its files carry. */
const name = /** @type {const} */ ('pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf')

/**
 * A version 2 index over the ids and offsets given, ascending by id, with its
 * own checksum over it so the reader accepts it.
 *
 * Built and not captured, for the reason `packidx`'s proof builds its own: a
 * case about what a *wrong* index does to a read has no file Git would write.
 * The layout is the captured {@link packMixedIdx}'s, which every case over the
 * real pack reads instead, the CRCs are zeros because the lookup does not read
 * them, and so is the pack checksum — see the module doc on why a read does not
 * hash the pack.
 *
 * @type {(named: readonly (readonly [string, number])[]) => readonly number[]}
 */
const idxOf = named => {
    const ids = named.map(([h]) => idBytes(id(h)))
    const bytes = [
        0xFF, 0x74, 0x4F, 0x63, ...u32(2),
        ...Array.from({ length: 256 }, (_, k) => u32(ids.filter(v => v[0] <= k).length)).flat(),
        ...ids.flat(),
        ...named.map(() => u32(0)).flat(),
        ...named.map(([, at]) => u32(at)).flat(),
        // the pack's checksum, which the reader compares with the pack's own
        // trailer, so a built index has to carry the fixture's
        ...idBytes(id(packName)),
    ]
    return [...bytes, ...idBytes(digestOf(width)(bytes))]
}

/** The six objects of {@link packMixed}, each with the id it has and the offset its entry begins at. */
const objects = /** @type {readonly (readonly [string, number])[]} */ ([
    ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 470],
    ['b00a3b66a7a094e6165bfcd39e0b8524042140db', 508],
    ['bee6ca282c8d029b0e9f827d21433aa1c1c679c9', 12],
    ['bf53712eef030d4401e03fbcf0f5a190a8026d97', 525],
    ['e83defc90b8bb9314cc0933b04446ec93e205485', 545],
    ['f21ff1cae7f0e9897eef760f163b1c86a822bcb1', 372],
])

/**
 * {@link packMixed} with some of its streams replaced, and where each entry
 * begins afterwards: a swap is the offset the old stream begins at, the offset
 * it ends at, and the stream that takes its place. The entries after a longer
 * or shorter stream move by the difference, which is what `moved` answers, so a
 * case can rebuild an index over the new pack.
 *
 * The streams are real, stored ones, because the inflater that reads them is
 * real: a case that wants a delta that does not apply, or a delta of a length it
 * chooses, spells those bytes and stores them.
 *
 * @type {(swaps: readonly (readonly [number, number, readonly number[]])[]) => { readonly pack: readonly number[], readonly moved: (offset: number) => number }}
 */
const swapped = swaps => ({
    pack: [
        ...swaps.flatMap(([from, , stream], i) => [...packMixed.slice(i === 0 ? 0 : swaps[i - 1][1], from), ...stream]),
        ...packMixed.slice(swaps[swaps.length - 1][1]),
    ],
    moved: offset => offset + swaps.filter(([, to]) => to <= offset).reduce((n, [from, to, stream]) => n + stream.length - (to - from), 0),
})

/** The pack's header object count replaced. @type {(pack: readonly number[], count: number) => readonly number[]} */
const counting = (pack, count) => [...pack.slice(0, 8), ...u32(count), ...pack.slice(12)]

/** An index over the six objects, at the offsets {@link swapped} says they have moved to. @type {(moved: (offset: number) => number) => readonly number[]} */
const movedIdx = moved => idxOf(objects.map(([h, o]) => [h, moved(o)]))

/** A host over the pack directory with these two files. @type {(idx: readonly number[], pack: readonly number[]) => (path: string) => Nullable<readonly number[]>} */
const pair = (idx, pack) => path => path === idxPath ? idx : path === packPath ? pack : null

/** What checking a pack of this length costs. @type {(length: number) => readonly string[]} */
const framingOfLength = length => [`stat ${packPath}`, `readBytes ${packPath} 0 12`, `readBytes ${packPath} ${length - 20} 20`]

// Entries and packs written by hand, for the objects the fixture has none like:
// longer than a `Vec`, and deltas of a length the case chooses.

/** A size as a delta spells it: seven bits at a time, the low ones first. @type {(n: number) => readonly number[]} */
const groups = n => n < 0x80 ? [n] : [0x80 | n % 0x80, ...groups(Math.floor(n / 0x80))]

/** The header of an entry: its type code, and the length its stream inflates to. @type {(code: number, size: number) => readonly number[]} */
const entryHeader = (code, size) => size < 0x10
    ? [code * 0x10 + size]
    : [0x80 | code * 0x10 | size % 0x10, ...groups(Math.floor(size / 0x10))]

/** The groups of a distance but its last, each with a continuation bit and one less than the number before it. @type {(m: number) => readonly number[]} */
const leading = m => m < 0x80 ? [0x80 | m] : [...leading(Math.floor(m / 0x80) - 1), 0x80 | m % 0x80]

/** The distance back to an `ofsDelta`'s base, most significant group first. @type {(n: number) => readonly number[]} */
const backDistance = n => n < 0x80 ? [n] : [...leading(Math.floor(n / 0x80) - 1), n % 0x80]

/** A pack of these entries, closed by the checksum the built indexes name. @type {(entries: readonly (readonly number[])[]) => readonly number[]} */
const packOfEntries = entries => [...latin1('PACK'), ...u32(2), ...u32(entries.length), ...entries.flat(), ...idBytes(id(packName))]

/** The first of the objects here, a blob, and the second, which is a delta against it. */
const firstId = 'b00a3b66a7a094e6165bfcd39e0b8524042140db'
const secondId = 'bf53712eef030d4401e03fbcf0f5a190a8026d97'

/**
 * {@link packMixed} with the object count in its header replaced.
 *
 * A built index names fewer objects than the fixture pack holds, and the reader
 * compares the two — as Git does, which reports
 * `claims to have N objects while index indicates M objects`. So a case about
 * what a *wrong index* does to a read serves a pack whose count agrees with the
 * index it built, and the one byte that differs from Git's bytes is this one.
 *
 * @type {(count: number) => readonly number[]}
 */
const packCounting = count => [
    ...packMixed.slice(0, 8), ...u32(count), ...packMixed.slice(12),
]

/** The `objects/` directory the fixture's pack pair sits under. */
const objectsPath = /** @type {const} */ ('objects')

const dirPath = /** @type {const} */ ('objects/pack')

const idxPath = /** @type {const} */ ('objects/pack/pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf.idx')

const packPath = /** @type {const} */ ('objects/pack/pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf.pack')

/** @type {(n: string, isFile: boolean) => Dirent} */
const dirent = (n, isFile) => ({ name: n, parentPath: dirPath, isFile, isDirectory: !isFile })

/**
 * The same entry as node reports a *symlink*: neither a file nor a directory,
 * because `Dirent` does not follow one.
 *
 * @type {(n: string) => Dirent}
 */
const linked = n => ({ name: n, parentPath: dirPath, isFile: false, isDirectory: false })

/** The listing a repository with this one pack gives. */
const listing = /** @type {readonly Dirent[]} */ ([dirent(`${name}.idx`, true)])

/** The same, with the index a link rather than a file. */
const linkedListing = /** @type {readonly Dirent[]} */ ([linked(`${name}.idx`)])

/** The bytes of one entry's zlib stream, as the pack holds them. */
const streamAt = /** @type {(from: number, to: number) => readonly number[]} */ (
    (from, to) => packMixed.slice(from, to))

/** The blob at offset 545, which the `refDelta` at 470 is against. */
const xa = latin1(`${'x'.repeat(200)}A\n`)

/** The blob at offset 508, which the `ofsDelta` at 525 is against. */
const yd = latin1(`${'y'.repeat(300)}D\n`)

/** The tree at offset 372: one entry per file of the commit at 12. */
const tree = hexBytes([
    '31303036343420662e7478740038bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85313030',
    '36343420682e74787400bf53712eef030d4401e03fbcf0f5a190a8026d97313030363434',
    '20692e74787400b00a3b66a7a094e6165bfcd39e0b8524042140db',
].join(''))

const notFound = /** @type {(path: string) => IoChannel} */ (
    path => ioError({ code: 'ENOENT', message: `no such file: ${path}` }))

/**
 * A host over one pack directory: a listing and the files it holds. Every command is logged, so a case can see which files were
 * opened, in what order, and which pack was never touched.
 *
 * `readBytes` answers the slice asked for and no more, as the real one does at
 * the end of a file, and `stat` answers the length the fixture has: the window
 * arithmetic is read against both.
 *
 * @type {(
 *     dir: Nullable<readonly Dirent[]>,
 *     files: (path: string) => Nullable<readonly number[]>,
 * ) => MemOperationMap<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, readonly string[]>}
 */
const hostOf = (dir, files) => ({
    readdir: path => log => [
        [...log, `readdir ${path}`],
        dir === null ? error(notFound(path)) : ok(dir),
    ],
    readFile: path => log => {
        const b = files(path)
        return [[...log, `readFile ${path}`], b === null ? error(notFound(path)) : ok(u8ListToVecMsb(b))]
    },
    stat: path => log => {
        const b = files(path)
        return [
            [...log, `stat ${path}`],
            b === null
                ? error(notFound(path))
                : ok({ size: b.length, isFile: true, isDirectory: false }),
        ]
    },
    readBytes: (path, at, size) => log => {
        const b = files(path)
        return [
            [...log, `readBytes ${path} ${at} ${size}`],
            b === null ? error(notFound(path)) : ok(u8ListToVecMsb(b.slice(at, at + size))),
        ]
    },
    readWhole: path => log => {
        const b = files(path)
        return [
            [...log, `readWhole ${path}`],
            b === null ? error(notFound(path)) : ok(chunked(b)),
        ]
    },
})

/** The two files of the repository the fixture came from. */
const files = /** @type {(path: string) => Nullable<readonly number[]>} */ (path =>
    path === idxPath ? packMixedIdx
        : path === packPath ? packMixed
        : null)

/**
 * The same, with a built index in front of the fixture pack, and the pack's
 * header count set to the number of objects that index names — see
 * {@link packCounting} for why the count has to agree.
 *
 * @type {(idx: readonly number[], count: number) => (path: string) => Nullable<readonly number[]>}
 */
const withIdx = (idx, count) => path =>
    path === idxPath ? idx : path === packPath ? packCounting(count) : null

const read = tryRead(objectsPath, width)

/** @type {(host: MemOperationMap<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, readonly string[]>, hex: string) => readonly [readonly string[], Result<Nullable<Held>, IoChannel>]} */
const readBy = (host, hex) => run(host)([])(read(id(hex)))

/**
 * The object a read answered, asserting that it answered one.
 *
 * @type {(r: Result<Nullable<Held>, IoChannel>) => Envelope}
 */
const envelope = r => held(r).envelope

/**
 * The object *and the pack that held it*, asserting that a read answered one.
 *
 * @type {(r: Result<Nullable<Held>, IoChannel>) => Held}
 */
const held = r => {
    assert(r[0] === 'ok')
    const h = r[1]
    assert(h !== null)
    return h
}

/**
 * The error a read was refused with.
 *
 * @type {(r: Result<Nullable<Held>, IoChannel>) => IoErrorInfo}
 */
const refusal = r => {
    assert(r[0] === 'error')
    const e = r[1]
    assert(e[0] === 'ioError')
    return e[1]
}

/**
 * The id an envelope has, which is how every case here checks what it got:
 * `git verify-pack -v` named each id, and an object that hashes to one is that
 * object, whole, whatever entries were read to build it.
 *
 * @type {(e: Envelope) => string}
 */
const hashed = e => codePointListToString(toHex(of(width)(e.type, e.payload)))

/**
 * An index sending the `refDelta` at 470 to the `ofsDelta` at 525 instead of to
 * the blob at 545, which is what makes a chain of two out of a pack whose own
 * chains are one deep.
 *
 * The fourth id is not decoration: an entry's window ends where the next one
 * begins, so an index that named no offset above 525 would leave the middle
 * entry running to the pack's checksum, and the window would hold the entry
 * after it. Which id stands at 545 does not matter — no case looks it up — and
 * the ids are ascending, as the file requires.
 *
 * @type {readonly (readonly [string, number])[]}
 */
const chainedIdx = [
    ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 470],
    ['b00a3b66a7a094e6165bfcd39e0b8524042140db', 508],
    ['e83defc90b8bb9314cc0933b04446ec93e205485', 525],
    ['f21ff1cae7f0e9897eef760f163b1c86a822bcb1', 545],
]

/**
 * What reading an index costs: one operation, however long the file is. The
 * chunks a large one comes back in are the host's and not this module's, so no
 * count of them belongs in a log.
 */
const idxRead = /** @type {readonly string[]} */ ([`readWhole ${idxPath}`])

/**
 * What checking a pack's framing costs: its length, its header, and the trailing
 * checksum the index recorded.
 */
const packFraming = /** @type {readonly string[]} */ ([
    `stat ${packPath}`,
    `readBytes ${packPath} 0 12`,
    `readBytes ${packPath} 561 20`,
])

/** The host every case over the untouched fixture uses. */
const host = hostOf(listing, files)

export const proof = {
    // The exported path builder, asked directly rather than reached through a
    // read. A directory that already ends in a separator does not get another,
    // which is what keeps a root's kind: `/` and `//` are the POSIX and UNC
    // roots, and a second separator would move the packs from one to the other.
    packsIn: () => {
        assertEq(packsIn('repo/objects'), 'repo/objects/pack')
        assertEq(packsIn('/objects'), '/objects/pack')
        assertEq(packsIn('/'), '/pack')
        assertEq(packsIn('//'), '//pack')
        assertEq(packsIn('C:/'), 'C:/pack')
        assertEq(packsIn('objects/'), 'objects/pack')
        // a directory of no characters names the packs against the caller's own
        // directory rather than the root
        assertEq(packsIn(''), 'pack')
    },
    // The answer carries the pack that held the object, which is what lets
    // `fjs/git/store` name a file rather than a directory when the bytes hash to
    // another id — it is the caller that hashes, and this is the caller's only
    // way to know which of a directory's packs answered.
    heldBy: () => {
        const [, r] = readBy(hostOf(listing, files), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(held(r).path, packPath)
        assertEq(hashed(held(r).envelope), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
    },
    // An object stored whole, at the offset the index names: the blob at 508.
    // Four commands and no more — the directory, the index, the pack's length,
    // the one window — and nothing for the inflating, which is the reader's own.
    whole: () => {
        const [log, r] = readBy(host, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), yd)
        assertEq(hashed(e), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            ...idxRead,
            ...packFraming,
            `readBytes ${packPath} 508 17`,
        ])
    },
    // A tree, to show the type is the entry's and not the caller's.
    tree: () => {
        const [, r] = readBy(host, 'f21ff1cae7f0e9897eef760f163b1c86a822bcb1')
        const e = envelope(r)
        assertEq(e.type, 'tree')
        assertStructurallySame(toArray(e.payload), tree)
        assertEq(hashed(e), 'f21ff1cae7f0e9897eef760f163b1c86a822bcb1')
    },
    // An `ofsDelta`, whose base is 17 bytes back at 508: two windows, the
    // delta's and the base's, and the delta applied to what came back.
    ofsDelta: () => {
        const [log, r] = readBy(host, 'bf53712eef030d4401e03fbcf0f5a190a8026d97')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), latin1(`${'y'.repeat(300)}C\n`))
        assertEq(hashed(e), 'bf53712eef030d4401e03fbcf0f5a190a8026d97')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            ...idxRead,
            ...packFraming,
            `readBytes ${packPath} 525 20`,
            `readBytes ${packPath} 508 17`,
        ])
    },
    // A `refDelta` whose base is *after* it, at 545, which is where
    // `index-pack --fix-thin` appends a base the thin pack did not carry. That
    // the second window is at the higher offset is the whole of the case.
    refDelta: () => {
        const [log, r] = readBy(host, '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), latin1(`${'x'.repeat(200)}B\n`))
        assertEq(hashed(e), '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            ...idxRead,
            ...packFraming,
            `readBytes ${packPath} 470 38`,
            `readBytes ${packPath} 545 16`,
        ])
    },
    // An id no pack holds is `null` and not a failure, and the pack itself is
    // never opened: the index alone answers that.
    missing: () => {
        const [log, r] = readBy(host, '0000000000000000000000000000000000000000')
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [`readdir ${dirPath}`, ...idxRead])
    },
    // No pack directory at all is no packs, which is the ordinary state of a
    // repository whose objects are all loose.
    noPackDir: () => {
        const [log, r] = readBy(
            hostOf(null, files),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [`readdir ${dirPath}`])
    },
    // Everything in the directory whose name does not end in `.idx` is skipped
    // by the suffix alone: the packs and the `.rev` a newer Git writes beside
    // them, and with them a `.keep` and the partial file a fetch is still
    // writing.
    otherNames: () => {
        const only = /** @type {readonly Dirent[]} */ ([
            dirent(`${name}.pack`, true),
            dirent(`${name}.rev`, true),
        ])
        const [log, r] = readBy(
            hostOf(only, files),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [`readdir ${dirPath}`])
    },
    // The first pack holding the id answers and the next is not opened. The
    // second index here has no file behind it, so a case that opened it would
    // fail rather than pass quietly.
    firstAnswers: () => {
        const two = /** @type {readonly Dirent[]} */ ([
            dirent(`${name}.idx`, true),
            dirent('pack-second.idx', true),
        ])
        const [log, r] = readBy(
            hostOf(two, files),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(hashed(envelope(r)), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assert(!log.includes(`readFile ${dirPath}/pack-second.idx`))
    },
    // A stream that does not inflate is refused with the pack and the offset, and
    // the inflater's diagnosis carried on — not a bare error, which names neither
    // file nor entry and so tells a reader scanning several packs nothing about
    // which one is damaged.
    //
    // Git keeps both halves too. Measured on Git 2.43.0 with a byte flipped
    // inside a pack entry's zlib stream, `git cat-file -p` prints `error:
    // inflate: data stream error (incorrect header check)`, then names the
    // offset and the pack — `failed to read delta base object … at offset 12
    // from …pack` — and ends `fatal: packed object … (stored in …pack) is
    // corrupt`. The inflater's words and the file's, never one without the
    // other.
    //
    // Three ways a stream fails, each by the code the host's `inflate` gave: a
    // byte flipped in its header, an entry that ends before its stream does,
    // and an entry that runs on after it.
    entryNotZlib: () => {
        const id508 = 'b00a3b66a7a094e6165bfcd39e0b8524042140db'
        const flipped = [...packMixed.slice(0, 510), packMixed[510] ^ 1, ...packMixed.slice(511)]
        const [, bad] = readBy(hostOf(listing, pair(packMixedIdx, flipped)), id508)
        assertEq(refusal(bad).code, packEntryCode)
        assertEq(
            refusal(bad).message,
            `${packPath}:508 does not inflate: Z_DATA_ERROR invalid zlib stream`)
        // an index that says the next entry begins in the middle of the stream
        const cut = idxOf([[objects[0][0], 470], [id508, 508], ['e83defc90b8bb9314cc0933b04446ec93e205485', 520]])
        const [, short] = readBy(hostOf(listing, pair(cut, counting(packMixed, 3))), id508)
        assertEq(
            refusal(short).message,
            `${packPath}:508 does not inflate: Z_BUF_ERROR unexpected end of file`)
        // and one that says it begins after the next entry has: the bytes between
        // are the 20 of the entry at 525, which are not the stream's
        const long = idxOf([[objects[0][0], 470], [id508, 508], ['e83defc90b8bb9314cc0933b04446ec93e205485', 545]])
        const [, trailing] = readBy(hostOf(listing, pair(long, counting(packMixed, 3))), id508)
        assertEq(refusal(trailing).code, packEntryCode)
        assertEq(
            refusal(trailing).message,
            `${packPath}:508 does not inflate: ${inflateTrailingCode} ${inflateTrailingMessage(20)}`)
    },
    // An `.idx` that is not one Git would read is a failure and not a miss: it
    // names the objects of the pack beside it, so nothing there is reachable.
    notAnIdx: () => {
        const [, r] = readBy(
            hostOf(listing, withIdx(latin1('junk'), 6)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(r)
        assertEq(e.code, packIdxCode)
        assertEq(e.message, `${idxPath} is no pack index`)
    },
    // An index naming the offset the pack's trailing checksum begins at leaves
    // no room for an entry, and nothing is read there.
    noRoomForAnEntry: () => {
        const one = idxOf([['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 561]])
        const [log, r] = readBy(
            hostOf(listing, withIdx(one, 1)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:561 is not where an entry begins`)
        // the framing of the pack is read and no window into it: the refusal is
        // the index's arithmetic and happens before any entry is asked for
        assertStructurallySame(log, [`readdir ${dirPath}`, ...idxRead, ...packFraming])
    },
    // An index naming an offset inside the pack's own header frames no entry:
    // the byte there is a type code the format does not use.
    notAnEntry: () => {
        const one = idxOf([['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 4]])
        const [log, r] = readBy(
            hostOf(listing, withIdx(one, 1)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:4 is no pack entry`)
        // refused by the framing: the one window into it is all that is read
        assertEq(log.filter(c => c.startsWith(`readBytes ${packPath} 4 `)).length, 1)
    },
    // A stream inflating to another length than its entry declares is refused
    // rather than answered as the object at that offset. The header of the entry
    // at 508 says 302 bytes, in two bytes, `be 12`; this one says 318.
    sizeDisagrees: () => {
        const larger = [...packMixed.slice(0, 509), 0x13, ...packMixed.slice(510)]
        const [, r] = readBy(
            hostOf(listing, pair(packMixedIdx, larger)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:508 inflates to 302 bytes, not the 318 its header declares`)
    },
    // A delta its base does not fit is refused. The bytes here are the length
    // the entry declares and no delta at all, which is the shape a flipped byte
    // in a delta stream takes: the delta at 525 stores ten bytes of 255 where Git
    // stored the ten that copy and insert.
    deltaRefused: () => {
        const { pack, moved } = swapped([[527, 545, storedBytes(Array.from({ length: 10 }, () => 255))]])
        const [, r] = readBy(
            hostOf(listing, pair(movedIdx(moved), pack)),
            'bf53712eef030d4401e03fbcf0f5a190a8026d97')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:508 holds a delta that does not apply to its base`)
    },
    // A `refDelta` whose base the pack does not hold is refused and not resolved
    // elsewhere, which is what Git does with the same pack.
    //
    // Measured on 2.43.0 over two hand-built packs alike but for where the base
    // sits — same delta instructions, same index shape, crc32 over the entry as
    // it lies in the pack:
    //
    // | the base | `git cat-file -p <target>` |
    // | --- | --- |
    // | the pack's own first entry | exit 0, the object |
    // | loose, *and* in a second pack beside it | exit 128, `fatal: Not a valid object name` |
    //
    // The first row is the control: the same delta, read. `git fsck` calls the
    // second `failed to validate delta base reference`, so it is a broken pack
    // and not an object kept elsewhere.
    //
    // The index here holds the delta and one more id to close its window, and
    // not the base it names.
    baseNotInPack: () => {
        const two = idxOf([
            ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 470],
            ['b00a3b66a7a094e6165bfcd39e0b8524042140db', 508],
        ])
        const [, r] = readBy(
            hostOf(listing, withIdx(two, 2)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(
            e.message,
            `${packPath}:470 names a base e83defc90b8bb9314cc0933b04446ec93e205485 the pack does not hold`)
    },
    // An `ofsDelta` whose distance back reaches past the first entry names no
    // entry either. No pack Git wrote holds one, so the bytes are built: a
    // header, one entry of three bytes at offset 12 naming a base 8 back, and a
    // trailer. Eight back is offset 4, which is inside the pack's own header —
    // the bound is where the entries begin and not merely nought, and a base
    // there is refused for what it is rather than read as an entry.
    baseBeforeTheFirstEntry: () => {
        const made = [
            ...latin1('PACK'), ...u32(2), ...u32(1),
            0x63, 8, ...storedBytes([4, 5, 6]),
            // the checksum the built index names, which the reader compares
            ...idBytes(id(packName)),
        ]
        const one = idxOf([['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 12]])
        const [, r] = readBy(
            hostOf(listing, pair(one, made)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:12 names a base at 4 where no entry begins`)
    },
    // An `ofsDelta` whose distance lands *inside* another entry names no entry
    // either, and that is the case with teeth: a distance before the header is
    // obviously wrong, where one a few bytes into the entry before it is bytes an
    // attacker chooses. Framed to the next indexed offset and inflated, whatever
    // is planted there would be answered as the object if it hashed to the id.
    //
    // Git makes the same check and says so. Measured on Git 2.43.0 by moving a
    // real pack's `ofsDelta` distance six bytes into the entry before it and
    // recomputing both checksums, so the pair agrees with itself:
    //
    //   $ git index-pack --strict bad.pack   # fatal: pack has 1 unresolved delta
    //   $ git cat-file -p <the delta's id>   # error: bad offset for revindex
    //                                        # fatal: Cannot read object …
    //   $ git verify-pack -v bad.idx         # fatal: pack has 1 unresolved delta
    //
    // Its revindex is the offsets in pack order, which is what `holdsEntryAt`
    // asks. The pack below is built: an entry at 12, an `ofsDelta` at 17 naming
    // four back, and 13 is one byte inside the entry at 12.
    baseInsideAnEntry: () => {
        const stream = storedBytes([1, 2, 3])
        // the second entry begins after the first: a header byte and the stream
        const second = 12 + 1 + stream.length
        const made = [
            ...latin1('PACK'), ...u32(2), ...u32(2),
            // 12: an object of three bytes
            0x33, ...stream,
            // an `ofsDelta` of three bytes, naming a base one byte into the entry
            // above: 13 is one byte inside the entry at 12
            0x63, second - 13, ...stream,
            ...idBytes(id(packName)),
        ]
        const two = idxOf([
            ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 12],
            ['b00a3b66a7a094e6165bfcd39e0b8524042140db', second],
        ])
        const [, r] = readBy(
            hostOf(listing, pair(two, made)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:${second} names a base at 13 where no entry begins`)
    },
    // An index that is a symlink is read, which is Git's. A listing cannot say
    // what a link is — node's `Dirent` does not follow one — so a filter on
    // `isFile` dropped it, and with it every object the pack holds. Measured on
    // Git 2.43.0 with both files of a pair replaced by links into another
    // directory: `git cat-file -p` answered the blob and `git count-objects -v`
    // reported `in-pack: 4, packs: 1`.
    //
    // The `stat` is asked only for the entry the listing could not name, and it
    // follows the link without opening what it finds.
    linkedIdx: () => {
        const [log, r] = readBy(
            hostOf(linkedListing, files),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(hashed(envelope(r)), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(log.slice(0, 2), [`readdir ${dirPath}`, `stat ${idxPath}`])
    },
    // A link that leads nowhere is no pack rather than a failure, as Git's
    // listing treats one, and every other `stat` failure is the channel's: a pack
    // dropped in silence is every object in it missing.
    linkedIdxLeadsNowhere: () => {
        const [, gone] = readBy(
            hostOf(linkedListing, () => null),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(gone, ok(null))
        // A link to something that is no file — a directory, a FIFO — is not a
        // skip. An earlier revision made it one, on no rule: it was neither a
        // link leading nowhere nor a failure, so it fell between the two cases
        // into silence, and every object of the pack beside it went missing
        // without a word. Measured on Git 2.43.0 with a valid `.pack` beside
        // each, Git says so instead: a directory or a link to one gives `fatal:
        // mmap failed: No such device` at exit 128, a FIFO never returns at all,
        // and a link to `/dev/null` gives `error: index file … is too small`.
        // Only the row above, the link leading nowhere, is skipped.
        const whole = hostOf(linkedListing, files)
        const aDirectory = {
            ...whole,
            stat: /** @type {typeof whole.stat} */ (
                path => log => [[...log, `stat ${path}`], ok({ size: 0, isFile: false, isDirectory: true })]),
        }
        const [kindLog, kind] = readBy(aDirectory, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(kind)
        assertEq(e.code, notAFileCode)
        assertEq(e.message, notAFileMessage(idxPath))
        // and nothing of the pack beside it is opened after the refusal
        assertStructurallySame(kindLog, [`readdir ${dirPath}`, `stat ${idxPath}`])
        // and any other failure is the channel's
        const refused = {
            ...whole,
            stat: /** @type {typeof whole.stat} */ (
                path => log => [[...log, `stat ${path}`], error(ioError({ code: 'EIO', message: path }))]),
        }
        assertEq(refusal(readBy(refused, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')[1]).code, 'EIO')
    },
    // A directory named `*.idx` is refused by the listing alone: the kind is
    // already known, so it costs no `stat`, and it is the same refusal a link to
    // a directory takes one `stat` later. An earlier revision filtered it out
    // instead, which took the pack beside it out of the repository in silence
    // where Git answers `fatal: mmap failed: No such device` and exits 128.
    idxIsADirectory: () => {
        const asDir = /** @type {readonly Dirent[]} */ ([dirent(`${name}.idx`, false)])
        const [log, r] = readBy(
            hostOf(asDir, files),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(r)
        assertEq(e.code, notAFileCode)
        assertEq(e.message, notAFileMessage(idxPath))
        assertStructurallySame(log, [`readdir ${dirPath}`])
    },
    // A chain that comes back to an entry it has already read is refused rather
    // than followed for ever. An `ofsDelta` cannot make one — its base is behind
    // it — so the index here is built to make a `refDelta` name its own entry:
    // the base id it carries is mapped to the offset the delta itself is at.
    chainCycle: () => {
        const cyclic = idxOf([
            ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 470],
            ['b00a3b66a7a094e6165bfcd39e0b8524042140db', 508],
            ['e83defc90b8bb9314cc0933b04446ec93e205485', 470],
        ])
        const [log, r] = readBy(
            hostOf(listing, withIdx(cyclic, 3)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:470 begins a chain of more deltas than the pack's 3 objects`)
        // the bound is the pack's object count, so the one window was read as
        // many times as the pack has objects, once more, and then no more
        assertEq(log.filter(c => c === `readBytes ${packPath} 470 38`).length, 4)
    },
    // A chain of two deltas: the entry asked for, a delta whose base is itself a
    // delta, and the object both are against, read in that order and applied in
    // the reverse of it.
    //
    // The index is built and the top delta with it, because Git would not write
    // this pack: at these sizes its own delta search picks one base for every
    // version and reports `chain length = 1` for every pack it could be made to
    // write here, so a chain of two has to be spelled. The index sends the
    // `refDelta` at 470 to the `ofsDelta` at 525, whose base is the blob at 508;
    // the delta served for 470 is the nine bytes its entry declares, against a
    // source of the 302 the middle delta builds.
    chainOfTwo: () => {
        // 302 in, 5 out: three copies from the front of the base
        const top = /** @type {readonly number[]} */ ([0xAE, 2, 5, 0x90, 2, 0x90, 2, 0x90, 1])
        // the top delta's stream is the stored one, six bytes longer than the one
        // Git wrote, so everything after it moves by six
        const { pack, moved } = swapped([[491, 508, storedBytes(top)]])
        const twoDeep = idxOf(chainedIdx.map(([h, o]) => [h, moved(o)]))
        const [log, r] = readBy(
            hostOf(listing, pair(twoDeep, counting(pack, 4))),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), latin1('yyyyy'))
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            ...idxRead,
            ...framingOfLength(pack.length),
            `readBytes ${packPath} 470 ${moved(508) - 470}`,
            `readBytes ${packPath} ${moved(525)} 20`,
            `readBytes ${packPath} ${moved(508)} 17`,
        ])
    },
    // The same chain with the middle delta replaced by bytes that are no delta:
    // the first application fails, and the one after it is not attempted on
    // nothing. What comes back names the entry the base was read at, which is
    // where the chain was applied.
    chainRefusedMidway: () => {
        const { pack, moved } = swapped([
            [491, 508, storedBytes(hexBytes('ae0205909029001001'))],
            [527, 545, storedBytes(Array.from({ length: 10 }, () => 255))],
        ])
        const twoDeep = idxOf(chainedIdx.map(([h, o]) => [h, moved(o)]))
        const [, r] = readBy(
            hostOf(listing, pair(twoDeep, counting(pack, 4))),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:${moved(508)} holds a delta that does not apply to its base`)
    },
    // A pack directory that cannot be listed for a reason other than not being
    // there is the channel's: a repository whose packs cannot be read is not a
    // repository with no packs.
    dirRefused: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        /** @type {MemOperationMap<Readdir | ReadFile | Stat | ReadWhole | ReadBytes, readonly string[]>} */
        const host = {
            ...hostOf(listing, files),
            readdir: path => log => [[...log, `readdir ${path}`], error(denied)],
        }
        const [, r] = readBy(host, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(r, error(denied))
    },
    // The four ways a `.pack` can disagree with the index that named it, each
    // one Git reports when it opens the pack to read an object — measured on
    // 2.43.0 by damaging one thing at a time in a pack and asking
    // `git cat-file -p` for an object in it:
    //
    // | damage | Git |
    // | --- | --- |
    // | the signature | `is not a GIT packfile` |
    // | the version word | `is version 9 and not supported` |
    // | the object count | `claims to have 10 objects while index indicates 3 objects` |
    // | the trailing checksum | `does not match index` |
    //
    // The entry at 508 still inflates and still hashes to the id asked for in
    // every one of them, which is what makes this a refusal about the *file*
    // rather than about the object: read on, a caller would be told the
    // repository is fine.
    packFraming: () => {
        /** @type {(bytes: readonly number[]) => string} */
        const refusedFor = bytes => {
            const [, r] = readBy(
                hostOf(listing, pair(packMixedIdx, bytes)),
                'b00a3b66a7a094e6165bfcd39e0b8524042140db')
            const e = refusal(r)
            assertEq(e.code, packFileCode)
            return e.message
        }
        const flipped = /** @type {(at: number, to: number) => readonly number[]} */ (
            (at, to) => [...packMixed.slice(0, at), to, ...packMixed.slice(at + 1)])
        // the signature, and the version word
        assertEq(refusedFor(flipped(0, 0x58)), `${packPath} is no pack file`)
        assertEq(refusedFor(flipped(7, 9)), `${packPath} is no pack file`)
        // the object count, which the index's own count answers
        assertEq(
            refusedFor(packCounting(7)),
            `${packPath} holds 7 objects where its index names 6`)
        // the trailing checksum, whose byte the index recorded
        assertEq(
            refusedFor(flipped(580, 0)),
            `${packPath} does not match the index, whose pack checksum is ${packName}`)
        // and a file too short to hold a header and a checksum at all, which is
        // refused before either is read
        assertEq(
            refusedFor(packMixed.slice(0, 31)),
            `${packPath} is 31 bytes, too short to be a pack file`)
    },
    // An index larger than a `Vec` arrives in more than one chunk. A version 2
    // SHA-1 index outgrows 128 KiB at 4,643 objects — 28 bytes an object over a
    // 1,072-byte frame — and this repository's own `objects/pack` holds indexes
    // of 161,764 bytes and more, so this is the ordinary case and not an extreme
    // one.
    //
    // The index here is built at 5,000 objects, one chunk and a bit: what the
    // case pins is that the chunks are joined in order into one list and that the
    // lookup then answers from it — and that the whole file costs one operation,
    // since `readWhole` opens the path once and reads it to the end. An earlier
    // revision folded over `readBytes` instead, and paid a `stat` and a window
    // per 128 KiB for it.
    bigIdx: () => {
        // every id but the first sits at 525, which is what closes the window of
        // the entry at 508 — an index whose offsets are all one number leaves the
        // first entry running to the pack's checksum
        const many = idxOf(Array.from(
            { length: 5_000 },
            (_, k) => [`${idPrefixHex(k)}${'0'.repeat(32)}`, k === 0 ? 508 : 525]))
        assert(many.length > Number(maxLengthBytes))
        // the host hands it back in two, which is what a join has to survive
        assertEq(chunked(many).length, 2)
        const [log, r] = readBy(
            hostOf(listing, withIdx(many, 5_000)),
            `00000000${'0'.repeat(32)}`)
        assertEq(hashed(envelope(r)), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(log.slice(0, 2), [`readdir ${dirPath}`, `readWhole ${idxPath}`])
    },
    // An entry longer than a `Vec`: a blob of 300 000 bytes stored whole, which is
    // 300 035 bytes of pack, read in three windows of what a `Vec` holds and
    // inflated to as many chunks, and answered as the list over them. The host's
    // `inflate` refused it, and so did the loose path, for the same reason.
    bigWhole: () => {
        const blob = Array.from({ length: 300_000 }, (_, i) => i * 31 + 7 & 0xff)
        const pack = packOfEntries([[...entryHeader(3, blob.length), ...storedBytes(blob)]])
        const [log, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12]]), pack)), firstId)
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), blob)
        const windows = log.filter(c => c.startsWith(`readBytes ${packPath} `)).slice(2)
        assertStructurallySame(windows, [
            `readBytes ${packPath} 12 131072`,
            `readBytes ${packPath} 131084 131072`,
            `readBytes ${packPath} 262156 ${pack.length - 20 - 262_156}`,
        ])
    },
    // A delta that builds an object longer than the 128 KiB the ceiling was: 200 000
    // bytes of base, a copy of all of them and an insert of three. The base is
    // read, inflated and held dense, and the delta applied to it.
    bigDelta: () => {
        const base = Array.from({ length: 200_000 }, (_, i) => i * 17 + 3 & 0xff)
        const entry = [...entryHeader(3, base.length), ...storedBytes(base)]
        const delta = [
            ...groups(base.length), ...groups(base.length + 3),
            // a copy from the start, with the three bytes of its size, and an insert of 'abc'
            0xF0, base.length % 0x100, Math.floor(base.length / 0x100) % 0x100, Math.floor(base.length / 0x1_0000),
            3, 0x61, 0x62, 0x63,
        ]
        const second = 12 + entry.length
        const pack = packOfEntries([
            entry,
            [...entryHeader(6, delta.length), ...backDistance(entry.length), ...storedBytes(delta)],
        ])
        const [, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12], [secondId, second]]), pack)), secondId)
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), [...base, 0x61, 0x62, 0x63])
    },
    // A delta, and a base it is applied to, are held to the ceiling by the size
    // their entries declare, before anything is inflated: the entry asked for
    // here, and the base two entries behind it.
    deltaCeiling: () => {
        const stream = storedBytes([1])
        const over = maxDeltaBytes + 1
        const delta = [...entryHeader(6, over), ...backDistance(8), ...stream]
        const [, deltaRefused] = readBy(hostOf(listing, pair(idxOf([[firstId, 12]]), packOfEntries([delta]))), firstId)
        assertEq(refusal(deltaRefused).code, packEntryCode)
        assertEq(
            refusal(deltaRefused).message,
            `${packPath}:12 declares ${over} bytes, more than the ${maxDeltaBytes} a delta chain is built from`)
        // a base that declares too much, reached through a delta of its own
        const base = [...entryHeader(3, over), ...stream]
        const small = storedBytes([4, 4, 0, 0])
        const second = 12 + base.length
        const pack = packOfEntries([base, [...entryHeader(6, 4), ...backDistance(base.length), ...small]])
        const [, baseRefused] = readBy(hostOf(listing, pair(idxOf([[firstId, 12], [secondId, second]]), pack)), secondId)
        assertEq(
            refusal(baseRefused).message,
            `${packPath}:12 declares ${over} bytes, more than the ${maxDeltaBytes - 4} a delta chain is built from`)
    },
    // The ceiling is the chain's, not each entry's: every delta is held until the
    // base is reached, so a base that fits alone is refused when what the deltas
    // before it hold leaves no room, and the refusal says how much room there was.
    chainCeiling: () => {
        const base = [...entryHeader(3, maxDeltaBytes - 50), ...storedBytes([1])]
        const delta = [...entryHeader(6, 100), ...backDistance(base.length), ...storedBytes(Array.from({ length: 100 }, () => 0))]
        const pack = packOfEntries([base, delta])
        const [, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12], [secondId, 12 + base.length]]), pack)), secondId)
        assertEq(refusal(r).code, packEntryCode)
        assertEq(
            refusal(r).message,
            `${packPath}:12 declares ${maxDeltaBytes - 50} bytes, more than the ${maxDeltaBytes - 100} a delta chain is built from`)
    },
    // The ceiling is a delta chain's and not an object's: an object stored whole
    // that declares more than `maxDeltaBytes` is not refused for it, and is read
    // like any other — here its stream holds one byte, so it is refused for
    // disagreeing with its header, which is the next check and a different one.
    wholeAboveTheCeiling: () => {
        const over = maxDeltaBytes + 1
        const pack = packOfEntries([[...entryHeader(3, over), ...storedBytes([1])]])
        const [, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12]]), pack)), firstId)
        assertEq(refusal(r).code, packEntryCode)
        assertEq(refusal(r).message, `${packPath}:12 inflates to 1 bytes, not the ${over} its header declares`)
    },
    // The windows of an entry are not counted up front: the index says how far an
    // entry reaches, and a pack file can be as long as a disk. Over a pack that
    // claims 2 ** 50 bytes (its ends are real, the middle is a hole every read
    // fails in), the first window is read, and the second, which the hole fails,
    // is the channel's refusal; a list of 2 ** 33 offsets built first would not
    // be an array at all.
    windowsAreLazy: () => {
        const bytes = packOfEntries([[...entryHeader(3, 1), ...storedBytes([1])]])
        const files = pair(idxOf([[firstId, 12]]), bytes)
        const size = 2 ** 50
        const base = hostOf(listing, files)
        const host = {
            ...base,
            stat: (/** @type {string} */ path) => (/** @type {readonly string[]} */ log) =>
                path === packPath
                    ? /** @type {const} */ ([[...log, `stat ${path}`], ok({ size, isFile: true, isDirectory: false })])
                    : base.stat(path)(log),
            readBytes: (/** @type {string} */ path, /** @type {number} */ at, /** @type {number} */ n) => (/** @type {readonly string[]} */ log) =>
                path !== packPath || at < bytes.length
                    ? base.readBytes(path, at, n)(log)
                    : at === size - 20
                        ? /** @type {const} */ ([[...log, `readBytes ${path} ${at} ${n}`], ok(u8ListToVecMsb(bytes.slice(-20)))])
                        : /** @type {const} */ ([[...log, `readBytes ${path} ${at} ${n}`], error(ioError({ code: 'EIO', message: 'a hole' }))]),
        }
        const [, r] = readBy(host, firstId)
        assertEq(refusal(r).code, 'EIO')
    },
    // A header whose size varint runs past the first window is refused, and said
    // to be: the zero groups are legal to the parser, but no encoder writes them.
    headerPastTheWindow: () => {
        const entry = [0xb0, ...Array.from({ length: 0x2_0000 }, () => 0x80), 0, ...storedBytes([1])]
        const [, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12]]), packOfEntries([entry]))), firstId)
        assertEq(refusal(r).code, packEntryCode)
        assertEq(refusal(r).message, `${packPath}:12 has no entry header in its first ${0x2_0000} bytes`)
    },
    // A stream is not read on once it has made more than its header declares: this
    // one is 300 000 zeros under a header that says five, and the first window of
    // it is the last that is read.
    inflatesToMore: () => {
        const pack = packOfEntries([[...entryHeader(3, 5), ...hex(streams.zeros)]])
        const [log, r] = readBy(hostOf(listing, pair(idxOf([[firstId, 12]]), pack)), firstId)
        assertEq(refusal(r).code, packEntryCode)
        assertEq(refusal(r).message, `${packPath}:12 inflates to more than the 5 its header declares`)
        assertEq(log.filter(c => c.startsWith(`readBytes ${packPath} `)).length, 3)
    },
    // An index with no pack beside it is the channel's, at the `stat` that asks
    // the pack for its length.
    packMissing: () => {
        const [log, r] = readBy(
            hostOf(listing, path => path === idxPath ? packMixedIdx : null),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(refusal(r).code, 'ENOENT')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            ...idxRead,
            `stat ${packPath}`,
        ])
    },
    throw: {
        // An id of another width than the store was built for is a caller
        // mixing two repositories, not an object the packs lack.
        width: () => readBy(
            host,
            '8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f'),
    },
}
