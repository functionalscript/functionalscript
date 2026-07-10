/**
 * Revision JSON dialect for representing mutable-object evolution steps in CAS.
 *
 * The module is pure format code: it defines the `vnd.fjs.revision` RTTI schema,
 * reference validators, and JSON encode/decode helpers. Store/index operations live
 * in `fs/cas/evo` so media detection can import this module without creating a CAS
 * dependency cycle.
 *
 * @module
 */
import { array, number, option, string } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'
import { length } from '../../types/bit_vec/module.f.ts'
import { stringify, type Unknown as JsonUnknown } from '../json/module.f.ts'
import { parse as parseJson } from '../json/parser/module.f.ts'
import { tokenize } from '../json/tokenizer/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { ok, error, type Result } from '../../types/result/module.f.ts'

/** Format tag embedded as the first JSON key in serialized revision blobs. */
export const dialect = 'vnd.fjs.revision' as const

/** Media type derived from {@link dialect}. */
export const mimeType = `application/${dialect}+json` as const

/** A content-addressed-space URL: a native CAS hash or an HTTPS bridge URL. */
export type Ref = string

/** A native CAS cBase32 SHA-256 hash reference. */
export type Hash = string

const httpsPrefix = 'https://' as const

/** Returns whether `value` is a native cBase32 SHA-256 CAS hash. */
export const isHash = (value: string): boolean => {
    const decoded = cBase32ToVec(value)
    return decoded !== null && length(decoded) === 256n
}

/** Returns whether `value` is a recognized content-addressed-space reference. */
export const isRef = (value: string): boolean =>
    isHash(value) || value.startsWith(httpsPrefix)

/** RTTI schema for revision JSON blobs. Semantic ref checks are performed by `validate`. */
export const revision = {
    dialect,
    subject: string,
    parents: array(string),
    snapshot: option(string),
    generation: option(number),
    archived: option(true),
} as const

/** TypeScript shape derived from the RTTI schema. */
export type Revision = Ts<typeof revision>

const validateShape = rttiValidate(revision)

const toJson = stringify(identity)

const firstKeyPrefix = `{"dialect":"${dialect}"` as const

/** Serializes a revision with `dialect` as the first key for tagged-JSON sniffing. */
export const encode = (value: Revision): string => toJson(value)

/** Returns whether encoded text starts with this dialect's required first-key tag. */
export const hasRevisionPrefix = (value: string): boolean =>
    value.startsWith(firstKeyPrefix)

const validateRefs = (value: Revision): Result<Revision, string> =>
    !isRef(value.subject) ?
        error('subject must be a cBase32 hash or https:// URL') :
    value.parents.some(parent => !isHash(parent)) ?
        error('parents must be cBase32 hashes') :
    value.snapshot !== undefined && !isRef(value.snapshot) ?
        error('snapshot must be a cBase32 hash or https:// URL') :
    value.parents.length > 1 && value.snapshot === undefined ?
        error('multi-parent revisions must carry snapshot') :
        ok(value)

/** Validates both the RTTI shape and revision-specific reference invariants. */
export const validate = (value: JsonUnknown): Result<Revision, string> => {
    const shape = validateShape(value)
    if (shape[0] === 'error') {
        return error(`${shape[1].path.join('.')}: ${shape[1].message}`)
    }
    return validateRefs(shape[1])
}

/** Parses and validates a revision JSON document. */
export const decode = (text: string): Result<Revision, string> => {
    const parsed = parseJson(tokenize(stringToList(text)))
    return parsed[0] === 'error'
        ? error(parsed[1])
        : validate(parsed[1])
}
