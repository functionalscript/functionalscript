/**
 * @import { Dirent, Inflate, ReadBytes, ReadFile, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { IoChannel, IoErrorInfo } from '../../effects/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Oid } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { digestOf, of, toHex, tryFromHex } from '../oid/module.f.mjs'
import { hexBytes, latin1, packMixed, packMixedIdx } from '../testlib.f.mjs'
import { packEntryCode, packIdxCode, tryRead } from './module.f.mjs'

const toVec = u8ListToVec(msb)

const toBytes = u8List(msb)

/** How wide an id is in every fixture here, and so how long each checksum is. */
const width = /** @type {const} */ (20)

/** @type {(hex: string) => Oid} */
const id = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null)
    return i
}

/** @type {(oid: Oid) => readonly number[]} */
const idBytes = oid => toArray(toBytes(oid))

/** @type {(a: readonly number[], b: readonly number[]) => boolean} */
const same = (a, b) => a.length === b.length && a.every((v, i) => b[i] === v)

/** A big-endian 32-bit word as bytes. */
const u32 = /** @type {(v: number) => readonly number[]} */ (v => [
    Math.floor(v / 16777216) % 256,
    Math.floor(v / 65536) % 256,
    Math.floor(v / 256) % 256,
    v % 256,
])

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
        ...Array.from({ length: width }, () => 0),
    ]
    return [...bytes, ...idBytes(digestOf(width)(bytes))]
}

/** The name Git gave the pack {@link packMixed} is, and so both of its files. */
const name = /** @type {const} */ ('pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf')

const dirPath = /** @type {const} */ ('objects/pack')

const idxPath = /** @type {const} */ ('objects/pack/pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf.idx')

const packPath = /** @type {const} */ ('objects/pack/pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf.pack')

/** @type {(n: string, isFile: boolean) => Dirent} */
const dirent = (n, isFile) => ({ name: n, parentPath: dirPath, isFile, isDirectory: !isFile })

/** The listing a repository with this one pack gives. */
const listing = /** @type {readonly Dirent[]} */ ([dirent(`${name}.idx`, true)])

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

/**
 * What the host inflates each stream of {@link packMixed} to, keyed by the bytes
 * of the stream itself.
 *
 * The keys are slices of the fixture at the offsets Git put its entries at, so a
 * read whose window is even one byte off asks this host for a stream it does not
 * have and is refused — which is what pins the window as exact, and is the
 * refusal the real `inflate` gives bytes after the end of a stream. The commit at
 * offset 12 is absent because no case reads it, and an entry nothing reads is
 * never inflated.
 *
 * @type {readonly (readonly [readonly number[], readonly number[]])[]}
 */
const streams = [
    [streamAt(374, 470), tree],
    [streamAt(491, 508), hexBytes('ca01ca0190c802420a')],
    [streamAt(510, 525), yd],
    [streamAt(527, 545), hexBytes('ae02ae02b02c0102430a')],
    [streamAt(547, 561), xa],
]

/** @type {(table: readonly (readonly [readonly number[], readonly number[]])[]) => (input: readonly number[]) => Nullable<readonly number[]>} */
const inflatedBy = table => input => {
    const hit = table.find(([c]) => same(c, input))
    return hit === undefined ? null : hit[1]
}

const notFound = /** @type {(path: string) => IoChannel} */ (
    path => ioError({ code: 'ENOENT', message: `no such file: ${path}` }))

const notZlib = ioError({ code: 'Z_DATA_ERROR', message: 'incorrect header check' })

/**
 * A host over one pack directory: a listing, the files it holds, and the streams
 * it can inflate. Every command is logged, so a case can see which files were
 * opened, in what order, and which pack was never touched.
 *
 * `readBytes` answers the slice asked for and no more, as the real one does at
 * the end of a file, and `stat` answers the length the fixture has: the window
 * arithmetic is read against both.
 *
 * @type {(
 *     dir: Nullable<readonly Dirent[]>,
 *     files: (path: string) => Nullable<readonly number[]>,
 *     inflate: (input: readonly number[]) => Nullable<readonly number[]>,
 * ) => MemOperationMap<Readdir | ReadFile | Stat | ReadBytes | Inflate, readonly string[]>}
 */
const hostOf = (dir, files, inflate) => ({
    readdir: path => log => [
        [...log, `readdir ${path}`],
        dir === null ? error(notFound(path)) : ok(dir),
    ],
    readFile: path => log => {
        const b = files(path)
        return [[...log, `readFile ${path}`], b === null ? error(notFound(path)) : ok(toVec(b))]
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
            b === null ? error(notFound(path)) : ok(toVec(b.slice(at, at + size))),
        ]
    },
    inflate: v => log => {
        const b = inflate(toArray(toBytes(v)))
        return [[...log, 'inflate'], b === null ? error(notZlib) : ok(toVec(b))]
    },
})

/** The two files of the repository the fixture came from. */
const files = /** @type {(path: string) => Nullable<readonly number[]>} */ (path =>
    path === idxPath ? packMixedIdx
        : path === packPath ? packMixed
        : null)

/** The same, with another index in front of the real pack. */
const withIdx = /** @type {(idx: readonly number[]) => (path: string) => Nullable<readonly number[]>} */ (
    idx => path => path === idxPath ? idx : path === packPath ? packMixed : null)

const read = tryRead('', width)

/** @type {(host: MemOperationMap<Readdir | ReadFile | Stat | ReadBytes | Inflate, readonly string[]>, hex: string) => readonly [readonly string[], Result<Nullable<Envelope>, IoChannel>]} */
const readBy = (host, hex) => run(host)([])(read(id(hex)))

/**
 * The object a read answered, asserting that it answered one.
 *
 * @type {(r: Result<Nullable<Envelope>, IoChannel>) => Envelope}
 */
const envelope = r => {
    assert(r[0] === 'ok')
    const e = r[1]
    assert(e !== null)
    return e
}

/**
 * The error a read was refused with.
 *
 * @type {(r: Result<Nullable<Envelope>, IoChannel>) => IoErrorInfo}
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

/** The host every case over the untouched fixture uses. */
const host = hostOf(listing, files, inflatedBy(streams))

export const proof = {
    // An object stored whole, at the offset the index names: the blob at 508.
    // Four commands and no more — the directory, the index, the pack's length,
    // the one window — and then the host's inflate.
    whole: () => {
        const [log, r] = readBy(host, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), yd)
        assertEq(hashed(e), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            `readFile ${idxPath}`,
            `stat ${packPath}`,
            `readBytes ${packPath} 508 17`,
            'inflate',
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
            `readFile ${idxPath}`,
            `stat ${packPath}`,
            `readBytes ${packPath} 525 20`,
            'inflate',
            `readBytes ${packPath} 508 17`,
            'inflate',
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
            `readFile ${idxPath}`,
            `stat ${packPath}`,
            `readBytes ${packPath} 470 38`,
            'inflate',
            `readBytes ${packPath} 545 16`,
            'inflate',
        ])
    },
    // An id no pack holds is `null` and not a failure, and the pack itself is
    // never opened: the index alone answers that.
    missing: () => {
        const [log, r] = readBy(host, '0000000000000000000000000000000000000000')
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [`readdir ${dirPath}`, `readFile ${idxPath}`])
    },
    // No pack directory at all is no packs, which is the ordinary state of a
    // repository whose objects are all loose.
    noPackDir: () => {
        const [log, r] = readBy(
            hostOf(null, files, inflatedBy(streams)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [`readdir ${dirPath}`])
    },
    // Everything in the directory that is not an `.idx` file is skipped: the
    // packs, the `.rev` a newer Git writes beside them, and a directory whose
    // name ends in `.idx`, which is no file and so no index.
    otherNames: () => {
        const only = /** @type {readonly Dirent[]} */ ([
            dirent(`${name}.pack`, true),
            dirent(`${name}.rev`, true),
            dirent('nested.idx', false),
        ])
        const [log, r] = readBy(
            hostOf(only, files, inflatedBy(streams)),
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
            hostOf(two, files, inflatedBy(streams)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(hashed(envelope(r)), 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assert(!log.includes(`readFile ${dirPath}/pack-second.idx`))
    },
    // An `.idx` that is not one Git would read is a failure and not a miss: it
    // names the objects of the pack beside it, so nothing there is reachable.
    notAnIdx: () => {
        const [, r] = readBy(
            hostOf(listing, withIdx(latin1('junk')), inflatedBy(streams)),
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
            hostOf(listing, withIdx(one), inflatedBy(streams)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:561 is not where an entry begins`)
        assert(!log.some(c => c.startsWith('readBytes')))
    },
    // An index naming an offset inside the pack's own header frames no entry:
    // the byte there is a type code the format does not use.
    notAnEntry: () => {
        const one = idxOf([['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 4]])
        const [log, r] = readBy(
            hostOf(listing, withIdx(one), inflatedBy(streams)),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:4 is no pack entry`)
        // refused by the framing, and so never inflated
        assert(!log.includes('inflate'))
    },
    // A stream inflating to another length than its entry declares is refused
    // rather than answered as the object at that offset.
    sizeDisagrees: () => {
        const short = inflatedBy([[streamAt(510, 525), latin1('short')]])
        const [, r] = readBy(
            hostOf(listing, files, short),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:508 inflates to 5 bytes, not the 302 its header declares`)
    },
    // A delta its base does not fit is refused. The bytes here are the length
    // the entry declares and no delta at all, which is the shape a flipped byte
    // in a delta stream takes.
    deltaRefused: () => {
        const bogus = inflatedBy([
            [streamAt(527, 545), Array.from({ length: 10 }, () => 255)],
            [streamAt(510, 525), yd],
        ])
        const [, r] = readBy(
            hostOf(listing, files, bogus),
            'bf53712eef030d4401e03fbcf0f5a190a8026d97')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:508 holds a delta that does not apply to its base`)
    },
    // A `refDelta` whose base the pack does not hold is refused and not resolved
    // elsewhere: the base could be loose, in another pack, or nowhere, and this
    // reader cannot tell which. The index here holds the delta and one more id
    // to close its window, and not the base it names.
    baseNotInPack: () => {
        const two = idxOf([
            ['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 470],
            ['b00a3b66a7a094e6165bfcd39e0b8524042140db', 508],
        ])
        const [, r] = readBy(
            hostOf(listing, withIdx(two), inflatedBy(streams)),
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
            0x63, 8, 1, 2, 3,
            ...Array.from({ length: width }, () => 0),
        ]
        const one = idxOf([['38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85', 12]])
        const [, r] = readBy(
            hostOf(
                listing,
                path => path === idxPath ? one : path === packPath ? made : null,
                inflatedBy([[[1, 2, 3], [4, 5, 6]]])),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:12 names a base before the first entry`)
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
            hostOf(listing, withIdx(cyclic), inflatedBy(streams)),
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
        const twoDeep = idxOf(chainedIdx)
        // 302 in, 5 out: three copies from the front of the base
        const top = /** @type {readonly number[]} */ ([0xAE, 2, 5, 0x90, 2, 0x90, 2, 0x90, 1])
        const [log, r] = readBy(
            hostOf(listing, withIdx(twoDeep), inflatedBy([
                [streamAt(491, 508), top],
                [streamAt(527, 545), hexBytes('ae02ae02b02c0102430a')],
                [streamAt(510, 525), yd],
            ])),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = envelope(r)
        assertEq(e.type, 'blob')
        assertStructurallySame(toArray(e.payload), latin1('yyyyy'))
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            `readFile ${idxPath}`,
            `stat ${packPath}`,
            `readBytes ${packPath} 470 38`,
            'inflate',
            `readBytes ${packPath} 525 20`,
            'inflate',
            `readBytes ${packPath} 508 17`,
            'inflate',
        ])
    },
    // The same chain with the middle delta replaced by bytes that are no delta:
    // the first application fails, and the one after it is not attempted on
    // nothing. What comes back names the entry the base was read at, which is
    // where the chain was applied.
    chainRefusedMidway: () => {
        const twoDeep = idxOf(chainedIdx)
        const [, r] = readBy(
            hostOf(listing, withIdx(twoDeep), inflatedBy([
                [streamAt(491, 508), hexBytes('ae0205909029001001')],
                [streamAt(527, 545), Array.from({ length: 10 }, () => 255)],
                [streamAt(510, 525), yd],
            ])),
            '38bdeee4d6b597b7d1bd5c1e9e34eb2f38bf7d85')
        const e = refusal(r)
        assertEq(e.code, packEntryCode)
        assertEq(e.message, `${packPath}:508 holds a delta that does not apply to its base`)
    },
    // A pack directory that cannot be listed for a reason other than not being
    // there is the channel's: a repository whose packs cannot be read is not a
    // repository with no packs.
    dirRefused: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        /** @type {MemOperationMap<Readdir | ReadFile | Stat | ReadBytes | Inflate, readonly string[]>} */
        const host = {
            ...hostOf(listing, files, inflatedBy(streams)),
            readdir: path => log => [[...log, `readdir ${path}`], error(denied)],
        }
        const [, r] = readBy(host, 'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertStructurallySame(r, error(denied))
    },
    // An index with no pack beside it is the channel's, at the `stat` that asks
    // the pack for its length.
    packMissing: () => {
        const [log, r] = readBy(
            hostOf(listing, path => path === idxPath ? packMixedIdx : null, inflatedBy(streams)),
            'b00a3b66a7a094e6165bfcd39e0b8524042140db')
        assertEq(refusal(r).code, 'ENOENT')
        assertStructurallySame(log, [
            `readdir ${dirPath}`,
            `readFile ${idxPath}`,
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
