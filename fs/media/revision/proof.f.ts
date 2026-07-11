import { assert, assertEq } from '../../asserts/module.f.ts'
import type { Object as JsonObject } from '../json/module.f.ts'
import { dialect, mediaType, isHash, validate, decodeText, type Revision } from './module.f.ts'

// Valid cbase32 hashes (round-tripped in fs/basen/cbase32/proof.f.ts): single
// cbase32 symbols, cheap to write inline here.
const h1 = '8'
const h2 = 'r'

const revisionOf = (extra: JsonObject): JsonObject => ({
    dialect,
    subject: h1,
    parents: [],
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
        // Zero parents, no `snapshot`: `subject` is the fallback snapshot
        // reference and must itself be a hash.
        firstRevisionFallsBackToSubjectHash: () => {
            const [t] = validate(revisionOf({}))
            assertEq(t, 'ok')
        },

        // Zero parents, no `snapshot`, `subject` is not a hash: invalid.
        firstRevisionRejectsNonHashSubject: () => {
            const [t] = validate(revisionOf({ subject: 'my-config' }))
            assertEq(t, 'error')
        },

        // `snapshot` present: `subject` may be an arbitrary string.
        explicitSnapshotAllowsArbitrarySubject: () => {
            const [t] = validate(revisionOf({ subject: 'my-config', snapshot: h2 }))
            assertEq(t, 'ok')
        },

        // Exactly one parent, no `snapshot`: the parent's snapshot is inherited,
        // and `subject` may be an arbitrary string.
        singleParentInheritsSnapshot: () => {
            const [t] = validate(revisionOf({ subject: 'my-config', parents: [h2] }))
            assertEq(t, 'ok')
        },

        // More than one parent with no `snapshot`: invalid — no single parent
        // snapshot to inherit, and falling back to `subject` would silently
        // lose the merge result.
        multiParentWithoutSnapshotRejected: () => {
            const [t] = validate(revisionOf({ subject: 'my-config', parents: [h1, h2] }))
            assertEq(t, 'error')
        },

        // A merge revision with an explicit `snapshot` is valid.
        multiParentWithSnapshotAccepted: () => {
            const [t, v] = validate(revisionOf({ subject: 'my-config', parents: [h1, h2], snapshot: h2 }))
            assertEq(t, 'ok')
            assertEq((v as Revision).snapshot, h2)
        },

        // `https://` bridge URLs are rejected wherever a hash is required.
        httpsRejectedInParents: () => {
            const [t] = validate(revisionOf({ subject: 'my-config', parents: ['https://example.com/x'], snapshot: h2 }))
            assertEq(t, 'error')
        },

        httpsRejectedInSnapshot: () => {
            const [t] = validate(revisionOf({ subject: 'my-config', snapshot: 'https://example.com/x' }))
            assertEq(t, 'error')
        },

        httpsRejectedAsFallbackSubject: () => {
            const [t] = validate(revisionOf({ subject: 'https://example.com/x' }))
            assertEq(t, 'error')
        },

        // `archived` follows the presence-only `option(true)` idiom.
        archivedAccepted: () => {
            const [t] = validate(revisionOf({ archived: true }))
            assertEq(t, 'ok')
        },

        // Wrong dialect tag: structural validation rejects it outright.
        wrongDialectRejected: () => {
            const [t] = validate({ dialect: 'vnd.fjs.other', subject: h1, parents: [] })
            assertEq(t, 'error')
        },

        // Missing required fields: rejected.
        missingSubjectRejected: () => {
            const [t] = validate({ dialect, parents: [] })
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
            const [t, v] = decodeText(JSON.stringify(revisionOf({ generation: 0 })))
            assertEq(t, 'ok')
            assertEq((v as Revision).subject, h1)
        },

        // Key order carries no meaning: detection parses the JSON and
        // validates the parsed value, so `dialect` need not be first.
        keyOrderIndependent: () => {
            const text = `{"parents":[],"subject":"${h1}","dialect":"${dialect}"}`
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
