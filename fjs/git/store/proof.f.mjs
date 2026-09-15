/**
 * @import { Dirent, Inflate, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Oid } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { normalize } from '../../path/module.f.mjs'
import { msb, u8List, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { packIdxCode } from '../packstore/module.f.mjs'
import { digestOf, toHex, tryFromHex } from '../oid/module.f.mjs'
import { commitPayload, latin1, packMixed, packMixedIdx, sha256Commit, tagLoose, tagPayload } from '../testlib.f.mjs'
import { alternatesIn, maxBorrowDepth, objectIdCode, objectPath, objectsDirs, oidBytes, readIn, tryRead } from './module.f.mjs'

const toVec = u8ListToVec(msb)

/** @type {(hex: string) => Oid} */
const id = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null)
    return i
}

const tagId = /** @type {const} */ ('b79a8e25df6a75ef83c047b329e730d92ad59dec')

const commitId = /** @type {const} */ ('d2bc56a53b2d6d7c1dc0860dec10435ed479b22d')

const emptyBlobId = /** @type {const} */ ('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')

const sha256CommitId = /** @type {const} */ ('8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')

/** An id nothing is stored under. */
const missingId = /** @type {const} */ ('0123456789abcdef0123456789abcdef01234567')

/** An id whose file holds another object. */
const wrongId = /** @type {const} */ ('ffffffffffffffffffffffffffffffffffffffff')

/** An id whose file holds no object. */
const junkId = /** @type {const} */ ('1111111111111111111111111111111111111111')

const compressed = toVec(tagLoose)

const tagEnvelope = toVec(toArray(writeEnvelope('tag', tagPayload)))

/** The pack Git wrote that `repo` below keeps, and the two files it is. */
const packName = /** @type {const} */ ('pack-9a32788c2cd72bdef63b26b7320c2fc2729359bf')

/** The same without the `pack-` prefix: the pack's own trailing checksum. */
const packChecksum = /** @type {const} */ ('9a32788c2cd72bdef63b26b7320c2fc2729359bf')

/** An id that is in that pack and has no loose file: the blob at offset 508. */
const packedId = /** @type {const} */ ('b00a3b66a7a094e6165bfcd39e0b8524042140db')

/** The zlib stream of its entry, and what the host inflates it to. */
const packedStream = toVec(packMixed.slice(510, 525))

const packedBlob = latin1(`${'y'.repeat(300)}D\n`)

/**
 * A four-byte big-endian word, as both index tables are written in.
 *
 * @type {(n: number) => readonly number[]}
 */
const u32 = n => [n >> 24 & 0xFF, n >> 16 & 0xFF, n >> 8 & 0xFF, n & 0xFF]

/**
 * An id as the twenty bytes an index holds.
 *
 * @type {(hex: string) => readonly number[]}
 */
const idBytes = hex => toArray(u8List(msb)(id(hex)))

/**
 * A version 2 index over `named`, each an id and the offset its entry begins
 * at, carrying {@link packName} as the pack checksum so the pack it is put
 * beside is the pack it names.
 *
 * @type {(named: readonly (readonly [string, number])[]) => readonly number[]}
 */
const idxOf = named => {
    const ids = named.map(([h]) => idBytes(h))
    const bytes = [
        0xFF, 0x74, 0x4F, 0x63, ...u32(2),
        ...Array.from({ length: 256 }, (_, k) => u32(ids.filter(v => v[0] <= k).length)).flat(),
        ...ids.flat(),
        ...named.map(() => u32(0)).flat(),
        ...named.map(([, at]) => u32(at)).flat(),
        ...idBytes(packChecksum),
    ]
    return [...bytes, ...idBytes(codePointListToString(toHex(digestOf(20)(bytes))))]
}

/**
 * {@link packMixed} with the object count in its header replaced, because a read
 * compares the two — as Git does, which reports `claims to have N objects while
 * index indicates M objects`. A built index naming fewer objects than the
 * fixture pack holds needs the pack to agree.
 *
 * @type {(count: number) => readonly number[]}
 */
const packCounting = count => [...packMixed.slice(0, 8), ...u32(count), ...packMixed.slice(12)]

/**
 * Two repositories as files: `repo` under SHA-1, holding the signed tag as
 * Git compressed it, the merge commit and the empty blob as their plain
 * envelopes, an object under a wrong id, bytes that are no object, and one
 * pack Git wrote; `sha` under SHA-256, holding its root commit. The host
 * inflates the tag's stream and the pack entry's, and hands every other
 * buffer back as it is.
 *
 * @type {StringMap<readonly number[]>}
 */
/**
 * The spellings the module hands the host for the lenders below: an entry as the
 * alternates file writes it, joined below the borrower's `objects/` and *not*
 * folded. The host folds them, as a filesystem does.
 */
const borrowedRepo = /** @type {const} */ ('borrow/objects/../../repo/objects')

const ownRepo = /** @type {const} */ ('own/objects/../../repo/objects')

const farMid = /** @type {const} */ ('far/objects/../../mid/objects')

const midRepo = /** @type {const} */ (`${farMid}/../../repo/objects`)

const files = {
    [`repo/objects/pack/${packName}.idx`]: packMixedIdx,
    [`repo/objects/pack/${packName}.pack`]: packMixed,
    'repo/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
    [objectPath('repo')(id(tagId))]: tagLoose,
    [objectPath('repo')(id(commitId))]: toArray(writeEnvelope('commit', commitPayload)),
    [objectPath('repo')(id(emptyBlobId))]: toArray(writeEnvelope('blob', [])),
    [objectPath('repo')(id(wrongId))]: toArray(writeEnvelope('blob', [])),
    [objectPath('repo')(id(junkId))]: latin1('junk'),
    'sha/config': latin1('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n'),
    [objectPath('sha')(id(sha256CommitId))]: toArray(writeEnvelope('commit', sha256Commit)),
    'odd/config': latin1('[extensions]\n\tobjectformat = sha3\n'),
    // A borrower that holds nothing of its own and names `repo`'s objects, and
    // a lender chain behind it: `mid` borrows from `repo` and `far` from `mid`,
    // so a read through `far` reaches `repo` two hops away.
    'borrow/objects/info/alternates': latin1('../../repo/objects\n'),
    'mid/objects/info/alternates': latin1('../../repo/objects\n'),
    'far/objects/info/alternates': latin1('../../mid/objects\n'),
    // A pair naming each other, which is a cycle a reader must end rather than
    // follow: Git ends it too, measured on 2.43.0 with a borrower and a donor
    // whose alternates files name each other — `git cat-file -p` answers.
    'loopA/objects/info/alternates': latin1('../../loopB/objects\n'),
    'loopB/objects/info/alternates': latin1('../../loopA/objects\n'),
    // An alternates file naming a byte above ASCII through an octal escape,
    // which is valid UTF-8 as a file and still a path this layer cannot spell.
    'octal/objects/info/alternates': latin1('"/tmp/\\377/objects"\n'),
    // A line with text after its closing quote, which is refused.
    'suffix/objects/info/alternates': latin1('"/a/objects"junk\n'),
    // A borrower holding nothing, whose lender's pack index is not one.
    'borrowsBroken/objects/info/alternates': latin1('../../broken/objects\n'),
    // The reverse order: the borrower's *own* index is the broken one, and the
    // store it borrows from simply does not hold the object.
    'brokenBorrows/objects/info/alternates': latin1('../../sha/objects\n'),
    'brokenBorrows/objects/pack/pack-junk.idx': latin1('junk'),
    // A lender holding the tag loose and no packs at all, so what answers for it
    // is the loose read and nothing else, and a borrower holding nothing.
    'borrowsBadLoose/objects/info/alternates': latin1('../../looseOnly/objects\n'),
    [objectPath('looseOnly')(id(tagId))]: tagLoose,
    // A lender whose `.idx` names the object and whose `.pack` is gone. The
    // index has said the store holds the id, so the `ENOENT` for the pack is
    // corruption and not a store without the object — the borrower's own
    // `ENOENT`, which *is* a miss, must not displace it.
    'borrowsNoPack/objects/info/alternates': latin1('../../noPack/objects\n'),
    [`noPack/objects/pack/${packName}.idx`]: packMixedIdx,
    // Two misses that differ: the borrower's own loose file holds bytes that are
    // no object, and the lender has no file at all. The first answer stands, so
    // `null` and not the lender's `ENOENT`.
    'twoMisses/objects/info/alternates': latin1('../../sha/objects\n'),
    [objectPath('twoMisses')(id(junkId))]: latin1('junk'),
    // A borrower whose own loose file holds bytes that are no object, borrowing
    // from a store that does not hold it either.
    'shadowJunk/objects/info/alternates': latin1('../../repo/objects\n'),
    [objectPath('shadowJunk')(id(junkId))]: latin1('junk'),
    // A store naming itself by the absolute path it already has, where the
    // spelling repeats and the name ends the walk. `git clone --shared` writes
    // absolute entries, so this is the shape a repeat actually takes.
    '/abs/objects/info/alternates': latin1('/abs/objects\n'),
    // A chain of eight links, one longer than Git follows, with the tag one link
    // from the reader so the kept stores can be seen to still answer.
    ...Object.fromEntries(Array.from({ length: 8 }, (_, k) => [
        `deep${k}/objects/info/alternates`,
        latin1(`../../deep${k + 1}/objects\n`),
    ])),
    [objectPath('deep1')(id(tagId))]: tagLoose,
    // A borrower whose own copy of an object is garbage, with the good copy in
    // the store it borrows from.
    'shadow/objects/info/alternates': latin1('../../repo/objects\n'),
    [objectPath('shadow')(id(tagId))]: latin1('junk'),
    // An alternates file whose bytes are not UTF-8: a lone 0xFF, which the
    // decoder turns into `ÿ` rather than refusing, so the path it names is not
    // the path the file holds.
    'bytes/objects/info/alternates': [0xFF, 0x2F, 0x6F, 0x64],
    // A repository whose index sends `wrongId` to the entry the packed blob
    // begins at, so the pack answers with bytes that hash to another id. The
    // pack itself is the fixture's, unaltered — it is the index that lies.
    'lying/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
    // Two entries, because an entry's window ends where the next one begins: the
    // id asked for is sent to the blob at 508, and the entry at 525 is what
    // closes that window.
    [`lying/objects/pack/${packName}.idx`]: idxOf([[packedId, 525], [wrongId, 508]]),
    [`lying/objects/pack/${packName}.pack`]: packCounting(2),
    // A borrower that holds the object itself and still names a lender, so the
    // lender is never asked.
    'own/objects/info/alternates': latin1('../../repo/objects\n'),
    [objectPath('own')(id(tagId))]: tagLoose,
    // A store whose pack index is not one, which is a failure and not a miss:
    // the file names the objects of the pack beside it, so nothing there is
    // reachable.
    'broken/objects/pack/pack-junk.idx': latin1('junk'),
    // A repository directory that is a root, for the `config` path below
    // one. `fjs/git/repo` answers `/` for a gitfile of `gitdir: /`, and a
    // path built by writing the separator would look for `//config` here.
    '/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
}

/**
 * A file of the map, looked up at the path *folded* — which is what a
 * filesystem does and this map otherwise would not. The module hands paths over
 * as an alternates file writes them, `..` segments and all, so the host is where
 * they are resolved; see `alternatesIn`'s note on why folding them earlier would
 * answer about a directory nobody named.
 *
 * @type {(fs: StringMap<readonly number[]>, path: string) => readonly number[] | undefined}
 */
const at = (fs, path) => fs[normalize(path)]

/** @type {(path: string) => ReturnType<typeof ioError>} */
const noFile = path => ioError({ code: 'ENOENT', message: `no such file: ${path}` })

/** @type {(parentPath: string, n: string) => Dirent} */
const dirent = (parentPath, n) => ({ name: n, parentPath, isFile: true, isDirectory: false })

/**
 * A host over a file map: the two whole-file commands, the two the packs need,
 * and an inflater over the streams these fixtures hold.
 *
 * `readdir` lists the one pack directory there is and refuses every other path,
 * which is what a repository without one answers — `sha` and `odd` below have no
 * packs, and their reads say so through the same ENOENT.
 *
 * @type {(fs: StringMap<readonly number[]>) => MemOperationMap<ReadFile | Readdir | Stat | ReadWhole | ReadBytes | Inflate, readonly string[]>}
 */
const hostOf = fs => ({
    readFile: path => log => {
        const file = at(fs, path)
        return [[...log, `readFile ${path}`], file === undefined ? error(noFile(path)) : ok(toVec(file))]
    },
    readdir: path => log => {
        // folded for the reason `at` folds: the module hands paths over as an
        // alternates file writes them
        const d = normalize(path)
        return [
            [...log, `readdir ${path}`],
            d === 'repo/objects/pack' || d === 'lying/objects/pack'
                ? ok([dirent(path, `${packName}.idx`), dirent(path, `${packName}.pack`)])
                : d === 'broken/objects/pack' || d === 'brokenBorrows/objects/pack'
                ? ok([dirent(path, 'pack-junk.idx')])
                : d === 'noPack/objects/pack'
                ? ok([dirent(path, `${packName}.idx`)])
                : error(noFile(path)),
        ]
    },
    stat: path => log => {
        const file = at(fs, path)
        return [
            [...log, `stat ${path}`],
            file === undefined
                ? error(noFile(path))
                : ok({ size: file.length, isFile: true, isDirectory: false }),
        ]
    },
    readBytes: (path, from, size) => log => {
        const file = at(fs, path)
        return [
            [...log, `readBytes ${path} ${from} ${size}`],
            file === undefined ? error(noFile(path)) : ok(toVec(file.slice(from, from + size))),
        ]
    },
    readWhole: path => log => {
        const file = at(fs, path)
        return [
            [...log, `readWhole ${path}`],
            file === undefined ? error(noFile(path)) : ok([toVec(file)]),
        ]
    },
    inflate: data => log => [
        [...log, 'inflate'],
        ok(uint(data) === uint(compressed) ? tagEnvelope
            : uint(data) === uint(packedStream) ? toVec(packedBlob)
            : data),
    ],
})

const host = hostOf(files)

const runHost = run(host)([])

/** What reading the one pack's index costs: one operation, whatever its size. */
const idxRead = /** @type {readonly string[]} */ ([
    `readWhole repo/objects/pack/${packName}.idx`,
])

/**
 * And what checking the pack's framing against it costs: the length, the header,
 * and the trailing checksum the index recorded.
 */
const packFraming = /** @type {readonly string[]} */ ([
    `stat repo/objects/pack/${packName}.pack`,
    `readBytes repo/objects/pack/${packName}.pack 0 12`,
    `readBytes repo/objects/pack/${packName}.pack 561 20`,
])

/**
 * What looking for the store's borrowings costs: one read of a file almost no
 * repository has, before anything else. The host answers ENOENT, which is no
 * borrowing rather than a failure.
 */
const altRead = /** @type {readonly string[]} */ (['readFile repo/objects/info/alternates'])

const read = tryRead('repo', 20)

export const proof = {
    // The path: the first two hex digits name the directory, the rest the
    // file, at either width.
    path: () => {
        assertEq(objectPath('.git')(id(tagId)), '.git/objects/b7/9a8e25df6a75ef83c047b329e730d92ad59dec')
        assertEq(objectPath('r')(id(sha256CommitId)), 'r/objects/80/31c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')
    },
    // A directory that already ends in a separator does not get another,
    // which is what keeps a root's kind: `/` and `//` are the POSIX and
    // UNC roots, and a second separator would move the objects from one to
    // the other. `fjs/git/repo` answers such a directory for a gitfile of
    // `gitdir: /`, so this is the composition of the two, not a shape only
    // a test builds.
    pathAtRoot: () => {
        const h = '/objects/b7/9a8e25df6a75ef83c047b329e730d92ad59dec'
        assertEq(objectPath('/')(id(tagId)), h)
        assertEq(objectPath('//')(id(tagId)), `/${h}`)
        assertEq(objectPath('C:/')(id(tagId)), `C:${h}`)
        assertEq(objectPath('.git/')(id(tagId)), `.git${h}`)
        // A directory of no characters reads the path against the caller's
        // own directory rather than the root.
        assertEq(objectPath('')(id(tagId)), h.slice(1))
    },
    // The signed tag by its id: the loose file Git wrote, read, inflated,
    // hashed to the id asked for, and given back with its payload.
    tag: () => {
        const [log, r] = runHost(read(id(tagId)))
        assertStructurallySame(log, [...altRead, `readFile ${objectPath('repo')(id(tagId))}`, 'inflate'])
        assert(r[0] === 'ok')
        const e = r[1]
        assert(e !== null)
        assertEq(e.type, 'tag')
        assertStructurallySame(toArray(e.payload), tagPayload)
    },
    // A commit and the empty blob, each hashed to its own id.
    checked: () => {
        const [, c] = runHost(read(id(commitId)))
        assert(c[0] === 'ok' && c[1] !== null)
        assertEq(c[1].type, 'commit')
        assertStructurallySame(toArray(c[1].payload), commitPayload)
        const [, b] = runHost(read(id(emptyBlobId)))
        assert(b[0] === 'ok' && b[1] !== null)
        assertEq(b[1].type, 'blob')
        assertStructurallySame(toArray(b[1].payload), [])
    },
    // A file that holds another object than its name claims is refused,
    // with the id the bytes have in the message: a store never trusts a
    // file name.
    wrongId: () => {
        const p = objectPath('repo')(id(wrongId))
        const [log, r] = runHost(read(id(wrongId)))
        // and the packs are asked before the loose refusal stands, since a
        // packed copy would have been the answer
        assertStructurallySame(log, [
            ...altRead,
            `readFile ${p}`,
            'inflate',
            'readdir repo/objects/pack',
            ...idxRead,
        ])
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, objectIdCode)
        assertEq(e[1].message, `${p} holds the object ${emptyBlobId}`)
    },
    // A store that holds nothing reads the objects of the store it borrows from,
    // which is what `objects/info/alternates` is for. Measured on Git 2.43.0: a
    // borrower whose file names a donor's `objects/` answers `git cat-file -p`
    // for a blob only the donor holds, where the same repository without the
    // file answers `fatal: Not a valid object name`.
    //
    // The entry here is *relative*, and relative to the `objects/` directory the
    // file is in rather than to the repository or the process — measured, a
    // borrower whose file reads `../../../donor/.git/objects` reads the donor.
    borrowed: () => {
        const [log, r] = runHost(tryRead('borrow', 20)(id(tagId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'tag')
        // its own store is asked first and has nothing, then the lender's
        // every store's borrowings are resolved before any object is read, and
        // then its own store is asked first and has nothing
        assertStructurallySame(log, [
            'readFile borrow/objects/info/alternates',
            `readFile ${borrowedRepo}/info/alternates`,
            `readFile ${objectPath('borrow')(id(tagId))}`,
            'readdir borrow/objects/pack',
            `readFile ${borrowedRepo}/b7/9a8e25df6a75ef83c047b329e730d92ad59dec`,
            'inflate',
        ])
    },
    // A lender's own borrowings are followed, so a chain of stores is one store
    // to a reader. Measured on Git 2.43.0 with a three-deep chain, where the
    // outermost repository read a blob only the innermost held.
    borrowedChain: () => {
        const [, r] = runHost(tryRead('far', 20)(id(tagId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'tag')
        // and the directories are the three, in the order the chain names them
        const [, dirs] = runHost(objectsDirs('far'))
        assertStructurallySame(dirs, ok(['far/objects', farMid, midRepo]))
    },
    // Two stores naming each other end rather than loop. Git ends it too,
    // measured on 2.43.0.
    //
    // **What ends it is the depth, not the names.** Each hop spells a longer
    // path than the last — `loopA/objects/../../loopB/objects` and so on — and
    // the paths are deliberately not folded, so no string comparison sees the
    // cycle. `maxBorrowDepth` is what stops the walk, which is the guarantee
    // that holds for a cycle through a symlink too: an entry of `sub` where
    // `objects/sub` links to `objects` names a new path every hop as well, and
    // measured on Git 2.43.0 Git ends that walk rather than following it.
    borrowedCycle: () => {
        const [, dirs] = runHost(objectsDirs('loopA'))
        assert(dirs[0] === 'ok')
        // the store's own and one directory per hop to the limit
        assertEq(dirs[1].length, maxBorrowDepth + 1)
        assertEq(dirs[1][0], 'loopA/objects')
        assertEq(dirs[1][1], 'loopA/objects/../../loopB/objects')
        // and an object none of them holds is the channel's, as it is for a
        // store that borrows from nowhere
        const [, r] = runHost(tryRead('loopA', 20)(id(tagId)))
        assert(r[0] === 'error')
    },
    // A store naming *itself* by a spelling that repeats is ended by the name
    // rather than the depth: the second hop is the directory the walk started
    // at. An absolute entry is the shape that repeats — `git clone --shared`
    // writes one — since a relative entry is joined below the directory holding
    // it and so spells something longer every hop.
    borrowedSelf: () => {
        const [log, dirs] = runHost(objectsDirs('/abs'))
        assertStructurallySame(dirs, ok(['/abs/objects']))
        // and the file is read once, not once per hop
        assertStructurallySame(log, ['readFile /abs/objects/info/alternates'])
    },
    // A chain longer than Git follows is cut where Git cuts it, and the stores
    // above the cut still answer. Measured on Git 2.43.0 with chains of one to
    // nine links: six answer, and at seven `git cat-file -p` prints `error:
    // <the sixth>: ignoring alternate object stores, nesting too deep` and exits
    // 128 — while an object written into the store one link away is still read,
    // at exit 0, with the same error printed. So the tail is dropped and the
    // rest is kept, which is a bound on the walk and not a refusal.
    borrowedTooDeep: () => {
        const [, dirs] = runHost(objectsDirs('deep0'))
        assert(dirs[0] === 'ok')
        assertEq(dirs[1].length, maxBorrowDepth + 1)
        // the seventh link is where it stops: the sixth store is searched and
        // its own borrowing is not followed
        assert(!dirs[1].some(d => d.includes('deep7')))
        // and the object the store one link away holds is still answered
        const [, r] = runHost(tryRead('deep0', 20)(id(tagId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'tag')
    },
    // A borrowing that cannot be consulted contributes nothing, and does not
    // fail the store. An entry naming a regular file gives `ENOTDIR` for the
    // read of that file's own `info/alternates`; an unreadable directory gives
    // `EACCES`. Git treats both as it treats a missing one — measured on Git
    // 2.43.0 with an entry naming a regular file, `git cat-file -p` prints
    // `error: object directory <file> does not exist; check
    // .git/objects/info/alternates` and then answers the object, at exit 0.
    //
    // An earlier revision excepted only `ENOENT`, so either of these failed the
    // whole store and made a repository Git reads unreadable here.
    borrowedUnusable: () => {
        const whole = hostOf(files)
        for (const code of ['ENOTDIR', 'EACCES', 'EIO']) {
            const host = {
                ...whole,
                readFile: /** @type {typeof whole.readFile} */ (path => log => path.endsWith(`${borrowedRepo}/info/alternates`)
                    ? [[...log, `readFile ${path}`], error(ioError({ code, message: path }))]
                    : whole.readFile(path)(log)),
            }
            const [, r] = run(/** @type {typeof whole} */ (host))([])(tryRead('borrow', 20)(id(tagId)))
            // the lender is still searched; only its own borrowings are lost
            assert(r[0] === 'ok' && r[1] !== null, code)
            assertEq(r[1].type, 'tag')
        }
    },
    // An octal escape naming a byte above ASCII decodes to one *character* of
    // that value, which the host writes back as two UTF-8 bytes — so the
    // directory opened is not the one the file names. A miss and not a refusal,
    // for the reason {@link alternatesNotUtf8} gives.
    alternatesHighOctal: () => {
        assertStructurallySame(alternatesIn('od', '"/tmp/\\377/objects"'), ['/tmp/\u00FF/objects'])
        // `\177` is ASCII and spells a path this layer holds exactly
        assertStructurallySame(alternatesIn('od', '"/a\\177b"'), ['/a\x7Fb'])
        // and every other place `\377` can appear is four ordinary characters
        // Git reads as a path — measured at exit 0 for all three
        assertStructurallySame(alternatesIn('od', '# \\377\n/a/objects\n'), ['/a/objects'])
        assertStructurallySame(alternatesIn('od', '/tmp/\\377/objects'), ['/tmp/\\377/objects'])
        assertStructurallySame(alternatesIn('od', '"/a"\\377'), ['/a'])
        // a path that is simply not ASCII is already UTF-8, so the host writes
        // back the bytes it came from
        assertStructurallySame(alternatesIn('od', '/tmp/é/objects'), ['/tmp/é/objects'])
    },
    // Text after a closing quote gives the quoted path, and the second entry Git
    // makes of the remainder is not followed.
    //
    // Git's reading of that remainder is an off-by-one, measured on Git 2.43.0:
    // it becomes an entry *missing its first character*.
    // `"<donor1>"../../../donor/.git/objects` made Git look for
    // `<borrower>/objects/./../../donor/.git/objects` — one level short of what
    // is written — and fail, while sacrificing a character with
    // `"<donor1>"x../../…` made it read the donor. There is no reading of it to
    // copy, so this takes the quoted path alone; a store named only by that
    // mangled entry is one this does not reach, which
    // `todo/alternates-line-quirks.md` carries.
    //
    // An earlier revision refused the line instead. That lost the quoted store
    // too, and with it every object the borrower holds itself.
    alternatesQuotedSuffix: () => {
        const [, dirs] = runHost(objectsDirs('suffix'))
        assertStructurallySame(dirs, ok(['suffix/objects', '/a/objects']))
    },
    // A borrowed store that cannot answer for an id it holds is corruption, and
    // it outlives the repository's own miss. Reporting the `ENOENT` instead would
    // answer "no such object" for a question that was never answered — and the
    // borrower here holds no loose file, so the `ENOENT` is exactly what stood
    // before.
    //
    // Git says both, in its own way: it prints the borrowed store's failure and
    // then reports the miss. With one channel, the failure is the one worth
    // carrying.
    borrowedRefusalOutlivesAMiss: () => {
        const [, r] = runHost(tryRead('borrowsBroken', 20)(id(tagId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, packIdxCode)
    },
    // A borrowed *loose* object that cannot be read is a refusal too, not only a
    // borrowed pack's. An inflate failure, or any read the host refuses that is
    // not `ENOENT`, means the file is there and cannot be had — so it outlives
    // the repository's own miss exactly as a pack's failure does.
    //
    // An earlier revision named only the hash mismatch on this side, so a
    // borrowed store's corrupt loose object was reported as "no such object".
    // The lender here is a store with no packs, so the loose read is the whole of
    // what it says and the packed side cannot stand in for it, and the borrower
    // holds no file at all — a plain `ENOENT`, which calls no inflater, so the
    // failing stream can only be the lender's.
    borrowedLooseRefusalOutlivesAMiss: () => {
        const whole = hostOf(files)
        const noInflate = /** @type {typeof whole} */ ({
            ...whole,
            inflate: /** @type {typeof whole.inflate} */ (
                () => log => [[...log, 'inflate'], error(ioError({ code: 'Z_DATA_ERROR', message: 'bad' }))]),
        })
        const [, r] = run(noInflate)([])(tryRead('borrowsBadLoose', 20)(id(tagId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        // the lender's stream, not the borrower's `ENOENT`
        assertEq(e[1].code, 'Z_DATA_ERROR')
    },
    // On the packed side there is no `ENOENT` to spare. A `.pack` missing beside
    // a readable `.idx` that names the id is corruption — the index has already
    // said the store holds it — so it outlives the borrower's own `ENOENT`, which
    // is the same errno and an ordinary miss.
    //
    // Which side answered is the question, not which code came back: reading the
    // code alone turns this into a miss and reports the borrower's own path.
    borrowedMissingPackOutlivesAMiss: () => {
        const [, r] = runHost(tryRead('borrowsNoPack', 20)(id(packedId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
        // the lender's pack, not the borrower's loose path — and spelled as the
        // alternates file wrote it, since nothing folds a path on the way out
        assertEq(
            e[1].message,
            `no such file: borrowsNoPack/objects/../../noPack/objects/pack/${packName}.pack`)
    },
    // The same preference the other way round: a refusal in the *first*
    // directory is not displaced by a later store's miss. `kept` is order-free —
    // the object first, then a refusal, then the first answer — and a case for
    // only one order would leave the other to a mutation.
    refusalStandsOverALaterMiss: () => {
        const [, r] = runHost(tryRead('brokenBorrows', 20)(id(tagId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, packIdxCode)
    },
    // A miss in a borrowed store does not displace the repository's own answer:
    // the three things a read says short of the object are about the store that
    // was asked, not about the last store it borrows from.
    //
    // The two misses here are *different*, which is what makes the case say
    // anything: the borrower's own file holds bytes that are no object, `null`,
    // and the lender has no file at all, `ENOENT`. A case where both directories
    // answered alike would pass whichever one `kept` chose.
    borrowedMissKeepsTheFirstAnswer: () => {
        const [, r] = runHost(tryRead('twoMisses', 20)(id(junkId)))
        assertStructurallySame(r, ok(null))
        // and the lender really is asked and really does miss
        const [log] = runHost(tryRead('twoMisses', 20)(id(junkId)))
        assert(log.some(l => l.startsWith('readFile twoMisses/objects/../../sha/objects/')))
    },
    // A drive-rooted entry names a directory on its own only where the store
    // itself is drive-rooted. `C:/donor/objects` is an absolute path on Windows
    // and a directory named `C:` on POSIX, and nothing in the line says which —
    // the object directory holding the file does.
    //
    // Measured on Git 2.43.0 on POSIX: a borrower with an entry of `C:` and the
    // donor's objects copied to `objects/C:` read the blob, so the POSIX reading
    // is a directory name. Without the test, such an entry would go to the host
    // as absolute and be resolved against the *process* directory — a third
    // place, named by nobody.
    alternatesDriveRoot: () => {
        assertStructurallySame(
            alternatesIn('/home/r/objects', 'C:/donor/objects'),
            ['/home/r/objects/C:/donor/objects'])
        assertStructurallySame(
            alternatesIn('C:/r/.git/objects', 'C:/donor/objects'),
            ['C:/donor/objects'])
        // a relative store is no drive either
        assertStructurallySame(alternatesIn('od', 'C:/donor/objects'), ['od/C:/donor/objects'])
        // and a leading backslash is the same question: a separator on Windows,
        // an ordinary first character of a name on POSIX. Measured on Git
        // 2.43.0, an entry of `\\x` read objects from `objects/\\x`.
        assertStructurallySame(alternatesIn('/home/r/objects', '\\x'), ['/home/r/objects/\\x'])
        assertStructurallySame(alternatesIn('C:/r/.git/objects', '\\x'), ['\\x'])
        // and the two roots that are roots everywhere
        assertStructurallySame(alternatesIn('/home/r/objects', '/donor/objects'), ['/donor/objects'])
        assertStructurallySame(alternatesIn('/home/r/objects', '//unc/objects'), ['//unc/objects'])
        // A store on a UNC share is on Windows as surely as a drive-rooted one,
        // and `root` answers `//` for it rather than a drive — so asking only
        // whether the store's root is a drive read these two as relative names.
        assertStructurallySame(
            alternatesIn('//srv/share/r/.git/objects', 'C:/donor/objects'),
            ['C:/donor/objects'])
        assertStructurallySame(alternatesIn('//srv/share/r/.git/objects', '\\x'), ['\\x'])
    },
    // A store with no `alternates` file borrows from nowhere, which is almost
    // every repository: the missing file is no borrowing rather than a failure.
    borrowsNothing: () => {
        const [log, dirs] = runHost(objectsDirs('repo'))
        assertStructurallySame(dirs, ok(['repo/objects']))
        assertStructurallySame(log, ['readFile repo/objects/info/alternates'])
    },
    // A borrower whose own copy of an object is garbage reads the good copy from
    // the store it borrows from — the same fall-through the loose-then-packs
    // order already had, applied to directories.
    //
    // **Git stops here instead.** Measured on 2.43.0 with garbage planted at the
    // borrower's own loose path and a good copy in the alternate, `git cat-file
    // -p` answers `fatal: Not a valid object name` and exits 128, and `git fsck`
    // names the file `object corrupt or missing`. This reader goes on, which is
    // safe for the reason the loose-then-packs fall-through is safe: what comes
    // back is hashed, so a fall-through is never a wrong object, only another
    // copy of the right one. Noticing corruption is `fsck`'s job, not a reader's.
    borrowedOverJunk: () => {
        const [, r] = runHost(tryRead('shadow', 20)(id(tagId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'tag')
    },
    // A comment, a blank line and a path with no trailing newline: the three
    // shapes the file takes that are not one plain line. Every rule measured on
    // Git 2.43.0 — a `#` line prints nothing where a nonexistent directory
    // prints `error: unable to normalize alternate object path`, and a file with
    // no trailing newline names its last directory all the same.
    alternatesLines: () => {
        assertStructurallySame(
            alternatesIn('od', '# a comment\n\n../other/objects\n'),
            ['od/../other/objects'])
        assertStructurallySame(alternatesIn('od', 'a/objects'), ['od/a/objects'])
        assertStructurallySame(alternatesIn('od', ''), [])
        // a colon is not a separator: the whole line is one path, measured — Git
        // named the colon-joined string in its error
        assertStructurallySame(alternatesIn('od', 'a:b'), ['od/a:b'])
    },
    // A quoted line is C-quoted and its escapes decoded, measured: `"/no\tsuch"`
    // made Git name a directory with a real tab in it. An unterminated quote is
    // not a quoted line at all — Git took `"/some/path` verbatim, leading quote
    // included, so this does too.
    alternatesQuoting: () => {
        assertStructurallySame(alternatesIn('od', '"/a b/objects"'), ['/a b/objects'])
        assertStructurallySame(alternatesIn('od', '"/no\\tsuch"'), ['/no\tsuch'])
        assertStructurallySame(alternatesIn('od', '"/a\\101b"'), ['/aAb'])
        // and the shapes that are not a quoted line, each taken as it stands
        assertStructurallySame(alternatesIn('od', '"/unterminated'), ['od/"/unterminated'])
        // a line taken verbatim is taken as written, backslashes and all: the
        // path is no longer folded, so nothing rewrites one into a separator
        assertStructurallySame(alternatesIn('od', '"/bad\\qescape"'), ['od/"/bad\\qescape"'])
        assertStructurallySame(alternatesIn('od', '"/short\\12"'), ['od/"/short\\12"'])
        // `\\400` and above name no byte, so the unquoting fails and the line is
        // taken as it stands — measured on Git 2.43.0, `"x\\400"` read objects
        // from a directory named `"x\\400"`, quotes and all. Truncating to a byte
        // or refusing the file would each make that repository unreadable.
        assertStructurallySame(alternatesIn('od', '"x\\400"'), ['od/"x\\400"'])
        assertStructurallySame(alternatesIn('od', '"x\\777"'), ['od/"x\\777"'])
        // while `\\377` is a byte, and the one this layer cannot spell
        assertStructurallySame(alternatesIn('od', '"x\\377"'), ['od/x\u00FF'])
        // text after the closing quote gives the quoted path — see
        // {@link alternatesQuotedSuffix} for the entry Git also makes of the rest
        assertStructurallySame(alternatesIn('od', '"/after" and more'), ['/after'])
        assertStructurallySame(alternatesIn('od', '"/trailing\\'), ['od/"/trailing\\'])
    },
    // A path ends at its first `NUL`, which is the rule Git and the system call
    // both follow. Measured on Git 2.43.0 with the donor's store at
    // `<donor>/.git/objects`:
    //
    // | line | `git cat-file -p` |
    // | --- | --- |
    // | `"<donor>/objects"` | exit 0, the blob |
    // | `"<donor>/objects\000x"` | exit 0, the blob |
    // | `"<donor>/objectsx"` | exit 128 |
    // | `"<donor>/objects\001x"` | exit 128 |
    //
    // So the `\000` ends the path and the `x` behind it is never looked at,
    // while any other character is part of the name.
    //
    // **Carrying the `NUL` through would be a refusal, not a miss**, which is
    // what makes this worth doing rather than recording. Node will not hand a
    // path with one to the system call: every `fs` operation throws
    // `TypeError [ERR_INVALID_ARG_VALUE]`, `fjs/effects/node` turns that into a
    // channel error carrying the code, and `ERR_INVALID_ARG_VALUE` is not
    // `ENOENT` — so `inOne` would read it as a store that holds the object and
    // cannot give it up, and refuse the whole read of a repository Git reads.
    alternatesNul: () => {
        const nul = String.fromCharCode(0)
        assertStructurallySame(alternatesIn('od', '"/donor/objects\\000x"'), ['/donor/objects'])
        // the other road in: a raw `0x00` in a file's own bytes, which the
        // decoder gives back as the same character
        assertStructurallySame(alternatesIn('od', `donor/objects${nul}x`), ['od/donor/objects'])
        // a line with nothing before its `NUL` names no directory, so it is
        // skipped as an empty line is rather than naming the store itself
        assertStructurallySame(alternatesIn('od', '"\\000x"'), [])
        assertStructurallySame(alternatesIn('od', `${nul}x`), [])
        // and the `NUL` decides before the root does: what is left is what is
        // asked whether it stands on its own
        assertStructurallySame(alternatesIn('od', `/a${nul}/b`), ['/a'])
    },
    // An alternates file whose bytes are not UTF-8 names a directory this layer
    // cannot spell — the decoder answers `ÿ` for a lone `0xFF` — so the search
    // looks in a directory the file did not name and finds nothing there.
    //
    // A miss and not a refusal. An earlier revision refused the whole file,
    // which took a repository Git reads and made *all* of it unreadable, the
    // objects the store holds itself included, to avoid a miss on one borrowing.
    // Nothing wrong comes back either way, since the id is checked against
    // whatever answers. `todo/byte-paths.md` is what would make the two agree.
    alternatesNotUtf8: () => {
        const [, dirs] = runHost(objectsDirs('bytes'))
        // `FF 2F 6F 64` decodes to `ÿ/od`, which is the directory looked in
        assertStructurallySame(dirs, ok(['bytes/objects', 'bytes/objects/\u00FF/od']))
    },
    // Bytes a *pack* gives that hash to another id name the pack, not the
    // directory it was found in. An index that sends an id to an entry holding
    // something else is the shape: the pack here is the fixture's, unaltered,
    // and only the index lies.
    //
    // The path matters because a directory holds any number of packs and a store
    // any number of directories once `alternates` is in play, so a refusal
    // naming `…/objects/pack` says a place where it should say a file — and says
    // that the directory holds an object, which no directory does.
    packedWrongId: () => {
        const [, r] = runHost(tryRead('lying', 20)(id(wrongId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, objectIdCode)
        assertEq(
            e[1].message,
            `lying/objects/pack/${packName}.pack holds the object ${packedId}`)
    },
    // A store that holds the object itself never asks the store it borrows from:
    // the search stops at the first directory that answers, so a lender is a
    // fallback and not a second opinion.
    borrowedNotAsked: () => {
        const [log, r] = runHost(tryRead('own', 20)(id(tagId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'tag')
        // the lender's alternates file is read, since the directories are
        // resolved before any object is — but nothing of the lender's is opened
        assertStructurallySame(log, [
            'readFile own/objects/info/alternates',
            `readFile ${ownRepo}/info/alternates`,
            `readFile ${objectPath('own')(id(tagId))}`,
            'inflate',
        ])
    },
    // A pack that cannot answer for the directory it is in is the channel's, and
    // it ends the search rather than passing to the next directory: a store that
    // holds a broken index holds nothing reachable, and going on would report a
    // miss for a question that was never answered.
    packRefused: () => {
        const [, r] = runHost(tryRead('broken', 20)(id(tagId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, packIdxCode)
    },
    // A reader over no directories at all answers `null`: nothing holds the
    // object because there is nowhere for it to be. `objectsDirs` never gives an
    // empty list — a repository's own `objects/` is always the first — so this
    // is reachable only through `readIn`, which is a caller's to build.
    readInNowhere: () => {
        const [log, r] = runHost(readIn([], 20)(id(tagId)))
        assertStructurallySame(r, ok(null))
        assertStructurallySame(log, [])
    },
    // Bytes that are no object are `null`, as the loose reader says.
    notAnObject: () => {
        const [, r] = runHost(read(id(junkId)))
        assertStructurallySame(r, ['ok', null])
    },
    // A missing object is the channel's, as the host says it.
    missing: () => {
        const [, r] = runHost(read(id(missingId)))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'ENOENT')
    },
    // An object a pack holds and no loose file does: the loose read misses,
    // the pack answers, and the bytes are hashed against the id exactly as a
    // loose object's are — a caller cannot tell which file answered.
    packed: () => {
        const [log, r] = runHost(read(id(packedId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(r[1].type, 'blob')
        assertStructurallySame(toArray(r[1].payload), packedBlob)
        assertStructurallySame(log, [
            ...altRead,
            `readFile ${objectPath('repo')(id(packedId))}`,
            'readdir repo/objects/pack',
            ...idxRead,
            ...packFraming,
            `readBytes repo/objects/pack/${packName}.pack 508 17`,
            'inflate',
        ])
    },
    // A loose file that is no object does not hide the packed copy of the same
    // id. Git answers the pack there — measured on 2.43.0 with garbage planted
    // at a packed object's loose path — and so does this, with the hash check
    // standing behind whichever copy answered.
    packedOverJunkLoose: () => {
        const p = objectPath('repo')(id(packedId))
        const [log, r] = run(hostOf({ ...files, [p]: latin1('junk') }))([])(read(id(packedId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertStructurallySame(toArray(r[1].payload), packedBlob)
        assertStructurallySame(log, [
            ...altRead,
            `readFile ${p}`,
            'inflate',
            'readdir repo/objects/pack',
            ...idxRead,
            ...packFraming,
            `readBytes repo/objects/pack/${packName}.pack 508 17`,
            'inflate',
        ])
    },
    // The other width: the SHA-256 repository's commit by its 32-byte id,
    // in a store bound to that width.
    sha256: () => {
        const [, r] = runHost(tryRead('sha', 32)(id(sha256CommitId)))
        assert(r[0] === 'ok' && r[1] !== null)
        assertStructurallySame(toArray(r[1].payload), sha256Commit)
    },
    // The width from `config`: absent is 20, `sha256` is 32, a format this
    // module does not know is `null`, and no `config` is the channel's.
    oidBytes: () => {
        assertStructurallySame(runHost(oidBytes('repo'))[1], ['ok', 20])
        assertStructurallySame(runHost(oidBytes('sha'))[1], ['ok', 32])
        assertStructurallySame(runHost(oidBytes('odd'))[1], ['ok', null])
        // The `config` path is joined below the directory, not spelled with
        // a separator: at the POSIX root the file is `/config`, and
        // `//config` is a different namespace. This is the second of the two
        // paths `todo/directory-separator.md` named, and without it the
        // `${dir}/config` spelling passes every other case here.
        assertStructurallySame(runHost(oidBytes('/'))[1], ['ok', 20])
        const [log] = runHost(oidBytes('/'))
        assertStructurallySame(log, ['readFile /config'])
        const [, r] = runHost(oidBytes('none'))
        assert(r[0] === 'error')
    },
    throw: {
        // A 32-byte id in a 20-byte store is a caller's bug.
        width: () => read(id(sha256CommitId)),
    },
}
