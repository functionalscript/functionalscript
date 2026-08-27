/**
 * `vnd.fjs.lock` — a lock map as a BLOB of its own, so several revisions can
 * point at one agreed resolution instead of each carrying a copy.
 *
 * `vnd.fjs.revision`'s `lock` is an inline map, which keeps a revision
 * interpretable in isolation but re-serializes the whole map into a new blob
 * every time anything else about the revision changes — CAS deduplicates whole
 * blobs, not fragments. This dialect is that map, alone: no `subject`,
 * `parents`, `generation`, or `archived`, because it is a **value**, not a
 * step. History for lock content, when someone wants it, is an ordinary
 * revision whose `snapshot` is one of these blobs, so no second history
 * mechanism appears and `revision` stays the only one.
 *
 * The `lock` schema and its semantic check are **imported** from
 * `fjs/media/revision`, not restated: one recursive schema, one hash check,
 * one canonical serialization, so a map means the same thing inline and shared
 * and the two forms cannot drift (`proof.f.mjs` pins the bytes).
 *
 * Like its sibling, this module is the pure format only: the rtti schema, the
 * `dialect` tag, and decode/validate. Whether a referenced blob exists, and
 * what its bindings mean once fetched, stay a resolver's business.
 *
 * See `README.md` for the full spec.
 *
 * @module
 *
 * @import { Unknown } from '../json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { DialectEntry } from '../types.ts'
 * @import { Lock, LockError } from './types.ts'
 */

import { open } from '../../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.mjs'
import { parse as parseJson, stringify } from '../json/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.mjs'
import { dialectEntry } from '../module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { lock, lockMapError } from '../revision/module.f.mjs'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = /** @type {const} */ ('vnd.fjs.lock')

/** The media type derived from {@link dialect}: `application/vnd.fjs.lock+json`. */
export const mediaType = /** @type {const} */ (`application/${dialect}+json`)

/**
 * rtti schema for a `lock` BLOB: the dialect tag and the map.
 *
 * `open`, and deliberately so: a bare struct is closed, so an older reader
 * would reject a blob a newer writer had added a field to, and the versioning
 * rule in `../revision/README.md` — additive extension keeps the tag — needs
 * that older reader to accept it. Do not drop the wrapper.
 *
 * `lock` is `fjs/media/revision`'s own schema, so the shared form admits
 * exactly the maps the inline form does, to the same depth, with the same
 * value domain.
 *
 * The field is **required** and may be `{}`: an absent map and an empty one
 * would otherwise be two spellings of one blob, and a blob whose only purpose
 * is to hold a map has nothing to say when it does not. It is also never a
 * hash — a lock blob does not reference further lock blobs (see the README's
 * [Composition](./README.md#composition)), so following a reference always
 * terminates in one step.
 */
export const lockSchema = open(/** @type {const} */ ({
    dialect,
    lock,
}))

/** Serializes a lock blob canonically, recursively sorting every object's property names.
 * @type {(lock: Lock) => string}
 */
export const encodeText = stringify(sort)

/** Structural-only validator: checks the shape, not the hash semantics. */
const validateShape = rttiParse(lockSchema)

/**
 * Checks the semantic refinement the structural schema can't express on an
 * already shape-valid lock blob: every direct value at every depth of the map
 * must decode as a cbase32 hash. This is `fjs/media/revision`'s own
 * `lockMapError`, so a map rejected inline is rejected here and vice versa.
 *
 * Exported separately from {@link validate} for callers holding an
 * already-typed `Lock` — the same split, for the same reason, as the revision
 * dialect's `checkReferences`.
 *
 * @type {(l: Lock) => Result<Lock, string>}
 */
export const checkReferences = l => {
    const message = lockMapError(l.lock)
    return message === null ? ok(l) : error(message)
}

/**
 * Validates an already-parsed JSON value as a `lock` BLOB: structural (rtti)
 * validation followed by the hash semantic check.
 *
 * @type {(value: Unknown) => Result<Lock, LockError>}
 */
export const validate = value => okThen(checkReferences)(validateShape(value))

/**
 * Decodes `text` as a `lock` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a lock blob, regardless of key order or whitespace.
 *
 * @type {(text: string) => Result<Lock, LockError>}
 */
export const decodeText = text => okThen(validate)(parseJson(text))

/** {@link checkReferences} as the `boolean` refinement a {@link DialectEntry} takes.
 * @type {(l: Lock) => boolean}
 */
const isValidLock = l => {
    const [tag] = checkReferences(l)
    return tag === 'ok'
}

/**
 * This dialect as a registry entry for `fjs/media`'s `detect`. It carries the
 * semantic check too, so a blob is detected as `vnd.fjs.lock` exactly when
 * {@link decodeText} would accept it.
 *
 * @type {DialectEntry}
 */
export const lockDialect = dialectEntry(lockSchema, isValidLock)
