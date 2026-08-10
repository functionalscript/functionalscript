/**
 * Media-type detection entry point: dialect-tagged JSON recognition layered
 * on top of the byte-signature / UTF-8 detector.
 *
 * `fjs/media/type` classifies raw bytes (magic-byte signatures, UTF-8
 * text-vs-binary) with no notion of a JSON dialect. `detect` here adds one
 * more classification step in front of it: when the whole blob is
 * whole-blob-valid UTF-8 text (as `fjs/media/type` already determined), parse
 * it as JSON and match the parsed value against the dialects the caller
 * registered. A match reports that dialect's derived media type; anything that
 * isn't valid JSON, or matches no registered dialect, falls through to the
 * `fjs/media/type` verdict unchanged.
 *
 * The dialect set is a **parameter**, not an import: `detect(dialects)(bytes)`.
 * This module therefore knows no dialect of its own — `fjs/media/revision`
 * exports its own {@link DialectEntry} (`revisionDialect`), and a caller passes
 * the list it wants recognized. Any format following the `vnd.fjs.<name>`
 * convention (see `fjs/media/revision/README.md`), in this repo or downstream,
 * is registerable the same way.
 *
 * Detection is semantic, not syntactic: any JSON that satisfies a dialect's
 * schema is recognized regardless of key order, whitespace, or any other
 * serialization detail — there is no byte-level shortcut such as a
 * `{"dialect":` prefix check. The text is parsed **once**, and each entry's
 * `match` runs on the same parsed value, so N dialects cost N schema walks
 * rather than N parses.
 *
 * A reported `mime_type` is a claim about a blob's *shape*, not a promise that
 * decoding it succeeds: how strict detection is, is the dialect's own call (see
 * {@link dialectEntry}'s `extraValidate`). Never route a decode decision
 * through this verdict — a caller that intends to decode calls its dialect's
 * decoder, which stays the authority.
 *
 * This only classifies an already-buffered `Vec` (`detectVec`'s single-`Vec`
 * form), because dialect validation needs the whole parsed value. A single
 * `Vec` already caps at `maxLength` bits (128 KiB — the same bound as the
 * existing inline-content cap), so dialect detection is naturally
 * size-bounded. The unbounded streaming detector (`fjs/media/type`
 * `detectStream`) is untouched and stays a pure byte-signature/UTF-8
 * classifier with no dialect awareness.
 *
 * @module
 */
import type { Vec } from '../types/bit_vec/module.f.mjs'
import { fromVec } from '../text/utf8/module.f.mjs'
import { detectVec, type DetectMeta } from './type/module.f.ts'
import { parse } from './json/module.f.ts'
import { assert, assertNotNullish } from '../asserts/module.f.mjs'
import type { Struct } from '../types/rtti/module.f.ts'
import type { Ts, Unknown } from '../types/rtti/ts/module.f.ts'
import { validate, type Validate } from '../types/rtti/validate/module.f.ts'

/**
 * One registered dialect: the name it tags itself with, and a predicate
 * deciding whether an already-parsed value is one of its blobs.
 *
 * `match` takes rtti's `Unknown` — the encoding-neutral one, admitting
 * `bigint` and `undefined` — not `fjs/media/json`'s JSON-only `Unknown`, so an
 * entry stays usable by a future non-JSON detector over the same dialects.
 *
 * The type is deliberately not opaque: a caller may write the struct by hand.
 * The list is that caller's own declaration of what it wants recognized,
 * passed to its own `detect` call, so a fabricated entry mislabels only that
 * caller's results — there is no trust boundary between a caller and entries it
 * writes itself. The boundary that does exist, untrusted blob content, is on
 * the other side of `match`.
 */
export type DialectEntry = {
    readonly dialect: string
    readonly match: (_: Unknown) => boolean
}

/** The default refinement: structural validation alone decides the match. */
const always = (): boolean => true

/** Structural validation followed by the dialect's own refinement. */
const matchWith = <T extends Struct>(v: Validate<T>) =>
    (extraValidate: (_: Ts<T>) => boolean) =>
    (u: Unknown): boolean => {
        const [tag, value] = v(u)
        return tag === 'ok' && extraValidate(value)
    }

/**
 * Registers a dialect for detection: its rtti schema, plus whatever rtti can't
 * say about it.
 *
 * The dialect name is read out of the schema's own `dialect` member — that
 * member is a string const in a dialect schema, which is what makes the schema
 * self-discriminating, so a separate name alongside it would be a second copy
 * that can disagree with the first. It follows that no registration can claim
 * one dialect while validating another's blobs. The media type is likewise
 * derived rather than supplied: `application/${dialect}+json`, the mechanical
 * derivation `fjs/media/revision/README.md` documents.
 *
 * `extraValidate` runs *after* structural validation, on the dialect's own
 * decoded type, and closes the gap rtti leaves — "this string is
 * cbase32-decodable", "this number is a non-negative safe integer". It returns
 * `boolean`, so it has no error channel and nothing to report but yes or no,
 * and it never sees the raw bytes: parsing and the schema walk stay with the
 * detector. Omitting it gets classification (what a blob claims to be and
 * structurally looks like); supplying it gets detection as strict as the
 * dialect's own decoder.
 *
 * **The name is neither grammar-checked nor allowlisted.** A schema saying
 * `dialect: 'foo'` yields `application/foo+json`, and that is intended:
 * `vnd.fjs.*` is this repo's convention for its *own* formats, not a constraint
 * on what a caller may detect — another vendor's `vnd.*` blob, or a widely used
 * name not under `vnd.` at all, is a legitimate thing to register. The name is
 * not attacker-controlled either: it comes from a schema a programmer wrote and
 * passed here, never from the blob being classified, so no untrusted string
 * reaches `mime_type` along this path. (A detector that read the name *out of*
 * a blob would need the RFC 6838 grammar check and an allowlist; this one does
 * not.) Registering a name that is not a valid RFC 6838 restricted-name yields
 * a malformed media type in the registrant's own results, and nowhere else.
 *
 * The constraint is `Struct` — every member must be a real rtti `Type`, which
 * is what rejects a member like `() => 42` at compile time (rtti would read it
 * as a thunk and `match` would *throw* on the first blob rather than return
 * `false`). TypeScript cannot also require a direct string `dialect` member
 * under that constraint, so that half is asserted here instead: loudly, once,
 * when the entry is constructed. A thunk-form `dialect`
 * (`() => ['const', 'x']`) is a perfectly valid rtti schema, it just is not
 * registerable — write the string directly, as `revisionSchema` does.
 */
export const dialectEntry = <T extends Struct>(
    type: T,
    extraValidate: (_: Ts<T>) => boolean = always,
): DialectEntry => {
    const { dialect } = type
    assert(typeof dialect === 'string', 'dialectEntry: schema has no direct string `dialect` member')
    return { dialect, match: matchWith(validate(type))(extraValidate) }
}

/**
 * Classifies a whole buffered `Vec` against `dialects`, returning the same
 * three-way `{ length, mime_type, type }` shape as `fjs/media/type`
 * `detectVec`, but with dialect-tagged JSON recognized ahead of the plain
 * `text/plain` fallback. The first entry whose `match` accepts the parsed value
 * wins; entries that overlap are the registrant's own business, since matching
 * `dialect` as an exact literal already makes structural validation reject
 * every other dialect's blob.
 */
export const detect = (dialects: readonly DialectEntry[]) => (bytes: Vec): DetectMeta => {
    const base = detectVec(bytes)
    // Only whole-blob-valid UTF-8 text can possibly be JSON; a magic-byte hit
    // or binary fallback is never a dialect match.
    if (base.type !== 'text') { return base }
    // `detectVec`'s `type: 'text'` verdict already means `bytes` is byte-aligned,
    // whole-blob-valid UTF-8 — the same two conditions `fromVec` checks, via the
    // same decoder — so `fromVec` cannot return `null` here.
    const text = assertNotNullish(fromVec(bytes), 'detect: type text implies fromVec succeeds')
    const [tag, value] = parse(text)
    if (tag === 'error') { return base }
    const matched = dialects.find(({ match }) => match(value))
    return matched === undefined
        ? base
        : { ...base, mime_type: `application/${matched.dialect}+json` }
}
