/**
 * The object store: from an id to the object it names, checked. A caller
 * that has an id — from a ref, from a `tree` or `parent` header, from a
 * tree entry — asks here and gets the `Envelope`, or a refusal; nothing
 * above this module spells a path under `objects/`, and nothing above it
 * trusts a file name, since every object read is hashed with
 * [`fjs/git/oid`](../oid/module.f.mjs)'s `of` and refused where the hash
 * is not the id asked for.
 *
 * This first cut reads loose objects only, at the repository's common
 * directory as the caller gives it — `.git` for a main worktree — and
 * reads a fresh clone poorly, since `git clone` and `git gc` put most
 * objects in packs: [`todo/packfiles.md`](../todo/packfiles.md). A linked
 * worktree's `gitdir` and `commondir` files, `objects/info/alternates`,
 * and the walk from a commit to a blob are the rest of
 * [`todo/object-store.md`](../todo/object-store.md).
 *
 * @module
 *
 * @import { Inflate, IoChannel, ReadFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../object/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { ioError, mapStep, resultMapStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryOidBytes } from '../config/module.f.mjs'
import { tryRead as readLoose } from '../loose/module.f.mjs'
import { of, toHex } from '../oid/module.f.mjs'

/** @type {(id: Oid) => string} */
const hex = id => codePointListToString(toHex(id))

/**
 * Where a loose object lives: `objects/`, a directory named by the first
 * two hex digits of the id, a file named by the rest.
 *
 * @type {(dir: string) => (id: Oid) => string}
 */
export const objectPath = dir => id => {
    const h = hex(id)
    return `${dir}/objects/${h.slice(0, 2)}/${h.slice(2)}`
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
export const oidBytes = dir => mapStep(readUtf8File(`${dir}/config`), tryOidBytes)

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
    return actual === id ? ok(e) : error(ioError({ code: objectIdCode, message: objectIdMessage(p, hex(actual)) }))
}

/**
 * Reads the object an id names, at the repository's width, and checks it:
 * the loose file at {@link objectPath}, inflated and past its envelope,
 * then hashed, and given back only where the hash is the id. `null` where
 * the file's bytes are no object; a file that cannot be read, or is no
 * zlib stream, or hashes to another id, is the channel's, the last as
 * {@link objectIdCode}.
 *
 * The width is bound first, so the hash is chosen once for a store and
 * not once per object.
 *
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (id: Oid) => Effect<ReadFile | Inflate, Nullable<Envelope>, IoChannel>}
 */
export const tryRead = (dir, oidBytes) => {
    const idOf = of(oidBytes)
    const path = objectPath(dir)
    const bits = BigInt(oidBytes) * 8n
    return id => {
        assert(length(id) === bits, ['not an id of the width', id])
        const p = path(id)
        return resultMapStep(readLoose(p), checkedAt(idOf, p, id))
    }
}
