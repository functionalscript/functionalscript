/**
 * @import { Inflate, ReadFile } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Oid } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { msb, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { write as writeEnvelope } from '../object/module.f.mjs'
import { tryFromHex } from '../oid/module.f.mjs'
import { commitPayload, latin1, sha256Commit, tagLoose, tagPayload } from '../testlib.f.mjs'
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

/**
 * Two repositories as files: `repo` under SHA-1, holding the signed tag as
 * Git compressed it, the merge commit and the empty blob as their plain
 * envelopes, an object under a wrong id, and bytes that are no object;
 * `sha` under SHA-256, holding its root commit. The host inflates the one
 * real stream and hands every other buffer back as it is.
 *
 * @type {Readonly<Record<string, readonly number[]>>}
 */
const files = {
    'repo/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
    [objectPath('repo')(id(tagId))]: tagLoose,
    [objectPath('repo')(id(commitId))]: toArray(writeEnvelope('commit', commitPayload)),
    [objectPath('repo')(id(emptyBlobId))]: toArray(writeEnvelope('blob', [])),
    [objectPath('repo')(id(wrongId))]: toArray(writeEnvelope('blob', [])),
    [objectPath('repo')(id(junkId))]: latin1('junk'),
    'sha/config': latin1('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n'),
    [objectPath('sha')(id(sha256CommitId))]: toArray(writeEnvelope('commit', sha256Commit)),
    'odd/config': latin1('[extensions]\n\tobjectformat = sha3\n'),
}

/** @type {MemOperationMap<ReadFile | Inflate, readonly string[]>} */
const host = {
    readFile: path => log => {
        const file = files[path]
        return [
            [...log, `readFile ${path}`],
            file === undefined ? error(ioError({ code: 'ENOENT', message: `no such file: ${path}` })) : ok(toVec(file)),
        ]
    },
    inflate: data => log => [[...log, 'inflate'], ok(uint(data) === uint(compressed) ? tagEnvelope : data)],
}

const runHost = run(host)([])

const read = tryRead('repo', 20)

export const proof = {
    // The path: the first two hex digits name the directory, the rest the
    // file, at either width.
    path: () => {
        assertEq(objectPath('.git')(id(tagId)), '.git/objects/b7/9a8e25df6a75ef83c047b329e730d92ad59dec')
        assertEq(objectPath('r')(id(sha256CommitId)), 'r/objects/80/31c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')
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
        assertStructurallySame(log, [`readFile ${p}`, 'inflate'])
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
        const [, r] = runHost(oidBytes('none'))
        assert(r[0] === 'error')
    },
    throw: {
        // A 32-byte id in a 20-byte store is a caller's bug.
        width: () => read(id(sha256CommitId)),
    },
}
