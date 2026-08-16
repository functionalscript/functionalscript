/**
 * `vnd.fjs.note` — a human-authored text item (a note, todo, issue, calendar
 * event, …) as a BLOB of its own.
 *
 * The format is deliberately minimal: the dialect tag, the text, and
 * optionally the subjects the item depends on. Everything else a richer item
 * needs — a title, tags, dates, a status — is a future **optional** field:
 * rtti structs are open, so additive extension keeps the tag (see the
 * versioning rule in `fjs/media/revision/README.md`), and starting minimal is
 * what keeps every extension additive.
 *
 * Like `vnd.fjs.lock`, a note is a **value**, not a step: no timestamps, no
 * author, no history of its own. Edits over time are ordinary
 * `vnd.fjs.revision` steps whose `subject` identifies the note and whose
 * `snapshot` is one of these blobs, so no second history mechanism appears
 * and `revision` stays the only one.
 *
 * This module is the pure format only: the rtti schema, the `dialect` tag,
 * and decode/validate. Unlike its CAS siblings it has no hash fields, so
 * there is no semantic refinement stage — structural validation is the whole
 * check.
 *
 * See `README.md` for the full spec.
 *
 * @module
 *
 * @import { Unknown } from '../json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ValidationError } from '../../types/rtti/common/types.ts'
 * @import { DialectEntry } from '../types.ts'
 * @import { Note, NoteError } from './types.ts'
 */

import { array, option, string } from '../../types/rtti/module.f.mjs'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.mjs'
import { parse as parseJson, stringify } from '../json/module.f.mjs'
import { okThen } from '../../types/result/module.f.mjs'
import { dialectEntry } from '../module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = /** @type {const} */ ('vnd.fjs.note')

/** The media type derived from {@link dialect}: `application/vnd.fjs.note+json`. */
export const mediaType = /** @type {const} */ (`application/${dialect}+json`)

/**
 * rtti schema for a `note` BLOB: the dialect tag, the text, and optionally
 * the subjects the item depends on.
 *
 * `text` is **required** and may be `''`: an absent text and an empty one
 * would otherwise be two spellings of one blob, and a blob whose only purpose
 * is to hold text has nothing to say when it does not. Any string is valid —
 * the format records the text and defines no markup for it; how a reader
 * renders it (e.g. as Markdown) is the reader's decision.
 *
 * `dependencies` entries are **subject identity strings** — the vocabulary of
 * `vnd.fjs.revision`'s `subject` and of lock-map keys — naming the mutable
 * items this one depends on (a blocked-by todo, an issue's prerequisite).
 * They are never content hashes: a dependency tracks the live item, and
 * pinning it to immutable content is the revision layer's `lock`. Like
 * `subject`, an identity string is unconstrained, so no semantic check
 * applies. The field is optional because its absent value is the constant
 * "depends on nothing"; an explicit `[]` says the same thing, and the format
 * does not distinguish the two.
 *
 * `text` may reference an entry by its zero-based index in square brackets —
 * `[0]` names `dependencies[0]` — so the entry order is **significant**:
 * reordering or removing entries renumbers references. A bracketed integer
 * that indexes no entry is ordinary text, not a broken reference, so the
 * convention adds no validation stage (see the README).
 */
export const noteSchema = /** @type {const} */ ({
    dialect,
    text: string,
    dependencies: option(array(string)),
})

/** Serializes a note canonically, sorting every object's property names.
 * @type {(note: Note) => string}
 */
export const encodeText = stringify(sort)

/**
 * Validates an already-parsed JSON value as a `note` BLOB. Structural (rtti)
 * validation is the whole check: a note has no hash fields, so there is no
 * semantic refinement stage and no `checkReferences` half.
 *
 * @type {(value: Unknown) => Result<Note, ValidationError>}
 */
export const validate = rttiValidate(noteSchema)

/**
 * Decodes `text` as a `note` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a note, regardless of key order or whitespace.
 *
 * @type {(text: string) => Result<Note, NoteError>}
 */
export const decodeText = text => okThen(validate)(parseJson(text))

/**
 * This dialect as a registry entry for `fjs/media`'s `detect`. Registered
 * with no refinement — structure alone decides the match — so a blob is
 * detected as `vnd.fjs.note` exactly when {@link decodeText} would accept it.
 *
 * @type {DialectEntry}
 */
export const noteDialect = dialectEntry(noteSchema)
