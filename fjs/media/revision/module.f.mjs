/**
 * `vnd.fjs.revision` — one step in the evolution of a mutable object on top
 * of an immutable content-addressable store.
 *
 * A revision BLOB links back to its parent revision(s) (a DAG, not just a
 * chain, so concurrent edits can merge) and carries the full materialized
 * content of that step — never an incremental diff (see the versioning rule
 * in the README). This module is the pure format only: the rtti schema, the
 * `dialect` tag, and decode/validate. No store access, no effects — head
 * resolution, materialization, and reverse indexes are a separate, deferred
 * concern.
 *
 * See `README.md` for the full spec.
 *
 * @module
 *
 * @import { Unknown } from '../json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { DialectEntry } from '../types.ts'
 * @import { Revision, RevisionError } from './types.ts'
 */

import { array, number, option, record, string } from '../../types/rtti/module.f.mjs'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.mjs'
import { parse as parseJson } from '../json/module.f.mjs'
import { cBase32ToVec } from '../../basen/cbase32/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.mjs'
import { dialectEntry } from '../module.f.mjs'
import { definedEntries, sort } from '../../types/object/module.f.mjs'
import { stringify } from '../json/module.f.mjs'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = /** @type {const} */ ('vnd.fjs.revision')

/** The media type derived from {@link dialect}: `application/vnd.fjs.revision+json`. */
export const mediaType = /** @type {const} */ (`application/${dialect}+json`)

/**
 * rtti schema for the snapshot-reference type: a cbase32 CAS hash string.
 *
 * This is `string` at the rtti (structural) level — rtti schemas can't
 * express string-content refinements — so cbase32 decodability, and the
 * rejection of `https://` bridge URLs and any other location-addressed
 * reference form, is enforced by {@link isHash} / {@link validate} below,
 * not by this schema on its own.
 */
export const hash = string

/** Structural schema for a Stage 1 flat lock map. */
export const _lock = record(string)

/**
 * rtti schema for a `revision` BLOB. See the README for the full semantics of
 * each field; `dialect` is the type discriminant, matched here as an exact
 * literal so structural validation alone rejects any other dialect's blob.
 */
export const revisionSchema = /** @type {const} */ ({
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: option(true),
    lock: option(_lock),
})

/** Serializes a revision canonically, recursively sorting every object's property names.
 * @type {(revision: Revision) => string}
 */
export const encodeText = stringify(sort)

/** Structural-only validator: checks the shape, not the hash / generation semantics. */
const validateShape = rttiValidate(revisionSchema)

/** True when `s` decodes as a cbase32 CAS hash (rejects `https://` and any other non-cbase32 string).
 * @type {(s: string) => boolean}
 */
export const isHash = s => cBase32ToVec(s) !== null

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid revision: every `parents` entry and the `snapshot` must
 * decode as a cbase32 hash ({@link isHash}), and `generation` must be a
 * non-negative *safe* integer. `subject` is not checked — it is an identity
 * string, never a snapshot reference, so any string is valid.
 *
 * `generation` uses `Number.isSafeInteger`, not `Number.isInteger`: a value at
 * or above `2 ** 53` passes `isInteger` but is no longer uniquely
 * representable, so `1 + max(parents' generations)` — how a writer derives the
 * next generation — can round back to the parent's value and fail to advance.
 * Rejecting unsafe integers keeps stored generations exact.
 *
 * Both `snapshot` and `generation` are required by the schema, so no absence
 * ever has to be resolved here: a revision states its content and its
 * generation explicitly, and is fully interpretable in isolation (see the
 * README). The former snapshot-resolution algorithm (subject-as-fallback,
 * single-parent inheritance, multi-parent rejection) is gone.
 *
 * Exported separately from {@link validate} for callers that assemble a
 * `Revision` themselves from already-typed fields (e.g. `fjs/cas/evo`'s
 * `addRevision`): the shape is then guaranteed by TypeScript already, so only
 * these semantic (string-only error) checks are worth re-running — routing
 * through the combined structural-plus-semantic `validate` would add an
 * unreachable structural-error branch on the caller's side.
 *
 * @type {(r: Revision) => Result<Revision, string>}
 */
export const checkReferences = r => {
    for (const p of r.parents) {
        if (!isHash(p)) { return error(`parent is not a valid hash: ${p}`) }
    }
    if (!isHash(r.snapshot)) { return error(`snapshot is not a valid hash: ${r.snapshot}`) }
    for (const [subject, snapshot] of definedEntries(r.lock ?? {})) {
        if (!isHash(snapshot)) { return error(`lock value for ${subject} is not a valid hash: ${snapshot}`) }
    }
    if (!Number.isSafeInteger(r.generation) || r.generation < 0) {
        return error(`generation must be a non-negative safe integer: ${r.generation}`)
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `revision` BLOB: structural
 * (rtti) validation followed by the hash / generation semantic checks.
 *
 * `RevisionError` is the union of the two stages' own error types, so each
 * failure reaches the caller as it was raised — `ValidationError` from the
 * schema, `string` from {@link checkReferences} — which is exactly what
 * `okThen` produces here.
 *
 * @type {(value: Unknown) => Result<Revision, RevisionError>}
 */
export const validate = value => okThen(checkReferences)(validateShape(value))

/**
 * Decodes `text` as a `revision` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a revision, regardless of key order or whitespace.
 *
 * @type {(text: string) => Result<Revision, RevisionError>}
 */
export const decodeText = text => okThen(validate)(parseJson(text))

/** {@link checkReferences} as the `boolean` refinement a {@link DialectEntry} takes.
 * @type {(r: Revision) => boolean}
 */
const isValidRevision = r => {
    const [tag] = checkReferences(r)
    return tag === 'ok'
}

/**
 * This dialect as a registry entry for `fjs/media`'s `detect`. It carries the
 * semantic checks too, so a blob is detected as `vnd.fjs.revision` exactly when
 * {@link decodeText} would accept it — a structurally valid revision whose
 * `snapshot` is not a cbase32 hash is not one.
 *
 * @type {DialectEntry}
 */
export const revisionDialect = dialectEntry(revisionSchema, isValidRevision)
