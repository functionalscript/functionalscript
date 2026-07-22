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
 */
import { array, number, option, string } from '../../types/rtti/module.f.ts'
import { validate as rttiValidate, type ValidationError } from '../../types/rtti/validate/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { parse as jsonParse } from '../json/parser/module.f.ts'
import { tokenize as jsonTokenize } from '../json/tokenizer/module.f.ts'
import type { Unknown } from '../json/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.revision' as const

/** The media type derived from {@link dialect}: `application/vnd.fjs.revision+json`. */
export const mediaType = `application/${dialect}+json` as const

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

/**
 * rtti schema for a `revision` BLOB. See the README for the full semantics of
 * each field; `dialect` is the type discriminant, matched here as an exact
 * literal so structural validation alone rejects any other dialect's blob.
 */
export const revisionSchema = {
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: option(hash),
    generation: option(number),
    archived: option(true),
} as const

/** The TypeScript type derived from {@link revisionSchema} — the single source of truth. */
export type Revision = Ts<typeof revisionSchema>

/** Structural-only validator: checks the shape, not the snapshot-reference semantics. */
const validateShape = rttiValidate(revisionSchema)

/** True when `s` decodes as a cbase32 CAS hash (rejects `https://` and any other non-cbase32 string). */
export const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/** Either a structural validation error or a semantic (snapshot-reference) error message. */
export type RevisionError = ValidationError | string

/**
 * Checks the snapshot-reference semantics of an already shape-valid revision:
 * every parent must be a hash; `snapshot`, when present, must be a hash;
 * when `snapshot` is absent, zero parents fall back to `subject` (which must
 * then be a hash), exactly one parent inherits that parent's snapshot, and
 * more than one parent without an explicit `snapshot` is invalid — there is
 * no single parent snapshot to inherit, and falling back to `subject` would
 * silently lose the merge result.
 *
 * Exported separately from {@link validate} for callers that assemble a
 * `Revision` themselves from already-typed fields (e.g. `fs/cas/evo`'s
 * `addRevision`): the shape is then guaranteed by TypeScript already, so only
 * these semantic (string-only error) checks are worth re-running — routing
 * through the combined structural-plus-semantic `validate` would add an
 * unreachable structural-error branch on the caller's side.
 */
export const checkReferences = (r: Revision): Result<Revision, string> => {
    for (const p of r.parents) {
        if (!isHash(p)) { return error(`parent is not a valid hash: ${p}`) }
    }
    if (r.snapshot !== undefined) {
        return isHash(r.snapshot) ? ok(r) : error(`snapshot is not a valid hash: ${r.snapshot}`)
    }
    if (r.parents.length === 0) {
        return isHash(r.subject)
            ? ok(r)
            : error(`subject must be a valid hash when snapshot is absent and there are no parents: ${r.subject}`)
    }
    if (r.parents.length === 1) {
        return ok(r)
    }
    return error('snapshot is required when a revision has more than one parent')
}

/**
 * Validates an already-parsed JSON value as a `revision` BLOB: structural
 * (rtti) validation followed by the snapshot-reference semantic checks.
 */
export const validate = (value: Unknown): Result<Revision, RevisionError> => {
    const [t, v] = validateShape(value)
    if (t === 'error') { return error(v) }
    return checkReferences(v)
}

/** Parses `text` as JSON without relying on `JSON.parse` (the shared `fs/media/json` parser/tokenizer). */
const parseJson = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

/**
 * Decodes `text` as a `revision` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a revision, regardless of key order or whitespace.
 */
export const decodeText = (text: string): Result<Revision, RevisionError> => {
    const [t, v] = parseJson(text)
    if (t === 'error') { return error(v) }
    return validate(v)
}
