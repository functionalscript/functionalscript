/**
 * The object store: from an id to the object it names, checked. A caller
 * that has an id — from a ref, from a `tree` or `parent` header, from a
 * tree entry — asks here and gets the `Envelope`, or a refusal; nothing
 * above this module spells a path under `objects/`, and nothing above it
 * trusts a file name, since every object read is hashed with
 * [`fjs/git/oid`](../oid/module.f.mjs)'s `of` and refused where the hash
 * is not the id asked for.
 *
 * Both places an object lives are read, at the repository's common
 * directory as the caller gives it — `.git` for a main worktree: the loose
 * file at {@link objectPath}, and the packs below `objects/pack/` through
 * [`fjs/git/packstore`](../packstore/module.f.mjs), which is where
 * `git clone` and `git gc` put nearly everything. Finding
 * that directory from a worktree of any kind is
 * [`fjs/git/repo`](../repo/module.f.mjs)'s `tryCommonDir`, so a caller has
 * one to give; `objects/info/alternates`, which adds directories to search
 * beside it, is the rest of
 * [`todo/object-store.md`](../todo/object-store.md).
 * Walking from a commit to the blob a path names is
 * [`fjs/git/walk`](../walk/module.f.mjs), over this reader or any other.
 *
 * **The loose file is read first, and a pack answers for it where it cannot.**
 * Git asks its packs before the loose path, so an object that is both packed
 * and loose comes from the pack — measured on Git 2.43.0: with a file of
 * garbage planted at a packed object's loose path, `git cat-file -p` printed
 * the object and only `git fsck` complained about the file. The same answers
 * come out of the other order, since an object is the same object wherever it
 * is stored and the hash below checks whichever copy answered, and this order
 * is the cheaper one: an index is hashed whole when it is opened, so asking
 * the packs first would pay that on every read of a repository whose objects
 * are loose. So anything but a good loose object — no file, no zlib stream,
 * bytes that are no object, bytes that hash to another id — tries the packs,
 * and what the loose read said stands only where no pack holds the id.
 *
 * **Reading packs widens what this asks of its host, and that is a break.** A
 * loose read needs `readFile` and `inflate`; a packed one adds exactly four —
 * `readdir` for the pack directory, `readWhole` for the index, and `stat` and
 * `readBytes` for the pack. The index is read *whole*, since its size is the
 * pack's object count and no `Vec` holds it, and that is one operation and not
 * a fold: `readWhole` opens the path once and reads it to the end, so the
 * chunks it answers are one file's. The pack beside it is read at known offsets
 * instead, which is what `stat` and `readBytes` are for: the length, then the
 * header, the trailer and one entry's window. `readFile` is not among the four —
 * neither pack file goes through it, and the loose path already needed it.
 *
 * Every one of the four is a `NodeOp`, so a program on the node runner notices
 * nothing — what has to grow is an interpreter written for exactly the old set,
 * which a mock or a partial runner is. Both of this repository's own callers
 * were such interpreters and grew four handlers each, which is the measure of
 * what an importer has to do.
 *
 * @module
 *
 * @import { Inflate, IoChannel, ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { ioError, mapStep, pureOk, resultMapStep, resultStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { join, under } from '../../path/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryOidBytes } from '../config/module.f.mjs'
import { tryRead as readLoose } from '../loose/module.f.mjs'
import { hexText, of } from '../oid/module.f.mjs'
import { packDir, tryRead as readPacked } from '../packstore/module.f.mjs'

/**
 * Where a loose object lives: `objects/`, a directory named by the first
 * two hex digits of the id, a file named by the rest.
 *
 * Joined below `dir` with {@link under} rather than by writing the
 * separator, because `dir` is the caller's and a directory that already
 * ends in one must not get another: `/` and `//` are two roots, so a `dir`
 * of `/` would otherwise name `objects/` under the UNC root instead of the
 * POSIX one.
 *
 * @type {(dir: string) => (id: Oid) => string}
 */
export const objectPath = dir => id => {
    const h = hexText(id)
    return under(dir, join('objects', h.slice(0, 2), h.slice(2)))
}

/**
 * The code an object is refused with when the bytes at its path hash to
 * another id: corruption, or a file put where it does not belong, and
 * either way not the object asked for. The channel's, beside the codes
 * the host gives a file it cannot read, since a caller that asked for an
 * object by id has one question and both are its answer.
 */
export const objectIdCode = /** @type {const} */ ('ERR_OBJECT_ID')

/**
 * The message beside {@link objectIdCode}: the path read, and the id its
 * bytes have.
 *
 * @type {(path: string, actual: string) => string}
 */
export const objectIdMessage = (path, actual) => `${path} holds the object ${actual}`

/**
 * The repository's id width, from its `config`: 20 bytes for SHA-1, 32
 * for SHA-256, or `null` where the file is one Git refuses — a format it
 * does not know, the extension under `repositoryformatversion = 0`, an
 * extension Git does not know, a boolean extension whose value is none, a
 * bad line. A `config` that cannot be read is the channel's, since a
 * directory without one is no repository.
 *
 * @type {(dir: string) => Effect<ReadFile, Nullable<OidBytes>, IoChannel>}
 */
export const oidBytes = dir => mapStep(readUtf8File(under(dir, 'config')), tryOidBytes)

/**
 * What a loose read answers, checked against the id it was asked for: the
 * object where its bytes hash to that id, `null` where they are no object,
 * and {@link objectIdCode} where they hash to another id, with the path
 * read and the id they have. An error from the read is passed on as it is.
 *
 * The id, the path and the hash come first so that the step itself closes
 * over nothing.
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, p: string, id: Oid) => (r: Result<Nullable<Envelope>, IoChannel>) => Result<Nullable<Envelope>, IoChannel>}
 */
const checkedAt = (idOf, p, id) => r => {
    const [tag, e] = r
    if (tag === 'error') { return r }
    if (e === null) { return ok(null) }
    const { type, payload } = e
    const actual = idOf(type, payload)
    return actual === id ? ok(e) : error(ioError({ code: objectIdCode, message: objectIdMessage(p, hexText(actual)) }))
}

/**
 * What a packed read answers, checked the same way, with the loose read's own
 * outcome standing where no pack holds the id.
 *
 * `loose` is a `Result` and not an error, because the three things a loose read
 * can say short of the object are three different answers and each is still the
 * answer once the packs have nothing: no file is its error, bytes that are no
 * object is `null`, and bytes of another object is {@link objectIdCode}.
 *
 * @type {(idOf: (type: ObjectType, payload: Bytes) => Oid, pd: string, id: Oid, loose: Result<Nullable<Envelope>, IoChannel>) => (r: Result<Nullable<Envelope>, IoChannel>) => Result<Nullable<Envelope>, IoChannel>}
 */
const packedOr = (idOf, pd, id, loose) => r =>
    r[0] === 'ok' && r[1] === null ? loose : checkedAt(idOf, pd, id)(r)

/**
 * Reads the object an id names, at the repository's width, and checks it: the
 * loose file at {@link objectPath} or the packs below `objects/pack/`,
 * whichever answers, hashed and given back only where the hash is the id.
 * `null` where neither holds it as an object — the loose file's bytes are no
 * object and no pack has the id; a file that cannot be read, a stream that is
 * no zlib stream, a pack that cannot answer for an id it holds, and bytes that
 * hash to another id are the channel's, the last as {@link objectIdCode}.
 *
 * Which file is read first, and what makes the other one answer, is the module
 * doc's; that a pack's own failures are not a miss is
 * [`fjs/git/packstore`](../packstore/module.f.mjs)'s.
 *
 * The width is bound first, so the hash is chosen once for a store and
 * not once per object.
 *
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (id: Oid) => Effect<Readdir | ReadFile | Stat | ReadWhole | ReadBytes | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = (dir, oidBytes) => {
    const idOf = of(oidBytes)
    const path = objectPath(dir)
    const packs = readPacked(dir, oidBytes)
    const pd = packDir(dir)
    const bits = BigInt(oidBytes) * 8n
    return id => {
        assert(length(id) === bits, ['not an id of the width', id])
        const p = path(id)
        const loose = resultMapStep(readLoose(p), checkedAt(idOf, p, id))
        return resultStep(loose, r => r[0] === 'ok' && r[1] !== null
            ? pureOk(r[1])
            : resultMapStep(packs(id), packedOr(idOf, pd, id, r)))
    }
}
