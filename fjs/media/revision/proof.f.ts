import { assert, assertEq, type Assert } from '../../asserts/module.f.ts'
import type { Equal } from '../../types/ts/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import type { Object as JsonObject } from '../json/module.f.ts'
import { dialect, mediaType, isHash, lock, validate, decodeText, checkReferences, type LockMap, type Revision } from './module.f.ts'

// The `lock` field is `unknown` at the rtti level (see the module doc), so the
// `Phantom` annotation is what keeps the derived type exact rather than
// widening to rtti's `Unknown`. The revision's field is that map or nothing.
type _LockMap = Assert<Equal<Ts<typeof lock>, LockMap>>
type _RevisionLock = Assert<Equal<Revision['lock'], LockMap | undefined>>
// A lookup that misses is `undefined`, not an error: partial maps are valid.
type _LockLookup = Assert<Equal<LockMap[string], string | LockMap | undefined>>

// Valid cbase32 hashes (round-tripped in fjs/basen/cbase32/proof.f.ts): single
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

    lock: {
        // `lock` is optional: every revision above validates without one.
        absent: () => {
            const r = validate(revisionOf({}))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock, undefined)
        },

        // An empty map is a valid map — it binds nothing, which is a resolver's
        // problem only if the resolver needed a binding.
        empty: () => {
            const r = validate(revisionOf({ lock: {} }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(JSON.stringify(r[1].lock), '{}')
        },

        // The common representation: subject → one content hash.
        flat: () => {
            const r = validate(revisionOf({ lock: { B: h1, C: h2 } }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock?.B, h1)
            assertEq(r[1].lock?.C, h2)
        },

        // A subject the map doesn't bind reads as `undefined` rather than
        // failing validation: partial maps are valid.
        missingLookup: () => {
            const r = validate(revisionOf({ lock: { B: h1 } }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock?.C, undefined)
        },

        // A leaf that isn't a cbase32 hash is a semantic error, and the message
        // names the subject path that carries it.
        invalidHash: () => {
            const r = validate(revisionOf({ lock: { B: 'https://example.com/x' } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock entry is not a valid hash: B = https://example.com/x')
        },

        // Nested maps carry scoped information — here the incompatible-diamond
        // case `A -> B -> D(v1)` / `A -> C -> D(v2)` — and survive validation
        // with their structure intact. The format records the nesting; what it
        // means (overlay, replacement, inheritance) is the resolver's rule.
        nested: () => {
            const nested = {
                B: { B: h1, D: h1 },
                C: { C: h2, D: h2 },
            }
            const r = validate(revisionOf({ lock: nested }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(JSON.stringify(r[1].lock), JSON.stringify(nested))
        },

        // Nesting is walked to any depth, and an invalid leaf deep inside is
        // reported with its full subject path. The map also omits the subject
        // it appears under (`B` binds no `B`) — structurally fine.
        nestedInvalidHash: () => {
            const r = validate(revisionOf({ lock: { B: { C: { A: 'not-a-hash!' } } } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock entry is not a valid hash: B.C.A = not-a-hash!')
        },

        // A non-map deep inside is reported with its full subject path too.
        nestedNonMapRejected: () => {
            const r = validate(revisionOf({ lock: { B: { C: [1] } } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock entry is not a hash or a nested map: B.C')
        },

        // Malformed values are errors: a lock value is a hash string or another
        // map, never a number, an array, or `null`.
        numberValueRejected: () => {
            const r = validate(revisionOf({ lock: { B: 0 } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock entry is not a hash or a nested map: B')
        },

        arrayValueRejected: () => {
            const [t] = validate(revisionOf({ lock: { B: [h1] } }))
            assertEq(t, 'error')
        },

        nullValueRejected: () => {
            const [t] = validate(revisionOf({ lock: { B: null } }))
            assertEq(t, 'error')
        },

        // The lock itself is a map of subjects, never a bare hash or any other
        // non-map — `lock` binds subjects, so there is nothing a scalar means.
        nonMapRootRejected: () => {
            const r = validate(revisionOf({ lock: h1 }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock is not a map')
        },

        arrayRootRejected: () => {
            const [t] = validate(revisionOf({ lock: [h1] }))
            assertEq(t, 'error')
        },

        nullRootRejected: () => {
            const [t] = validate(revisionOf({ lock: null }))
            assertEq(t, 'error')
        },

        // `checkLock` is the field's only check and is total over any input,
        // because `validate` is not the only door: `checkReferences` is called
        // directly by writers (evo's `addRevision`) on a value whose `lock`
        // TypeScript trusts and the runtime has never seen — an MCP `evo_add`
        // argument object keeps every undeclared key rtti validation ignored.
        // Each of these once passed the semantic walk and was stored as a
        // revision no reader would accept, or threw outright.
        checkReferencesRejectsMalformedLock: () => {
            const r = ({ dialect, subject: h1, parents: [], snapshot: h2, generation: 0 }) as const
            for (const lock of [null, 0, 'str', { B: 0 }, { B: [1] }, { B: { C: 7 } }]) {
                const [t] = checkReferences({ ...r, lock } as unknown as Revision)
                assertEq(t, 'error', ['expected error for lock', lock])
            }
        },

        // Nesting depth comes from untrusted input, so the walk must not spend
        // a stack frame per level. 2000 levels is ~12 KiB — far under the
        // 128 KiB inline cap — and used to throw `RangeError` out of
        // `decodeText`, which `fjs/cas/evo`'s store scan cannot contain
        // (FunctionalScript has no `try`/`catch`), stopping the scan instead of
        // skipping one blob. Well past that depth is now an ordinary result.
        deepNestingAccepted: () => {
            let lock = `"${h1}"`
            for (let i = 0; i < 20000; ++i) { lock = `{"B":${lock}}` }
            const [t] = decodeText(
                `{"dialect":"${dialect}","subject":"${h1}","parents":[],"snapshot":"${h2}","generation":0,"lock":${lock}}`)
            assertEq(t, 'ok')
        },

        // The same depth with a bad leaf reports an error rather than throwing.
        deepNestingInvalidLeafRejected: () => {
            let lock = '"not-a-hash!"'
            for (let i = 0; i < 20000; ++i) { lock = `{"B":${lock}}` }
            const [t] = decodeText(
                `{"dialect":"${dialect}","subject":"${h1}","parents":[],"snapshot":"${h2}","generation":0,"lock":${lock}}`)
            assertEq(t, 'error')
        },

        // An entry for the revision's own subject is structurally valid. It
        // supplies another resolution candidate next to the starting binding
        // `subject -> snapshot`; the format defines no precedence between them,
        // so accepting the blob is the only correct answer here.
        sameSubjectAccepted: () => {
            const r = validate(revisionOf({ subject: 'A', snapshot: h2, lock: { A: h1 } }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock?.A, h1)
        },

        // Mutually recursive subjects (A references B and C, B references A and
        // C) resolve from a flat map because entries select *snapshot* hashes,
        // never revision hashes: the revision's own bytes contain its lock map,
        // so a revision-hash entry would be uncomputable, while `h1`/`h2` here
        // are ordinary content addresses that close the cycle.
        cyclicSubjects: () => {
            const r = validate(revisionOf({ subject: 'A', snapshot: h1, lock: { B: h2, C: h1 } }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].snapshot, h1)
            assertEq(r[1].lock?.B, h2)
        },

        // Two revisions with the same snapshot and different locks are both
        // valid — the DAG records an external-resolution update the same way it
        // records a source change, and an application reads the difference by
        // comparing fields.
        dependencyOnlyChange: () => {
            const r0 = validate(revisionOf({ subject: 'A', snapshot: h2, lock: { B: h1 } }))
            const r1 = validate(revisionOf({ subject: 'A', snapshot: h2, parents: [h1], generation: 1, lock: { B: h2 } }))
            assert(r0[0] === 'ok', ['expected ok', r0])
            assert(r1[0] === 'ok', ['expected ok', r1])
            assertEq(r0[1].snapshot, r1[1].snapshot)
            assert(r0[1].lock?.B !== r1[1].lock?.B, ['expected different locks', r0, r1])
        },

        // A lock survives the JSON round trip like any other field.
        decodeText: () => {
            const r = decodeText(JSON.stringify(revisionOf({ lock: { B: { D: h1 } } })))
            assert(r[0] === 'ok', ['expected ok', r])
            const b = r[1].lock?.B
            assert(typeof b === 'object', ['expected a nested map', r])
            assertEq(b.D, h1)
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
}
