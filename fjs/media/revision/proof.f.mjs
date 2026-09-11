/**
 * @import { Object as JsonObject } from '../json/types.ts'
 * @import { LockMap } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { dialect, mediaType, isHash, validate, decodeText, encodeText } from './module.f.mjs'

// Valid cbase32 hashes (round-tripped in fjs/basen/cbase32/proof.f.mjs): single
// cbase32 symbols, cheap to write inline here.
const h1 = '8'
const h2 = 'r'
// `I` is accepted as an alias spelling of canonical cBase32 `1`.
const alias = /** @type {const} */ ('I')

/** @type {LockMap} */
const _lockMapAllowsMissingSubjects = {}

// A lock map's values are `string | LockMap | undefined` at every depth, so
// the same value is a legal binding for a direct hash and for a nested scope.
/** @type {LockMap} */
const _lockMapNests = { direct: h1, scope: { direct: h2, deeper: { direct: h1 } } }

// A shape-valid revision: every required field present (`snapshot` and
// `generation` included), with `extra` overriding or adding fields per test.
/** @type {(extra: JsonObject) => JsonObject} */
const revisionOf = extra => ({
    dialect,
    subject: h1,
    parents: [],
    snapshot: h2,
    generation: 0,
    ...extra,
})

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.revision')
        assertEq(mediaType, 'application/vnd.fjs.revision+json')
    },

    isHash: {
        validHash: () => assert(isHash(h1)),
        httpsRejected: () => assert(!isHash('https://example.com/blob/abc')),
        arbitraryStringRejected: () => assert(!isHash('not-a-hash!')),
    },

    validate: {
        // A fully explicit revision validates.
        allFieldsPresent: () => {
            const [t] = validate(revisionOf({}))
            assertEq(t, 'ok')
        },

        // `subject` is a pure identity string, never a snapshot reference: a
        // zero-parent revision whose `subject` is not a hash is now valid,
        // because `snapshot` is always stated explicitly.
        nonHashSubjectAccepted: () => {
            const r = validate(revisionOf({ subject: 'my-config' }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].subject, 'my-config')
        },

        // A merge revision (more than one parent) is valid like any other —
        // there is no "multiple parents without snapshot" case left, because
        // `snapshot` is required.
        multiParentAccepted: () => {
            const r = validate(revisionOf({ subject: 'my-config', parents: [h1, h2], snapshot: h2 }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].snapshot, h2)
        },

        // `snapshot` is required: absent is a shape error.
        missingSnapshotRejected: () => {
            const [t] = validate({ dialect, subject: h1, parents: [], generation: 0 })
            assertEq(t, 'error')
        },

        // `snapshot` must decode as a hash — `https://` bridge URLs rejected.
        nonHashSnapshotRejected: () => {
            const [t] = validate(revisionOf({ snapshot: 'https://example.com/x' }))
            assertEq(t, 'error')
        },

        // `generation` is required: absent is a shape error.
        missingGenerationRejected: () => {
            const [t] = validate({ dialect, subject: h1, parents: [], snapshot: h2 })
            assertEq(t, 'error')
        },

        // `generation` must be an integer: a fractional value is rejected.
        nonIntegerGenerationRejected: () => {
            const [t] = validate(revisionOf({ generation: 1.5 }))
            assertEq(t, 'error')
        },

        // `generation` must be non-negative.
        negativeGenerationRejected: () => {
            const [t] = validate(revisionOf({ generation: -1 }))
            assertEq(t, 'error')
        },

        // `generation` must be a *safe* integer: at `2 ** 53` and above the
        // value is no longer uniquely representable, so `1 + max(...)` could
        // fail to advance — such a blob is rejected (`Number.isInteger` would
        // accept it; `Number.isSafeInteger` does not).
        unsafeIntegerGenerationRejected: () => {
            const [t] = validate(revisionOf({ generation: 2 ** 53 }))
            assertEq(t, 'error')
        },

        // A positive integer generation is accepted.
        positiveGenerationAccepted: () => {
            const r = validate(revisionOf({ parents: [h1], generation: 3 }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].generation, 3)
        },

        // `https://` bridge URLs are rejected wherever a hash is required.
        httpsRejectedInParents: () => {
            const [t] = validate(revisionOf({ parents: ['https://example.com/x'] }))
            assertEq(t, 'error')
        },

        // `archived` follows the presence-only `or(option, true)` idiom.
        archivedAccepted: () => {
            const [t] = validate(revisionOf({ archived: true }))
            assertEq(t, 'ok')
        },

        lockAbsentAccepted: () => {
            const r = validate(revisionOf({}))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock, undefined)
        },

        emptyLockAccepted: () => {
            const r = validate(revisionOf({ lock: {} }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(Object.keys(r[1].lock ?? {}).length, 0)
        },

        validLockAccepted: () => {
            const [t] = validate(revisionOf({ lock: { dependency: h1 } }))
            assertEq(t, 'ok')
        },

        malformedLockRejected: () => {
            const [t] = validate(revisionOf({ lock: { dependency: 1 } }))
            assertEq(t, 'error')
        },

        invalidHashLockRejected: () => {
            const [t] = validate(revisionOf({ lock: { dependency: 'https://example.com/x' } }))
            assertEq(t, 'error')
        },

        aliasHashLockAccepted: () => {
            const [t] = validate(revisionOf({ lock: { dependency: alias } }))
            assertEq(t, 'ok')
        },

        // A nested map scopes further bindings under a subject — the
        // incompatible-diamond case from the README, where `B` and `C` each
        // pick their own `D`.
        nestedLockAccepted: () => {
            const r = validate(revisionOf({ lock: { B: { B: h1, D: h1 }, C: { C: h2, D: h2 } } }))
            assert(r[0] === 'ok', ['expected ok', r])
            assert(encodeText(r[1]).includes(`"lock":{"B":{"B":"${h1}","D":"${h1}"},"C":{"C":"${h2}","D":"${h2}"}}`))
        },

        // Nesting has no depth limit, and a nested map may be sparse — it need
        // not bind the subject it appears under, or anything at all.
        deeplyNestedLockAccepted: () => {
            const [t] = validate(revisionOf({ lock: { B: { C: { D: { E: h1 } } }, empty: {} } }))
            assertEq(t, 'ok')
        },

        // A direct value must be a string or a map at every depth: a number
        // nested two levels down fails structural (rtti) validation, exactly
        // as it does at the root.
        malformedNestedLockRejected: () => {
            const [t] = validate(revisionOf({ lock: { B: { D: 1 } } }))
            assertEq(t, 'error')
        },

        // Semantic reference checking recurses too: a non-hash string deep in
        // a nested scope is rejected, and the message names the path to it.
        invalidNestedHashLockRejected: () => {
            const r = validate(revisionOf({ lock: { B: { D: 'https://example.com/x' } } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock value for B/D is not a valid hash: https://example.com/x')
        },

        // In place of the map, `lock` may be the hash of a `vnd.fjs.lock`
        // blob holding one — the only position where a string means "where
        // the bindings are" rather than "this dependency's content".
        sharedLockReferenceAccepted: () => {
            const r = validate(revisionOf({ lock: h1 }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock, h1)
        },

        // A reference is validated as a cbase32 hash and nothing more — the
        // same contract `snapshot` has — so a non-hash one is rejected.
        invalidSharedLockReferenceRejected: () => {
            const r = validate(revisionOf({ lock: 'https://example.com/lock' }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock reference is not a valid hash: https://example.com/lock')
        },

        // Only the top level is widened: a nested value is still a hash or a
        // map, so nothing about an inline map's meaning changed.
        nestedValueIsStillNotAReference: () => {
            const [t] = validate(revisionOf({ lock: { B: { D: h1 } } }))
            assertEq(t, 'ok')
        },

        // Wrong dialect tag: structural validation rejects it outright.
        wrongDialectRejected: () => {
            const [t] = validate({ dialect: 'vnd.fjs.other', subject: h1, parents: [], snapshot: h2, generation: 0 })
            assertEq(t, 'error')
        },

        // Missing required fields: rejected.
        missingSubjectRejected: () => {
            const [t] = validate({ dialect, parents: [], snapshot: h2, generation: 0 })
            assertEq(t, 'error')
        },

        // `revisionSchema` says `open`: extra fields don't break validation — the
        // additive forward-compatibility path the versioning rule relies on.
        extraFieldsAccepted: () => {
            const [t] = validate(revisionOf({ future: 'field' }))
            assertEq(t, 'ok')
        },
    },

    decodeText: {
        validJson: () => {
            const r = decodeText(JSON.stringify(revisionOf({})))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].subject, h1)
        },

        // Key order carries no meaning: detection parses the JSON and
        // validates the parsed value, so `dialect` need not be first.
        keyOrderIndependent: () => {
            const text = `{"generation":0,"snapshot":"${h2}","parents":[],"subject":"${h1}","dialect":"${dialect}"}`
            const [t] = decodeText(text)
            assertEq(t, 'ok')
        },

        malformedJsonRejected: () => {
            const [t] = decodeText('{not json')
            assertEq(t, 'error')
        },

        // Ordinary JSON that isn't a revision at all falls through as an error
        // here — `fjs/media`'s composed detector is what falls back to the
        // ordinary detector; this module only reports validity.
        ordinaryJsonRejected: () => {
            const [t] = decodeText('{"hello":"world"}')
            assertEq(t, 'error')
        },
    },
    encodeText: {
        recursivelySortsObjectsLexicographically: () => {
            const revision = revisionOf({ lock: { '2': h2, '10': h1 } })
            const decoded = validate(revision)
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assertEq(
                encodeText(decoded[1]),
                `{"dialect":"${dialect}","generation":0,"lock":{"10":"${h1}","2":"${h2}"},"parents":[],"snapshot":"${h2}","subject":"${h1}"}`,
            )
        },
        // The one `stringify(sort)` rule already reaches every depth, so a
        // nested lock map needs no serialization special case: its keys sort
        // as strings like every other object's ("10" before "2").
        sortsNestedLockKeys: () => {
            const revision = revisionOf({ lock: { scope: { '2': h2, '10': h1 }, '2': h2, '10': h1 } })
            const decoded = validate(revision)
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assert(encodeText(decoded[1]).includes(
                `"lock":{"10":"${h1}","2":"${h2}","scope":{"10":"${h1}","2":"${h2}"}}`))
        },
        // Two nested maps differing only in property order converge on one
        // byte sequence, so they address the same CAS blob.
        equivalentNestedLockOrdersConverge: () => {
            const a = validate(revisionOf({ lock: { B: { B: h1, D: h2 }, C: { D: h1 } } }))
            const b = validate(revisionOf({ lock: { C: { D: h1 }, B: { D: h2, B: h1 } } }))
            assert(a[0] === 'ok', ['expected ok', a])
            assert(b[0] === 'ok', ['expected ok', b])
            assertEq(encodeText(a[1]), encodeText(b[1]))
        },
        // A shared-lock reference serializes as the plain string it is — no
        // wrapper, no marker: the two forms are told apart by JSON type.
        serializesSharedLockReferenceAsAString: () => {
            const decoded = validate(revisionOf({ lock: h1 }))
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assert(encodeText(decoded[1]).includes(`"lock":"${h1}"`))
        },
        preservesArrayOrder: () => {
            const decoded = validate(revisionOf({ parents: [h2, h1] }))
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assert(encodeText(decoded[1]).includes(`"parents":["${h2}","${h1}"]`))
        },
        parsedEquivalentSourcesConverge: () => {
            const a = decodeText(` { "subject":"${h1}", "snapshot":"${h2}", "parents":[], "generation":0, "dialect":"${dialect}" } `)
            const b = decodeText(`{"dialect":"${dialect}","generation":0,"parents":[],"snapshot":"${h2}","subject":"${h1}"}`)
            assert(a[0] === 'ok', ['expected ok', a])
            assert(b[0] === 'ok', ['expected ok', b])
            assertEq(encodeText(a[1]), encodeText(b[1]))
        },
    },
}

void _lockMapAllowsMissingSubjects
void _lockMapNests
