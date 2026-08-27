/**
 * @import { Object as JsonObject } from '../json/types.ts'
 * @import { LockMap } from '../revision/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { dialect, mediaType, checkReferences, validate, decodeText, encodeText } from './module.f.mjs'
import {
    dialect as revisionDialect,
    encodeText as revisionEncodeText,
    validate as revisionValidate,
} from '../revision/module.f.mjs'
import { stringify } from '../json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

// Valid cbase32 hashes (round-tripped in fjs/basen/cbase32/proof.f.mjs): single
// cbase32 symbols, cheap to write inline here.
const h1 = '8'
const h2 = 'r'

/** A shape-valid lock blob holding `lock`.
 * @type {(lock: JsonObject) => JsonObject}
 */
const lockOf = lock => ({ dialect, lock })

/**
 * The one map both forms are asked to carry — nested, so the claim covers
 * every depth rather than just the top level.
 * @type {LockMap}
 */
const sharedMap = { C: { D: h2, C: h1 }, B: { D: h1 } }

/** The canonical rendering of a lock map on its own, independent of either blob. */
const canonicalMap = stringify(sort)

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.lock')
        assertEq(mediaType, 'application/vnd.fjs.lock+json')
    },

    validate: {
        // The ordinary case: a flat map of subject-to-content bindings.
        flatMapAccepted: () => {
            const r = validate(lockOf({ dependency: h1 }))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock.dependency, h1)
        },

        // An empty map is a lock blob that records no bindings — distinct from
        // a revision omitting `lock`, and the reason the field is required.
        emptyMapAccepted: () => {
            const r = validate(lockOf({}))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(Object.keys(r[1].lock).length, 0)
        },

        // Nesting is the revision dialect's, unchanged: scopes to any depth.
        nestedMapAccepted: () => {
            const [t] = validate(lockOf({ B: { C: { D: { E: h1 } } }, empty: {} }))
            assertEq(t, 'ok')
        },

        // `lock` is required: a blob carrying only the tag is not one.
        missingLockRejected: () => {
            const [t] = validate({ dialect })
            assertEq(t, 'error')
        },

        // The field is a map, never a hash — a lock blob does not reference
        // further lock blobs, so following a reference terminates in one step.
        referenceLockRejected: () => {
            const [t] = validate({ dialect, lock: h1 })
            assertEq(t, 'error')
        },

        // A value must be a string or a map: a number fails structurally.
        malformedMapRejected: () => {
            const [t] = validate(lockOf({ dependency: 1 }))
            assertEq(t, 'error')
        },

        // The semantic check is the revision dialect's own, so a non-hash
        // string is rejected here with the same path-naming message.
        invalidHashRejected: () => {
            const r = validate(lockOf({ B: { D: 'https://example.com/x' } }))
            assert(r[0] === 'error', ['expected error', r])
            assertEq(r[1], 'lock value for B/D is not a valid hash: https://example.com/x')
        },

        // No `subject`, `parents`, `generation` or `archived`: this dialect is
        // a value, not a step. `lockSchema` says `open`, so such fields are
        // ignored rather than rejected — the additive forward-compatibility
        // path, the same one the revision dialect relies on.
        revisionFieldsIgnored: () => {
            const [t] = validate({ dialect, lock: {}, subject: h1, parents: [], generation: 0 })
            assertEq(t, 'ok')
        },

        // A revision blob is not a lock blob: the tag is matched as an exact
        // literal, so the two dialects never validate each other's content.
        revisionBlobRejected: () => {
            const [t] = validate({
                dialect: revisionDialect,
                subject: h1,
                parents: [],
                snapshot: h2,
                generation: 0,
                lock: {},
            })
            assertEq(t, 'error')
        },
    },

    // The already-typed entry point, for callers that assembled a `Lock`
    // themselves and need only the semantic half.
    checkReferences: {
        valid: () => {
            const [t] = checkReferences({ dialect, lock: { dependency: h1 } })
            assertEq(t, 'ok')
        },
        invalid: () => {
            const [t] = checkReferences({ dialect, lock: { dependency: 'not a hash!' } })
            assertEq(t, 'error')
        },
    },

    decodeText: {
        validJson: () => {
            const r = decodeText(JSON.stringify(lockOf({ dependency: h1 })))
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].lock.dependency, h1)
        },

        // Key order carries no meaning: the JSON is parsed and the parsed
        // value validated, so `dialect` need not come first.
        keyOrderIndependent: () => {
            const [t] = decodeText(`{"lock":{"dependency":"${h1}"},"dialect":"${dialect}"}`)
            assertEq(t, 'ok')
        },

        malformedJsonRejected: () => {
            const [t] = decodeText('{not json')
            assertEq(t, 'error')
        },

        ordinaryJsonRejected: () => {
            const [t] = decodeText('{"hello":"world"}')
            assertEq(t, 'error')
        },
    },

    encodeText: {
        recursivelySortsObjectsLexicographically: () => {
            const decoded = validate(lockOf({ scope: { '2': h2, '10': h1 }, '2': h2, '10': h1 }))
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assertEq(
                encodeText(decoded[1]),
                `{"dialect":"${dialect}","lock":{"10":"${h1}","2":"${h2}","scope":{"10":"${h1}","2":"${h2}"}}}`,
            )
        },

        // Two blobs differing only in property order converge on one byte
        // sequence, so they address the same CAS blob — which is the whole
        // point of sharing one.
        equivalentOrdersConverge: () => {
            const a = validate(lockOf({ B: { B: h1, D: h2 }, C: { D: h1 } }))
            const b = validate(lockOf({ C: { D: h1 }, B: { D: h2, B: h1 } }))
            assert(a[0] === 'ok', ['expected ok', a])
            assert(b[0] === 'ok', ['expected ok', b])
            assertEq(encodeText(a[1]), encodeText(b[1]))
        },
    },

    // The point of importing `lock` rather than restating it: one map, one
    // canonical rendering, whether it is held inline by a revision or shared
    // as a blob of its own. The two dialects have different field sets, so the
    // surrounding bytes differ — the map's do not, and a resolver reading
    // either form sees the identical bytes under `lock`.
    inlineAndSharedSerializeIdentically: () => {
        const fragment = `"lock":${canonicalMap(sharedMap)}`
        const shared = validate(lockOf(sharedMap))
        assert(shared[0] === 'ok', ['expected ok', shared])
        const inline = revisionValidate({
            dialect: revisionDialect,
            subject: h1,
            parents: [],
            snapshot: h2,
            generation: 0,
            lock: sharedMap,
        })
        assert(inline[0] === 'ok', ['expected ok', inline])
        assert(encodeText(shared[1]).includes(fragment), encodeText(shared[1]))
        assert(revisionEncodeText(inline[1]).includes(fragment), revisionEncodeText(inline[1]))
    },
}
