import { assert, assertEq } from '../../asserts/module.f.ts'
import type { Object as JsonObject } from '../json/module.f.ts'
import { dialect, mediaType, isHash, validate, decodeText } from './module.f.ts'

// Valid cbase32 hashes (round-tripped in fs/basen/cbase32/proof.f.ts): single
// cbase32 symbols, cheap to write inline here.
const h1 = '8'
const h2 = 'r'

// A shape-valid revision: every required field present (`snapshot` and
// `generation` included), with `extra` overriding or adding fields per test.
const revisionOf = (extra: JsonObject): JsonObject => ({
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

        // `archived` follows the presence-only `option(true)` idiom.
        archivedAccepted: () => {
            const [t] = validate(revisionOf({ archived: true }))
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

        // rtti structs are open: extra fields don't break validation — the
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
        // here — `fs/media`'s composed detector is what falls back to the
        // ordinary detector; this module only reports validity.
        ordinaryJsonRejected: () => {
            const [t] = decodeText('{"hello":"world"}')
            assertEq(t, 'error')
        },
    },
}
