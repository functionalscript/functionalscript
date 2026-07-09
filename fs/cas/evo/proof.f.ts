import { assert, assertEq } from '../../asserts/module.f.ts'
import { vec8 } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../cbase32/module.f.ts'
import {
    actualGeneration,
    cachedGeneration,
    heads,
    isArchived,
    materialize,
    merge,
    mimeType,
    parseRevision,
    revision,
    verifyGeneration,
    type Entry,
    type Hash,
    type Ref,
    type Resolve,
    type Revision,
} from './module.f.ts'

// Two distinct real cbase32 hashes for parseRevision tests, which enforce
// that `object`/`parents` decode as genuine CAS addresses.
const objectHash = vecToCBase32(vec8(0x01n))
const parentHash = vecToCBase32(vec8(0x02n))
const bridgeUrl = 'https://example.com/doc'

const baseRevision = (): Revision => ({
    mimeType,
    object: objectHash,
    parents: [],
})

// A tiny in-memory resolver, used by the head/materialization/generation
// tests below: pure functions operating on plain string keys (heads,
// materialize, and generation checks never call `isHash`/`isRef` themselves
// — only `parseRevision` enforces the ref grammar, tested separately).
const storeOf = (entries: readonly Entry[]): Resolve => {
    const map: { [k: string]: Revision } = {}
    for (const e of entries) { map[e.hash] = e.revision }
    return h => map[h]
}

const entry = (hash: Hash, revision: Revision): Entry => ({ hash, revision })

export const proof = {
    // ── parseRevision ────────────────────────────────────────────────────────

    parseValidFirstRevision: () => {
        const r = parseRevision(baseRevision())
        assertEq(r[0], 'ok')
    },

    parseRejectsWrongMimeType: () => {
        const r = parseRevision({ ...baseRevision(), mimeType: 'text/plain' })
        assertEq(r[0], 'error')
    },

    // A parent is always a CAS blob: a bridge URL in `parents` must not validate,
    // even though the same string is a perfectly valid `object`/`content` ref.
    parseRejectsNonCasParent: () => {
        const r = parseRevision({ ...baseRevision(), parents: [bridgeUrl] })
        assertEq(r[0], 'error')
    },

    parseAcceptsCasHashParent: () => {
        const r = parseRevision({ ...baseRevision(), parents: [parentHash] })
        assertEq(r[0], 'ok')
    },

    parseAcceptsBridgeUrlObjectAndContent: () => {
        const r = parseRevision({ ...baseRevision(), object: bridgeUrl, content: bridgeUrl })
        assertEq(r[0], 'ok')
    },

    parseRejectsMalformedRef: () => {
        const r = parseRevision({ ...baseRevision(), object: 'not-a-ref-or-hash' })
        assertEq(r[0], 'error')
    },

    // ── heads ────────────────────────────────────────────────────────────────

    headsLinearHistory: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'] }
        const entries = [entry('r1', r1), entry('r2', r2)]
        assertEq(heads(obj)(entries).join(','), 'r2')
    },

    headsBranchAndMerge: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'] }
        const r3: Revision = { mimeType, object: obj, parents: ['r1'] }
        let entries = [entry('r1', r1), entry('r2', r2), entry('r3', r3)]
        // Two concurrent branches from the same root are both heads.
        assertEq([...heads(obj)(entries)].sort().join(','), 'r2,r3')
        const r4: Revision = { mimeType, object: obj, parents: ['r2', 'r3'], content: 'content-ref' }
        entries = [...entries, entry('r4', r4)]
        // A merge revision referencing both branch heads demotes them.
        assertEq(heads(obj)(entries).join(','), 'r4')
    },

    headsManyForOneObject: () => {
        const obj = 'obj'
        const entries = [
            entry('a', { mimeType, object: obj, parents: [] }),
            entry('b', { mimeType, object: obj, parents: [] }),
            entry('c', { mimeType, object: obj, parents: [] }),
        ]
        assertEq([...heads(obj)(entries)].sort().join(','), 'a,b,c')
    },

    // A revision of a *different* object referencing the same hash as a parent
    // must not demote a head of the object under test — the reverse index is
    // scoped per object.
    headsScopedPerObject: () => {
        const obj = 'obj'
        const other = 'other'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const unrelated: Revision = { mimeType, object: other, parents: ['r1'] }
        const entries = [entry('r1', r1), entry('u', unrelated)]
        assertEq(heads(obj)(entries).join(','), 'r1')
    },

    // A head can be demoted retroactively simply by re-running `heads` over a
    // larger `entries` set once a same-object child is synced in later.
    headDemotedRetroactivelyBySync: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const before = [entry('r1', r1)]
        assertEq(heads(obj)(before).join(','), 'r1')
        const r2: Revision = { mimeType, object: obj, parents: ['r1'] }
        const after = [...before, entry('r2', r2)]
        assertEq(heads(obj)(after).join(','), 'r2')
    },

    // ── materialize ──────────────────────────────────────────────────────────

    // A first revision with no parents, no content, and no changes materializes
    // from `object` itself — object identity is the initial content's hash.
    materializeFirstRevisionFromObject: () => {
        const obj = 'the-object-ref'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const resolve = storeOf([entry('r1', r1)])
        assertEq(materialize(resolve)(obj)(r1), obj)
    },

    // `content` has priority even when a parent is also present.
    materializeContentTakesPriority: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'], content: 'c2' }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2)])
        assertEq(materialize(resolve)(obj)(r2), 'c2')
    },

    // A revision with no `content` materializes through its single parent's
    // own materialization.
    materializeThroughParentChain: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [], content: 'c1' }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'] }
        const r3: Revision = { mimeType, object: obj, parents: ['r2'] }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2), entry('r3', r3)])
        assertEq(materialize(resolve)(obj)(r3), 'c1')
    },

    // `changes` replay is not implemented in the first iteration: a revision
    // with `changes` and no `content` cannot be materialized here.
    materializeUndefinedForChangesOnly: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [], changes: ['diff-ref'] }
        const resolve = storeOf([entry('r1', r1)])
        assertEq(materialize(resolve)(obj)(r1), undefined)
    },

    // A bare multi-parent revision (no `content`) cannot be materialized in the
    // first iteration — a merge revision must carry `content`.
    materializeUndefinedForMultiParentNoContent: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: [] }
        const merged: Revision = { mimeType, object: obj, parents: ['r1', 'r2'] }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2), entry('merged', merged)])
        assertEq(materialize(resolve)(obj)(merged), undefined)
    },

    materializeUndefinedForUnresolvedParent: () => {
        const obj = 'obj'
        const r2: Revision = { mimeType, object: obj, parents: ['missing'] }
        const resolve = storeOf([entry('r2', r2)])
        assertEq(materialize(resolve)(obj)(r2), undefined)
    },

    // ── generation ───────────────────────────────────────────────────────────

    generationMatchesActualChain: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'], generation: 1 }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2)])
        assert(verifyGeneration(resolve)(r2))
        assertEq(actualGeneration(resolve)('r2'), 1)
    },

    // A cached `generation` that disagrees with the actual parent chain (as an
    // untrusted/corrupted-sync revision might carry) must fail verification —
    // `generation` is a cache, not a source of truth.
    generationCacheMismatch: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'], generation: 5 }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2)])
        assert(!verifyGeneration(resolve)(r2))
    },

    generationAbsentIsTriviallyVerified: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [] }
        const resolve = storeOf([entry('r1', r1)])
        assert(verifyGeneration(resolve)(r1))
    },

    // `actualGeneration` never trusts a parent's own cached field: even if r1's
    // cache is wrong, r2's actual generation is derived from r1's real (empty)
    // parent chain, not from r1's lying cache.
    actualGenerationIgnoresParentsCorruptedCache: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [], generation: 99 }
        const r2: Revision = { mimeType, object: obj, parents: ['r1'] }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2)])
        assertEq(actualGeneration(resolve)('r2'), 1)
    },

    // ── archived ─────────────────────────────────────────────────────────────

    archivedObjectFlag: () => {
        const obj = 'obj'
        const active: Revision = { mimeType, object: obj, parents: [] }
        const archived: Revision = { mimeType, object: obj, parents: ['r'], archived: true }
        assert(!isArchived(active))
        assert(isArchived(archived))
    },

    // ── merge ────────────────────────────────────────────────────────────────

    mergeBuildsRevisionWithComputedGeneration: () => {
        const obj = 'obj'
        const r1: Revision = { mimeType, object: obj, parents: [], generation: 0 }
        const r2: Revision = { mimeType, object: obj, parents: [], generation: 0 }
        const resolve = storeOf([entry('r1', r1), entry('r2', r2)])
        const merged = merge(resolve)(obj)(['r1', 'r2'])('merged-content')
        assertEq(merged.mimeType, mimeType)
        assertEq(merged.object, obj)
        assertEq(merged.parents.join(','), 'r1,r2')
        assertEq(merged.content, 'merged-content')
        assertEq(merged.generation, 1)
    },

    // A merge revision built from real cbase32 hashes/refs validates cleanly
    // through the full `parseRevision` semantic check, not just the schema shape.
    mergeOutputValidates: () => {
        const obj = objectHash
        const p1 = parentHash
        const p2 = vecToCBase32(vec8(0x03n))
        const resolve = storeOf([])
        const merged = merge(resolve)(obj)([p1, p2])(bridgeUrl)
        assertEq(parseRevision(merged)[0], 'ok')
    },

    mergeRequiresAtLeastTwoParents: () => {
        const obj = 'obj'
        const resolve = storeOf([])
        let threw = false
        try {
            merge(resolve)(obj)(['only-one'])('c')
        } catch {
            threw = true
        }
        assert(threw)
    },

    // The schema itself is a plain RTTI struct — exercised directly so a
    // regression in the field set shows up here, not only through parseRevision.
    revisionSchemaShape: () => {
        assertEq(Object.keys(revision).sort().join(','),
            'archived,changes,content,generation,mimeType,object,parents')
    },
}
