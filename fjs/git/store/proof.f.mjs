/**
 * @import { Dirent, Inflate, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Oid } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { maxLengthBytes, msb, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { tryFromHex } from '../oid/module.f.mjs'
import { commitPayload, latin1, packMixed, packMixedIdx, sha256Commit, tagLoose, tagPayload } from '../testlib.f.mjs'
import { objectIdCode, objectPath, oidBytes, tryRead } from './module.f.mjs'

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

/** An id that is in that pack and has no loose file: the blob at offset 508. */
const packedId = /** @type {const} */ ('b00a3b66a7a094e6165bfcd39e0b8524042140db')

/** The zlib stream of its entry, and what the host inflates it to. */
const packedStream = toVec(packMixed.slice(510, 525))

const packedBlob = latin1(`${'y'.repeat(300)}D\n`)

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
    // A repository directory that is a root, for the `config` path below
    // one. `fjs/git/repo` answers `/` for a gitfile of `gitdir: /`, and a
    // path built by writing the separator would look for `//config` here.
    '/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
}

/** @type {(path: string) => ReturnType<typeof ioError>} */
const noFile = path => ioError({ code: 'ENOENT', message: `no such file: ${path}` })

/** @type {(n: string) => Dirent} */
const dirent = n => ({ name: n, parentPath: 'repo/objects/pack', isFile: true, isDirectory: false })

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
        const file = fs[path]
        return [[...log, `readFile ${path}`], file === undefined ? error(noFile(path)) : ok(toVec(file))]
    },
    readdir: path => log => [
        [...log, `readdir ${path}`],
        path === 'repo/objects/pack'
            ? ok([dirent(`${packName}.idx`), dirent(`${packName}.pack`)])
            : error(noFile(path)),
    ],
    stat: path => log => {
        const file = fs[path]
        return [
            [...log, `stat ${path}`],
            file === undefined
                ? error(noFile(path))
                : ok({ size: file.length, isFile: true, isDirectory: false }),
        ]
    },
    readBytes: (path, at, size) => log => {
        const file = fs[path]
        return [
            [...log, `readBytes ${path} ${at} ${size}`],
            file === undefined ? error(noFile(path)) : ok(toVec(file.slice(at, at + size))),
        ]
    },
    readWhole: path => log => {
        const file = fs[path]
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
        assertStructurallySame(log, [`readFile ${objectPath('repo')(id(tagId))}`, 'inflate'])
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
