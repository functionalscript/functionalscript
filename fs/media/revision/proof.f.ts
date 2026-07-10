import { assert, assertEq } from '../../asserts/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'
import {
    decodeRevision,
    dialect,
    encodeRevision,
    mediaType,
    validateRevision,
    type Revision,
} from './module.f.ts'

// Two distinct, arbitrary-but-valid cbase32 hashes (see fs/basen/cbase32/proof.f.ts).
const hashA = '2g'
const hashB = '01'

export const proof = {
    constants: () => {
        assertEq(dialect, 'vnd.fjs.revision')
        assertEq(mediaType, 'application/vnd.fjs.revision+json')
    },
    firstRevisionFallbackSubject: () => {
        // Zero parents, no snapshot: `subject` doubles as the snapshot reference
        // and must be a hash.
        const revision = unwrap(validateRevision({ dialect, subject: hashA, parents: [] }))
        assertEq(revision.subject, hashA)
        assertEq(revision.parents.length, 0)
    },
    firstRevisionNonHashSubjectRejected: () => {
        const result = validateRevision({ dialect, subject: 'not-a-hash-!!', parents: [] })
        assert(result[0] === 'error', result)
    },
    snapshotAllowsArbitrarySubject: () => {
        // Any subject identity string is fine once `snapshot` supplies the reference.
        const revision = unwrap(validateRevision({
            dialect, subject: '{hashA}-nonce', parents: [], snapshot: hashA,
        }))
        assertEq(revision.snapshot, hashA)
    },
    snapshotMustBeHash: () => {
        const result = validateRevision({ dialect, subject: 'x', parents: [], snapshot: 'https://example/x' })
        assert(result[0] === 'error', result)
    },
    parentsMustBeHashes: () => {
        const result = validateRevision({ dialect, subject: 'x', parents: [hashA, 'https://example/y'] })
        assert(result[0] === 'error', result)
    },
    singleParentInheritsSnapshot: () => {
        // No snapshot, exactly one parent: the parent's snapshot is inherited,
        // so `subject` need not be a hash.
        const revision = unwrap(validateRevision({ dialect, subject: 'my-doc', parents: [hashA] }))
        assertEq(revision.parents.length, 1)
    },
    multipleParentsRequireSnapshot: () => {
        const result = validateRevision({ dialect, subject: 'x', parents: [hashA, hashB] })
        assert(result[0] === 'error', result)
    },
    multipleParentsWithSnapshotValid: () => {
        // A merge revision: snapshot supplied explicitly, so the >1-parents
        // fallback ambiguity does not apply.
        const revision = unwrap(validateRevision({
            dialect, subject: 'x', parents: [hashA, hashB], snapshot: hashA,
        }))
        assertEq(revision.parents.length, 2)
    },
    generationAndArchived: () => {
        const revision = unwrap(validateRevision({
            dialect, subject: hashA, parents: [], generation: 0, archived: true,
        }))
        assertEq(revision.generation, 0)
        assertEq(revision.archived, true)
    },
    structuralValidationFailure: () => {
        // Wrong dialect tag: fails rtti's struct validation before the semantic checks run.
        const result = validateRevision({ dialect: 'vnd.fjs.other', subject: hashA, parents: [] })
        assert(result[0] === 'error', result)
    },
    decodeRoundTrip: () => {
        const text = '{"dialect":"vnd.fjs.revision","subject":"2g","parents":[]}'
        const revision = unwrap(decodeRevision(text))
        assertEq(revision.subject, hashA)
        const encoded = encodeRevision(revision)
        assertEq(encoded, text)
        const roundTripped: Revision = unwrap(decodeRevision(encoded))
        assertEq(roundTripped.subject, revision.subject)
    },
    decodeMalformedJson: () => {
        const result = decodeRevision('{')
        assert(result[0] === 'error', result)
    },
    encodeIncludesSnapshot: () => {
        const revision = unwrap(validateRevision({
            dialect, subject: 'x', parents: [hashA], snapshot: hashB,
        }))
        const encoded = encodeRevision(revision)
        assertEq(encoded, '{"dialect":"vnd.fjs.revision","subject":"x","parents":["2g"],"snapshot":"01"}')
    },
    encodeKeepsDialectFirstEvenAfterDecode: () => {
        // `archived` sorts before `dialect` alphabetically; the JSON parser's
        // OrderedMap reorders decoded keys that way, so `encodeRevision` must
        // rebuild canonical field order rather than trust the decoded value's
        // own key order.
        const text = '{"dialect":"vnd.fjs.revision","subject":"2g","parents":[],"generation":3,"archived":true}'
        const revision = unwrap(decodeRevision(text))
        const encoded = encodeRevision(revision)
        assert(encoded.startsWith('{"dialect":"vnd.fjs.revision"'), encoded)
    },
}
