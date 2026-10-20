/**
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { DialectEntry } from './types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { ValidationError } from '../rtti/common/types.ts'
 * @import { Result } from '../types/result/types.ts'
 */
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../asserts/module.f.js'
import { u8ListToVecMsb, repeat, vec8 } from '../types/bit_vec/module.f.mjs'
import { detect, jsonDialect } from './module.f.mjs'
import { checkReferences, dialect, revisionDialect, revisionSchema } from './revision/module.f.mjs'
import { dialect as lockDialectName, lockDialect } from './lock/module.f.mjs'
import { dialect as noteDialectName, noteDialect } from './note/module.f.mjs'
import { array, bigint, boolean, number, open, or, record, string, unknown } from '../rtti/module.f.mjs'
import { ok } from '../types/result/module.f.js'

// All test strings here are ASCII, so char code === UTF-8 byte value.
/** @type {(s: string) => Vec} */
const utf8Bytes = s => u8ListToVecMsb([...s].map(c => c.charCodeAt(0)))

const revisionJson = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"8","generation":0}`

/** The three dialects `fjs/media` itself ships, in the order `fjs/mcp` registers them.
 * @type {readonly DialectEntry[]}
 */
const dialects = [revisionDialect, lockDialect, noteDialect]

const detectRevision = detect(dialects)

/** A dialect name outside `vnd.fjs.*` — registerable, and detected as itself. */
const gadgetSchema = open(/** @type {const} */ ({
    dialect: 'application.gadget',
    size: number,
}))

/** @type {DialectEntry} */
const gadgetDialect = jsonDialect(gadgetSchema).entry

/**
 * `DialectEntry` is deliberately not opaque, so overlapping entries — which a
 * self-discriminating schema can't produce on its own — can be stated directly.
 * @type {(name: string) => DialectEntry}
 */
const anyEntry = name => ({ dialect: name, match: () => true })

/**
 * A schema whose members reach every JSON kind the construction check
 * accepts: a const string and number, `true`/`null`/booleans, a whole
 * `number` and `string`, a tuple (no rest), an array and a record (a rest),
 * and an open struct (no rest) beside a closed one (a `never` rest).
 */
const kindsSchema = open(/** @type {const} */ ({
    dialect: 'vnd.fjs.kinds',
    one: 1,
    pair: [string, or(null, boolean)],
    list: array(number),
    map: record(string),
    meta: open({ flag: or(true, null) }),
    closed: { name: string },
}))

const kindsBlob = {
    dialect: 'vnd.fjs.kinds',
    one: 1,
    pair: ['a', null],
    list: [1, -0],
    map: { k: 'v' },
    meta: { flag: true, extra: 1 },
    closed: { name: 'n' },
}

/** No refinement, so detection and decoding are the shape and number checks alone. */
const kinds = jsonDialect(kindsSchema)

/** The same schema with an identity refinement — one that says nothing about numbers. */
const kindsIdentity = jsonDialect(kindsSchema, v => ok(v))

/** `revision`'s own schema and refinement, built here through the exported factory. */
const revisionKit = jsonDialect(revisionSchema, checkReferences)

/**
 * `jsonDialect` with its signature erased, for schemas its parameter type
 * refuses at compile time.
 *
 * @type {(schema: unknown) => unknown}
 */
const untypedJsonDialect = /** @type {any} */ (jsonDialect)

/** The error `validate` reports for a number without an exact JSON spelling at `path`.
 * @type {(path: readonly string[]) => ValidationError}
 */
const inexactAt = path => ({ path, message: 'number has no exact JSON spelling' })

/** @type {(path: readonly string[]) => (r: Result<unknown, unknown>) => void} */
const assertInexact = path => r => assertStructurallySame(assertError(r), inexactAt(path))

const revisionValue = {
    dialect,
    subject: '8',
    parents: [],
    snapshot: '8',
    generation: 0,
}

export const proof = {
    // A valid revision blob is recognized and reported under its derived media type.
    validRevision: () => {
        const m = detectRevision(utf8Bytes(revisionJson))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // Key order carries no meaning: a valid revision whose `dialect` key is
    // not first must still be detected.
    keyOrderIndependent: () => {
        const text = `{"parents":[],"subject":"8","dialect":"${dialect}","snapshot":"8","generation":0}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // A revision missing a required field (here `snapshot` and `generation`)
    // fails validation and falls through to the ordinary text/plain
    // classification.
    invalidRevisionFallsThrough: () => {
        const text = `{"dialect":"${dialect}","subject":"8","parents":["8","r"]}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // The refinement path: structurally a revision, but `snapshot` is not
    // a cbase32 hash, so `revisionDialect`'s refinement rejects it and the
    // verdict stays `text/plain` — exactly what `decodeText` would say.
    nonHashSnapshotFallsThrough: () => {
        const text = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"not a hash","generation":0}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // A valid shared-lock blob is recognized as its own dialect, alongside the
    // revision one, and reported under the derived media type.
    validLock: () => {
        const m = detectRevision(utf8Bytes(`{"dialect":"${lockDialectName}","lock":{"dependency":"8"}}`))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.lock+json')
    },

    // The two dialects never claim each other's blobs: each schema matches its
    // own `dialect` literal, so a revision carrying an inline `lock` is still a
    // revision, and a lock blob is never a revision.
    lockAndRevisionDoNotOverlap: () => {
        const withLock = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"8","generation":0,"lock":{"d":"8"}}`
        assertEq(detectRevision(utf8Bytes(withLock)).mime_type, 'application/vnd.fjs.revision+json')
        assertEq(detectRevision(utf8Bytes(revisionJson)).mime_type, 'application/vnd.fjs.revision+json')
    },

    // `lockDialect` carries the semantic check too: a structurally valid lock
    // blob whose binding is not a cbase32 hash is not detected as one, exactly
    // as its `decodeText` would say.
    nonHashLockValueFallsThrough: () => {
        const text = `{"dialect":"${lockDialectName}","lock":{"dependency":"not a hash"}}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // The note dialect is registered with no refinement, so structure alone
    // decides the match — a valid note is recognized alongside its siblings.
    validNote: () => {
        const m = detectRevision(utf8Bytes(`{"dialect":"${noteDialectName}","text":"hi"}`))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.note+json')
        // Same tag, wrong shape: no entry matches.
        assertEq(detectRevision(utf8Bytes(`{"dialect":"${noteDialectName}","text":42}`)).mime_type, 'text/plain')
    },

    // The name is neither grammar-checked nor allowlisted: a dialect outside
    // `vnd.fjs.*` yields its own derived media type.
    nonVndDialectName: () => {
        const m = detect([gadgetDialect])(utf8Bytes('{"dialect":"application.gadget","size":3}'))
        assertEq(m.mime_type, 'application/application.gadget+json')
    },

    // Entries are tried in order and the first match wins.
    firstMatchWins: () => {
        const bytes = utf8Bytes('{}')
        assertEq(detect([anyEntry('vnd.fjs.a'), anyEntry('vnd.fjs.b')])(bytes).mime_type, 'application/vnd.fjs.a+json')
        assertEq(detect([anyEntry('vnd.fjs.b'), anyEntry('vnd.fjs.a')])(bytes).mime_type, 'application/vnd.fjs.b+json')
    },

    // An empty registry recognizes nothing; every blob keeps the
    // `fjs/media/type` verdict.
    noDialects: () => {
        const m = detect([])(utf8Bytes(revisionJson))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Ordinary JSON with no `dialect` field at all falls through unchanged.
    ordinaryJsonFallsThrough: () => {
        const m = detectRevision(utf8Bytes('{"hello":"world"}'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Plain (non-JSON) text is unaffected: the parse fails and the
    // `fjs/media/type` verdict stands.
    plainTextFallsThrough: () => {
        const m = detectRevision(utf8Bytes('hello'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Binary content (magic-byte hit) is unaffected by dialect detection.
    binaryFallsThrough: () => {
        const m = detectRevision(u8ListToVecMsb([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        assertEq(m.type, 'base64')
        assertEq(m.mime_type, 'image/png')
    },

    // A large blob is still bounded by the single-`Vec` `maxLength` cap; this
    // only exercises that dialect detection doesn't change size handling for
    // non-JSON content within that bound.
    largeNonJsonWithinBound: () => {
        const a = repeat(1_000n)(vec8(0x61n)) // 1,000 bytes of 'a'
        const m = detectRevision(a)
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    jsonDialect: {
        // The literal tag and its media type, derived by the rule `detect` uses.
        dialectAndMediaType: () => {
            assertEq(kinds.dialect, 'vnd.fjs.kinds')
            assertEq(kinds.mediaType, 'application/vnd.fjs.kinds+json')
            assertEq(kinds.entry.dialect, 'vnd.fjs.kinds')
        },

        // `revisionSchema`'s `lock` is recursive (`lock → lockValue → lock`);
        // the construction check walks its data form, which closes the cycle
        // by identity, so building the kit terminates.
        recursiveSchemaConstructs: () => {
            assertEq(revisionKit.mediaType, 'application/vnd.fjs.revision+json')
        },

        // A dialect with no refinement accepts `-0` at a `number` member and
        // keeps it: the standard serializer spells it `-0`. Its error type is
        // the shape check's alone — the factory's `E` defaults to `never`, so
        // a JavaScript call site that passes no refinement does not infer
        // `any` for it.
        noRefinementAcceptsNegativeZero: () => {
            const r = kinds.validate(kindsBlob)
            /** @typedef {Assert<Equal<Extract<typeof r, readonly ['error', unknown]>[1], ValidationError>>} _NoRefinementError */
            const v = assertOk(r)
            assert(Object.is(v.list[1], -0))
            assertEq(kinds.encodeText(v).includes('-0'), true)
        },

        // A number without an exact JSON spelling is a `ValidationError`
        // naming its path, whether it came from a hand-built value (`NaN`) or
        // from JSON text (`1e400` reads as `Infinity`).
        inexactGenerationRejected: () => {
            assertInexact(['generation'])(revisionKit.validate({ ...revisionValue, generation: NaN }))
            assertInexact(['generation'])(revisionKit.validate({ ...revisionValue, generation: Infinity }))
            assertInexact(['generation'])(revisionKit.decodeText('{"dialect":"vnd.fjs.revision","subject":"8","parents":[],"snapshot":"8","generation":1e400}'))
        },

        // The number check is the factory's own, run before the refinement,
        // so an identity refinement over `array(number)` cannot waive it.
        identityRefinementStillRejectsNaN: () => {
            assertInexact(['list', '1'])(kindsIdentity.validate({ ...kindsBlob, list: [1, NaN] }))
        },

        // A refinement may return a new value. The factory checks that value
        // again, so a refinement that swaps a finite number for `NaN` gets a
        // path error instead of an `ok` that `encodeText` would refuse.
        refinedValueRechecked: () => {
            const nanList = jsonDialect(kindsSchema, v => ok({ ...v, list: [NaN] }))
            assertInexact(['list', '0'])(nanList.validate(kindsBlob))
        },

        // The fixpoint is on `validate`'s output: re-encoding and decoding it
        // gives the same value back, `-0` and all.
        fixpoint: () => {
            const x = { ...revisionValue, generation: 3, lock: { a: '8', b: { c: 'r' } }, future: 1 }
            const v = assertOk(revisionKit.validate(x))
            assertStructurallySame(assertOk(revisionKit.decodeText(revisionKit.encodeText(v))), v)
            const k = assertOk(kinds.validate(kindsBlob))
            assertStructurallySame(assertOk(kinds.decodeText(kinds.encodeText(k))), k)
        },

        // Why the fixpoint is stated on the output: an `open` schema accepts
        // an undeclared member and the value it returns does not carry it.
        extrasDropped: () => {
            const v = assertOk(revisionKit.validate({ ...revisionValue, future: 1 }))
            assertEq('future' in v, false)
        },

        // The refinement's error joins the kit's.
        refinementError: () => {
            assertEq(typeof assertError(revisionKit.validate({ ...revisionValue, snapshot: 'not a hash' })), 'string')
        },

        // `entry` matches through `validate`: a blob whose only fault is a
        // `1e400` is refused by `decodeText` and not classified by `detect`.
        entryIsValidate: () => {
            const gadget = jsonDialect(open(/** @type {const} */ ({ dialect: 'vnd.fjs.gadget', size: number })))
            const text = '{"dialect":"vnd.fjs.gadget","size":1e400}'
            assertInexact(['size'])(gadget.decodeText(text))
            assertEq(detect([gadget.entry])(utf8Bytes(text)).mime_type, 'text/plain')
            assertEq(detect([gadget.entry])(utf8Bytes('{"dialect":"vnd.fjs.gadget","size":3}')).mime_type, 'application/vnd.fjs.gadget+json')
        },

        throw: {
            // A member JSON cannot spell is refused when the kit is built,
            // not at the first `encodeText`. The parameter type refuses these
            // schemas too, so the calls go through an untyped reference to
            // reach the runtime check.
            bigintMember: () => untypedJsonDialect(open({ dialect: 'x', n: bigint })),
            undefinedMember: () => untypedJsonDialect(open({ dialect: 'x', u: or(undefined, string) })),
            unknownMember: () => untypedJsonDialect(open({ dialect: 'x', u: unknown })),
            nestedBigint: () => untypedJsonDialect(open({ dialect: 'x', a: array(bigint) })),
            bigintConstMember: () => untypedJsonDialect(open({ dialect: 'x', n: 5n })),

            // `encodeText` takes a value no one has to have validated, and
            // refuses a leaf JSON cannot spell before serializing it. A `NaN`
            // would otherwise be written as `null`; a `bigint` would reach the
            // standard serializer, which has no `bigint` arm and throws
            // `no bigint arm` — the check refuses it first, naming its path.
            encodeNaN: () => revisionKit.encodeText({ ...revisionValue, generation: NaN }),
            encodeExtraBigint: () => {
                const r = { ...revisionValue, future: 1n }
                return revisionKit.encodeText(r)
            },
        },
    },

    throw: {
        // The `dialect` member must be a direct string const. A thunk-form one
        // is a valid rtti schema but is not registerable, and `jsonDialect`
        // says so when the kit is built rather than per blob.
        thunkDialectMember: () => jsonDialect(open({ dialect: string })),

        // A schema with no `dialect` member at all is likewise refused.
        noDialectMember: () => jsonDialect(open({ text: string })),
    },
}
