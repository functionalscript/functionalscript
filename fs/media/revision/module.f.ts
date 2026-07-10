/**
 * The `vnd.fjs.revision` content format: one step in the evolution of a
 * mutable object on top of immutable CAS. A revision blob links back to its
 * parent revision(s) (a DAG, so concurrent edits can merge) and carries the
 * full materialized content (a snapshot) — incremental diffs are deliberately
 * not part of this format. See the module `README.md` for the format spec
 * and the versioning rule.
 *
 * @module
 */
import type { Unknown } from '../json/module.f.ts'
import { parse as jsonParse } from '../json/parser/module.f.ts'
import { tokenize as jsonTokenize } from '../json/tokenizer/module.f.ts'
import { stringify } from '../json/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { array, number, option, string } from '../../types/rtti/module.f.ts'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.ts'
import type { ValidationError } from '../../types/rtti/validate/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'

/**
 * Format tag naming this dialect. It is the first key of {@link revisionSchema}
 * so a serialized revision starts with `{"dialect":"vnd.fjs.revision"`,
 * matching the tagged-JSON detection convention. See the README for the
 * versioning rule (additive changes keep the tag; breaking changes get a new
 * one, e.g. `vnd.fjs.revision2`).
 */
export const dialect = 'vnd.fjs.revision' as const

/** The media type this format is served with, derived mechanically from {@link dialect}. */
export const mediaType = `application/${dialect}+json` as const

/**
 * The `revision` RTTI schema. `subject`/`parents`/`snapshot` are typed as
 * plain `string` here: the cbase32-hash requirement on `parents`, `snapshot`,
 * and the zero-parent fallback `subject`, and the cross-field snapshot/parents
 * cardinality rules, are semantic constraints RTTI's structural validation
 * cannot express — {@link validateRevision} checks them on top of this schema.
 */
export const revisionSchema = {
    dialect: dialect,
    subject: string,
    parents: array(string),
    snapshot: option(string),
    generation: option(number),
    archived: option(true),
} as const

/** The TypeScript type derived from {@link revisionSchema}. */
export type Revision = Ts<typeof revisionSchema>

/** A validation failure: structural (rtti) or semantic (hash format, snapshot rules). */
export type RevisionError = ValidationError | string

/** Whether `s` is a valid cbase32 CAS address (the only accepted snapshot-reference form). */
const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/**
 * Checks the semantic rules {@link revisionSchema} cannot express: every
 * `parents` entry and a present `snapshot` must be a cbase32 hash. When
 * `snapshot` is absent: zero parents fall back to `subject` as the snapshot
 * reference (so `subject` must then be a hash too), exactly one parent
 * inherits that parent's snapshot, and more than one parent is invalid —
 * there is no single parent snapshot to inherit, and falling back to
 * `subject` would silently lose the merge result.
 */
const validateSemantics = (r: Revision): Result<Revision, string> => {
    const badParent = r.parents.find(p => !isHash(p))
    if (badParent !== undefined) { return error(`parents: not a hash: ${badParent}`) }
    if (r.snapshot !== undefined) {
        return isHash(r.snapshot) ? ok(r) : error(`snapshot: not a hash: ${r.snapshot}`)
    }
    if (r.parents.length === 0) {
        return isHash(r.subject)
            ? ok(r)
            : error(`subject: not a hash (required as the snapshot fallback with no snapshot and no parents): ${r.subject}`)
    }
    return r.parents.length === 1
        ? ok(r)
        : error('snapshot is required when parents.length > 1')
}

/** Validates an already-parsed JSON value against {@link revisionSchema} and the semantic rules above. */
export const validateRevision = (value: Unknown): Result<Revision, RevisionError> => {
    const [t, v] = rttiValidate(revisionSchema)(value)
    return t === 'error' ? error(v) : validateSemantics(v)
}

const parseJsonText = (text: string): Result<Unknown, string> =>
    jsonParse(jsonTokenize(stringToList(text)))

/** Parses and validates a `vnd.fjs.revision` JSON document from its text form. */
export const decodeRevision = (text: string): Result<Revision, RevisionError> => {
    const [t, v] = parseJsonText(text)
    return t === 'error' ? error(v) : validateRevision(v)
}

const toJson = stringify(identity)

/**
 * Serializes a {@link Revision} back to its JSON text form, `dialect` first.
 * Builds a fresh object with the schema's declared field order rather than
 * reusing the input's own key order — a value that came from {@link decodeRevision}
 * has its keys in the JSON parser's (alphabetical) `OrderedMap` order, which
 * would otherwise put `archived` ahead of `dialect`.
 */
export const encodeRevision = (r: Revision): string => toJson({
    dialect: r.dialect,
    subject: r.subject,
    parents: r.parents,
    ...(r.snapshot === undefined ? {} : { snapshot: r.snapshot }),
    ...(r.generation === undefined ? {} : { generation: r.generation }),
    ...(r.archived === undefined ? {} : { archived: r.archived }),
})
