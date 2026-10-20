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
 * This module therefore knows no dialect of its own — `fjs/media/revision`,
 * `fjs/media/lock`, and `fjs/media/note` each export their own
 * {@link DialectEntry} (`revisionDialect`, `lockDialect`, `noteDialect`), and
 * a caller passes the list it wants recognized. What it does own is the
 * mechanics those dialects share: {@link jsonDialect} derives a JSON
 * dialect's tag, media type, canonical encoder, validator, decoder and entry
 * from its schema, so each dialect module states only its format. Any format following the `vnd.fjs.<name>` convention (see
 * `fjs/media/revision/README.md`), in this repo or downstream, is registerable
 * the same way.
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
 *
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { DetectMeta } from './type/types.ts'
 * @import { Rest, Struct, Type } from '../rtti/types.ts'
 * @import { Ts, Unknown } from '../rtti/ts/types.ts'
 * @import { Path, ValidateE, ValidationError } from '../rtti/common/types.ts'
 * @import { Node, UnionAlgebra, Data } from '../rtti/data/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Unknown as JsonUnknown } from './json/types.ts'
 * @import { DialectEntry, JsonDialect } from './types.ts'
 */

import { fromVec } from '../text/utf8/module.f.mjs'
import { detectVec } from './type/module.f.mjs'
import { parse, stringifySorted } from './json/module.f.mjs'
import { assert, assertNotNullish } from '../asserts/module.f.js'
import { parse as rttiParse } from '../rtti/parse/module.f.mjs'
import { toData, unionFold } from '../rtti/data/module.f.mjs'
import { definedEntries, definedValues, isObject } from '../types/object/module.f.mjs'
import { find, map } from '../types/list/module.f.mjs'
import { error, ok, okThen } from '../types/result/module.f.js'

/** The default refinement: structural validation alone decides the match. */
const always = () => true

/**
 * Structural validation followed by the dialect's own refinement.
 *
 * Typed over the **erased** `ValidateE`: a `T extends Type` template would
 * instantiate `Ts<Type>` here and raise TS2589. {@link dialectEntry} states
 * the precise `extraValidate` type its callers are held to.
 *
 * @param {ValidateE} v
 * @returns {(extraValidate: (_: any) => boolean) => (u: Unknown) => boolean}
 */
const matchWith = v => extraValidate => u => {
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
 * The container's constraint is `Struct` — every member must be a real rtti
 * `Type`, which is what rejects a member like `() => 42` at compile time (rtti
 * would read it as a thunk and `match` would *throw* on the first blob rather
 * than return `false`). TypeScript cannot also require a direct string
 * `dialect` member under that constraint, so that half is asserted here
 * instead: loudly, once, when the entry is constructed. A thunk-form `dialect`
 * (`() => ['const', 'x']`) is a perfectly valid rtti schema, it just is not
 * registerable — write the string directly, as `revisionSchema` does.
 *
 * The schema is a **container with a stated rest** rather than a bare struct,
 * and every dialect in this repo states `open`. A bare struct is closed, so an
 * older reader would reject a blob a newer writer had added a field to, which
 * is precisely the fail-closed misread the additive-extension rule in
 * `./revision/README.md` exists to avoid. Requiring the wrapper here is what
 * makes that a decision a registrant states rather than one they inherit.
 *
 * @template {Struct} S
 * @param {Rest<S, Type>} type
 * @param {(_: Ts<S>) => boolean} [extraValidate]
 * @returns {DialectEntry}
 */
export const dialectEntry = (type, extraValidate = always) => {
    const { dialect } = schemaDialect(type)
    const v = /** @type {ValidateE} */ (rttiParse(type))
    return { dialect, match: matchWith(v)(extraValidate) }
}

/**
 * A dialect schema's container and the `dialect` it pins, asserted to be a
 * direct string: the one check {@link dialectEntry} and {@link jsonDialect}
 * both make before anything else, so neither can register a schema the other
 * refuses for it.
 *
 * @template {Struct} S
 * @param {Rest<S, Type>} type
 * @returns {{ readonly container: Struct, readonly dialect: string }}
 */
const schemaDialect = type => {
    const [, c] = type()
    const container = /** @type {Struct} */ (c)
    const { dialect } = container
    assert(typeof dialect === 'string', 'dialect schema has no direct string `dialect` member')
    return { container, dialect }
}

/**
 * The media type a dialect is served with: `application/${dialect}+json`, the
 * mechanical derivation `fjs/media/revision/README.md` documents. The one
 * spelling of that rule — {@link detect} reports a matched entry under it, and
 * {@link jsonDialect} publishes a dialect's `mediaType` with it.
 *
 * @template {string} D
 * @param {D} dialect
 * @returns {`application/${D}+json`}
 */
const dialectMediaType = dialect => `application/${dialect}+json`

/**
 * Whether a data-form node admits JSON values only. A named node is a rule
 * of the enclosing {@link Data}, checked there once, so the walk never
 * follows a name and a recursive schema cannot loop.
 *
 * @type {(n: Node) => boolean}
 */
const jsonNode = n => typeof n === 'string' || jsonUnion(n)

/**
 * What {@link jsonNode} says about each part of a union: a JSON kind — `null`,
 * a boolean, a number, a string, an array or object of such — passes;
 * `undefined`, a `bigint`, and the top (which admits both) do not.
 *
 * @type {UnionAlgebra<boolean>}
 */
const jsonKinds = {
    top: false,
    unit: name => name !== 'undefined',
    whole: kind => kind === 'number' || kind === 'string',
    number: () => true,
    string: () => true,
    bigint: () => false,
    array: ({ prefix, rest }) => [...prefix, ...(rest === undefined ? [] : [rest])].every(jsonNode),
    object: ({ props, rest }) => [...definedValues(props), ...(rest === undefined ? [] : [rest])].every(jsonNode),
    join: members => members.every(m => m),
}

const jsonUnion = unionFold(jsonKinds)

/**
 * Whether a schema's data form admits JSON values only: its entry and every
 * rule it names. `toData` keeps only the rules its entry reaches, closing
 * reference cycles by identity, so each is checked once and the check ends.
 *
 * @type {(data: Data) => boolean}
 */
const jsonData = ([rules, entry]) => [...definedValues(rules), entry].every(jsonNode)

/**
 * The path to the first leaf of a runtime value `leaf` refuses, or `null`.
 * Arrays and objects are descended, everything else is a leaf. The walk is
 * over a value, which FunctionalScript builds acyclic, so it ends; it stops
 * at the first refusal.
 *
 * @type {(leaf: (x: unknown) => boolean) => (path: Path) => (v: unknown) => Path | null}
 */
const refusedLeaf = leaf => {
    /** @type {(path: Path) => (v: unknown) => Path | null} */
    const walk = path => v =>
        v instanceof Array ? first(path)(v.map((x, i) => [`${i}`, x]))
        : isObject(v) ? first(path)(Object.entries(v))
        : leaf(v) ? null
        : path
    /** @type {(path: Path) => (children: readonly (readonly [string, unknown])[]) => Path | null} */
    const first = path => children =>
        find(null)(p => p !== null)(map(([k, x]) => walk([...path, k])(x))(children))
    return walk
}

/**
 * A number the standard JSON serializer spells without changing it: `NaN`
 * and `±Infinity` become `null`, every other number — `-0` included — reads
 * back as itself.
 */
const jsonExact = Number.isFinite

/**
 * The first number in a parsed value without an exact JSON spelling.
 * {@link jsonDialect}'s `validate` receives JSON-kind leaves only, so a
 * number is the one leaf that can be wrong.
 */
const inexactNumber = refusedLeaf(x => typeof x !== 'number' || jsonExact(x))([])

/**
 * The first leaf of an arbitrary value JSON cannot spell: anything but
 * `null`, a boolean, a string, or a number {@link jsonExact} accepts.
 */
const unencodableLeaf = refusedLeaf(x =>
    x === null || typeof x === 'boolean' || typeof x === 'string'
    || (typeof x === 'number' && jsonExact(x)))([])

/**
 * Everything a JSON dialect derives from its schema and its optional semantic
 * refinement — the dialect tag, its media type, the canonical encoder, the
 * validator, the decoder, and the {@link DialectEntry} for {@link detect} —
 * stated once, so a dialect module states only its format. See
 * {@link JsonDialect} for what each part guarantees.
 *
 * The schema is the one {@link dialectEntry} takes, and refused the same way
 * when its `dialect` is not a direct string. It is also refused, at
 * construction, when a declared member admits a value JSON cannot spell — a
 * `bigint`, `undefined`, or `unknown` (which admits both) — so such a schema
 * fails at module load naming the member, not at the first `encodeText`. The
 * `open` rest is not walked: it reaches no member of the value type. The
 * parameter type refuses such a schema first where it can — a schema whose
 * value type is not JSON is typed `never` — and the runtime check stays for
 * what the type cannot see.
 *
 * `checkReferences` runs after the shape and exact-number checks, on the
 * dialect's own value type; its error type joins the kit's. It may return a
 * value other than its input, which then passes both checks again, so a
 * refinement cannot make `validate` return a value `encodeText` refuses. `entry` matches
 * through the kit's own `validate`, so detection and decoding are one
 * acceptance rule.
 *
 * @template {Struct} S
 * @template [E=never]
 * @param {Rest<S, Type> & ([Ts<S>] extends [JsonUnknown] ? unknown : never)} schema
 * @param {(value: Ts<S>) => Result<Ts<S>, E>} [checkReferences]
 * @returns {JsonDialect<S, E>}
 */
export const jsonDialect = (schema, checkReferences = ok) => {
    const { container, dialect } = schemaDialect(schema)
    const nonJson = definedEntries(container).flatMap(([k, t]) => jsonData(toData(t)) ? [] : [k])
    assert(nonJson.length === 0, `jsonDialect: a member admits a value JSON cannot spell: ${nonJson.join(', ')}`)
    // An erased cast, paid for by the construction checks above, as in
    // `dialectEntry`: the parsed value is the schema's.
    const shape = /** @type {(value: unknown) => Result<Ts<S>, ValidationError>} */ (rttiParse(schema))
    /** @type {(v: Ts<S>) => Result<Ts<S>, ValidationError>} */
    const exact = v => {
        const path = inexactNumber(v)
        return path === null ? ok(v) : error({ path, message: 'number has no exact JSON spelling' })
    }
    /**
     * The shape and exact-number checks. They run on the input and again on
     * whatever the refinement returns: a refinement may hand back a new
     * value, and `validate`'s output must stay something `encodeText` takes
     * and `decodeText` reads back.
     *
     * @type {(v: unknown) => Result<Ts<S>, ValidationError>}
     */
    const checked = v => okThen(exact)(shape(v))
    /** @type {JsonDialect<S, E>['validate']} */
    const validate = value => okThen(checked)(okThen(checkReferences)(checked(value)))
    /** @type {JsonDialect<S, E>['encodeText']} */
    const encodeText = value => {
        const path = unencodableLeaf(value)
        assert(path === null, `encodeText: no JSON spelling for the value at /${path === null ? '' : path.join('/')}`)
        // The walk above found every leaf JSON-spellable.
        return stringifySorted(/** @type {JsonUnknown} */ (value))
    }
    // The literal `DialectOf<S>` names is the string asserted above.
    const tag = /** @type {JsonDialect<S, E>['dialect']} */ (dialect)
    return {
        dialect: tag,
        mediaType: dialectMediaType(tag),
        encodeText,
        validate,
        decodeText: text => okThen(validate)(parse(text)),
        // `match` takes rtti's `Unknown`; the construction check leaves no
        // `bigint` or `undefined` the shape check could accept.
        entry: { dialect, match: u => validate(/** @type {JsonUnknown} */ (u))[0] === 'ok' },
    }
}

/**
 * Classifies a whole buffered `Vec` against `dialects`, returning the same
 * three-way `{ length, mime_type, type }` shape as `fjs/media/type`
 * `detectVec`, but with dialect-tagged JSON recognized ahead of the plain
 * `text/plain` fallback. The first entry whose `match` accepts the parsed value
 * wins; entries that overlap are the registrant's own business, since matching
 * `dialect` as an exact literal already makes structural validation reject
 * every other dialect's blob.
 *
 * @param {readonly DialectEntry[]} dialects
 * @returns {(bytes: Vec) => DetectMeta}
 */
export const detect = dialects => bytes => {
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
        : { ...base, mime_type: dialectMediaType(matched.dialect) }
}
