/**
 * @import { Cas } from '../types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Ok } from '../../types/result/types.ts'
 * @import { IoResult } from '../../effects/node/types.ts'
 * @import { List } from '../../effects/list/types.ts'
 * @import { RevisionData } from './types.ts'
 */

import {
    assert,
    assertEq,
    assertStructurallySame,
} from '../../asserts/module.f.mjs'
import { pure } from '../../effects/module.f.mjs'
import { fileCas } from '../module.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { unwrap } from '../../types/nullable/module.f.mjs'
import { ok, error } from '../../types/result/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { dialect as revisionDialect } from '../../media/revision/module.f.mjs'
import {
    buildCache, decodeRevisionBlob, initEvo, evo, emptyCache, syncRevision,
} from './module.f.mjs'

const home = '.'

// A `Cas<never>` whose `write` always fails — used to reach `addRevision`'s
// store-write-failure branch, which real `fileCas` has no easy way to trigger.
/** @type {Cas<never>} */
const writeFailingCas = {
    read: () => elEmpty(),
    write: () => pure(error('boom')),
    list: () => pure([]),
}

// A `Cas<never>` whose `read` yields an error item that is *not* a missing
// shard — what a permission error, a mid-stream I/O failure, or a blob too
// large for `collectRead` to buffer looks like to a caller.
/** @type {Cas<never>} */
const readFailingCas = {
    read: () => nonEmpty(error('boom'), elEmpty()),
    write: () => pure(error('write not supported')),
    list: () => pure([]),
}

// A `Cas<never>` backed by a fixed set of (hash, content) entries, returned
// from `list()` in exactly the given order — used to control the order
// `buildCache` sees hashes in, independent of any real filesystem's
// (hash-lexical, not causal) directory-listing order.
/** @type {(entries: readonly (readonly [Vec, Vec])[]) => Cas<never>} */
const fixedCas = entries => ({
    read: hash => {
        const found = entries.find(([h]) => vecToCBase32(h) === vecToCBase32(hash))
        return found === undefined
            ? nonEmpty(error('not found'), elEmpty())
            : nonEmpty(ok(found[1]), elEmpty())
    },
    write: () => pure(error('write not supported')),
    list: () => pure(entries.map(([h]) => h)),
})

export const proof = {
    buildCacheEmptyStoreYieldsEmptyCache: () => {
        const c = fileCas(sha256)(home)
        const [, cache] = virtual(emptyState)(buildCache(c))
        assertStructurallySame(cache, emptyCache)
    },
    buildCacheSkipsNonRevisionBlob: () => {
        const c = fileCas(sha256)(home)
        const content = vec8(0x41n) // 'A' — valid UTF-8, not revision JSON
        const [state1] = virtual(emptyState)(c.write(nonEmpty(ok(content), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        const [, cache] = virtual(state1)(buildCache(c))
        assertEq(Object.keys(cache.bySubject).length, 0)
    },
    decodeRevisionBlobMissingHashIsNull: () => {
        const c = fileCas(sha256)(home)
        const [, revision] = virtual(emptyState)(decodeRevisionBlob(c)(vec8(0x99n)))
        assertEq(revision, null)
    },
    decodeRevisionBlobNonUtf8IsNull: () => {
        const c = fileCas(sha256)(home)
        const oddVec = vec(5n)(0b10101n) // not a whole number of bytes
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(oddVec), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, revision] = virtual(state1)(decodeRevisionBlob(c)(w[1]))
        assertEq(revision, null)
    },
    decodeRevisionBlobInvalidJsonIsNull: () => {
        const c = fileCas(sha256)(home)
        const content = vec8(0x7bn) // '{' alone: valid UTF-8, not parseable JSON
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(content), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, revision] = virtual(state1)(decodeRevisionBlob(c)(w[1]))
        assertEq(revision, null)
    },
    decodeRevisionBlobValidRevisionRoundTrips: () => {
        const c = fileCas(sha256)(home)
        const subjectHash = vecToCBase32(vec8(0x11n))
        const text = `{"dialect":"${revisionDialect}","subject":"${subjectHash}","parents":[],"snapshot":"${subjectHash}","generation":0}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(bytes), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, revision] = virtual(state1)(decodeRevisionBlob(c)(w[1]))
        assert(revision !== null, 'expected a decoded revision')
        assertEq(revision?.subject, subjectHash)
    },
    buildCacheIncludesScannedRevision: () => {
        // Unlike the `add`-driven tests below (which fold one revision at a
        // time), this seeds a `vnd.fjs.revision` blob directly into the store
        // and scans it with `buildCache`, covering the "found a revision"
        // branch of the full-store fold.
        const c = fileCas(sha256)(home)
        const subjectHash = vecToCBase32(vec8(0x12n))
        const text = `{"dialect":"${revisionDialect}","subject":"${subjectHash}","parents":[],"snapshot":"${subjectHash}","generation":0}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const [state1, w] = virtual(emptyState)(fileCas(sha256)(home).write(nonEmpty(ok(bytes), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, cache] = virtual(state1)(buildCache(c))
        assertEq(cache.bySubject[subjectHash]?.hashes.length, 1)
        assertEq(cache.bySubject[subjectHash]?.hashes[0], vecToCBase32(w[1]))
    },
    // Regression: `cas.list()` enumerates a real store by hash-sharded path,
    // not revision ancestry, so a child's hash can sort (and therefore be
    // scanned) before its parent's. `buildCache` must still end up with only
    // the child as a head — the whole point of tracking `hashes`/`parents`
    // as separate sets (see the module doc) rather than an incremental head
    // list.
    buildCacheOrderIndependentWhenChildScannedBeforeParent: () => {
        const rootHash = vec8(0xaan)
        const childHash = vec8(0xbbn)
        const rootCBase32 = vecToCBase32(rootHash)
        const childCBase32 = vecToCBase32(childHash)
        const snapshotHash = vecToCBase32(vec8(0xccn))
        const rootText = `{"dialect":"${revisionDialect}","subject":"doc","parents":[],"snapshot":"${snapshotHash}","generation":0}`
        const childText = `{"dialect":"${revisionDialect}","subject":"doc","parents":["${rootCBase32}"],"snapshot":"${snapshotHash}","generation":1}`
        const rootBytes = tryUtf8(rootText)
        const childBytes = tryUtf8(childText)
        assert(rootBytes !== null && childBytes !== null, 'expected sample revisions to encode as UTF-8')
        const cas = fixedCas([[childHash, childBytes], [rootHash, rootBytes]])
        const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
        const [, heads] = virtual(state0)(evo(cas)(cacheKey).head('doc'))
        assertEq(heads.length, 1)
        assertEq(heads[0], childCBase32)
    },
    // Regression: `cBase32ToVec` accepts more than one spelling of the same
    // hash (case, and the `i`/`l`/`o` alphabet aliases). A parent reference
    // recorded in a non-canonical spelling must still demote the parent from
    // the head set — `headsOf` compares hash strings directly, so caching
    // the parent verbatim (instead of its canonical `vecToCBase32` spelling)
    // would leave the parent listed as a head alongside its child.
    buildCacheCanonicalizesNonCanonicalParentHashes: () => {
        const rootHash = vec8(0xffn)
        const rootCanonical = vecToCBase32(rootHash) // "zy" — has letters to uppercase
        const rootNonCanonical = rootCanonical.toUpperCase()
        assert(rootNonCanonical !== rootCanonical, 'expected the sample hash to contain letters')
        const childHash = vec8(0xeen)
        const snapshotHash = vecToCBase32(vec8(0xddn))
        const rootText = `{"dialect":"${revisionDialect}","subject":"doc","parents":[],"snapshot":"${snapshotHash}","generation":0}`
        const childText = `{"dialect":"${revisionDialect}","subject":"doc","parents":["${rootNonCanonical}"],"snapshot":"${snapshotHash}","generation":1}`
        const rootBytes = tryUtf8(rootText)
        const childBytes = tryUtf8(childText)
        assert(rootBytes !== null && childBytes !== null, 'expected sample revisions to encode as UTF-8')
        const cas = fixedCas([[rootHash, rootBytes], [childHash, childBytes]])
        const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
        const [, heads] = virtual(state0)(evo(cas)(cacheKey).head('doc'))
        assertEq(heads.length, 1)
        assertEq(heads[0], vecToCBase32(childHash))
    },
    // Two concurrent children of one root: both become heads, the root stops
    // being one. Exercises addRevisionToCache's fold across a first insert
    // (no prior heads for the subject), a removal (a parent leaving the head
    // set), and a keep (an unrelated existing head surviving the fold).
    addRevisionBuildsHeadsAcrossChainAndFork: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const snapshotHash = vecToCBase32(vec8(0x22n))

        /** @type {RevisionData} */
        const rev0 = { parents: [], subject: 'doc', snapshot: snapshotHash }
        const [state1, rev0Result] = virtual(state0)(e.add(rev0))
        assert(rev0Result[0] === 'ok', ['expected rev0 ok', rev0Result])
        const rev0Hash = rev0Result[1]

        // rev1 inherits rev0's snapshot; rev2 states a different one — so the
        // two concurrent children are genuinely distinct blobs (both children
        // of rev0, same generation), not one deduplicated revision.
        /** @type {RevisionData} */
        const rev1 = { parents: [rev0Hash], subject: 'doc' }
        const [state2, rev1Result] = virtual(state1)(e.add(rev1))
        assert(rev1Result[0] === 'ok', ['expected rev1 ok', rev1Result])
        const rev1Hash = rev1Result[1]

        /** @type {RevisionData} */
        const rev2 = { parents: [rev0Hash], subject: 'doc', snapshot: vecToCBase32(vec8(0x23n)) }
        const [state3, rev2Result] = virtual(state2)(e.add(rev2))
        assert(rev2Result[0] === 'ok', ['expected rev2 ok', rev2Result])
        const rev2Hash = rev2Result[1]

        const [state4, heads] = virtual(state3)(e.head('doc'))
        assertEq(heads.length, 2)
        assert(heads.includes(rev1Hash), ['expected rev1 to remain a head', heads])
        assert(heads.includes(rev2Hash), ['expected rev2 to be a head', heads])
        assert(!heads.includes(rev0Hash), ['expected rev0 to no longer be a head', heads])

        const [, subjects] = virtual(state4)(e.list())
        assertEq(subjects.length, 1)
        assertEq(subjects[0], 'doc')
    },
    // `list()` and `list(true)` partition subjects by the archived flags of
    // their current heads: a lone root revision carrying `archived: true`
    // makes its subject archived, one without it leaves the subject active,
    // and neither subject appears in the other's result.
    listPartitionsSubjectsByHeadArchivedFlag: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [state1, live] = virtual(state0)(e.add({ parents: [], subject: 'live', snapshot: vecToCBase32(vec8(0x40n)) }))
        assert(live[0] === 'ok', ['expected the active add to succeed', live])
        const [state2, gone] = virtual(state1)(e.add({ parents: [], subject: 'gone', snapshot: vecToCBase32(vec8(0x41n)), archived: true }))
        assert(gone[0] === 'ok', ['expected the archived add to succeed', gone])
        const [state3, active] = virtual(state2)(e.list())
        assertEq(active.length, 1)
        assertEq(active[0], 'live')
        const [, archived] = virtual(state3)(e.list(true))
        assertEq(archived.length, 1)
        assertEq(archived[0], 'gone')
    },
    // Concurrent heads can disagree about `archived`. One unarchived head
    // keeps the whole subject active — there is still a head left to build on
    // — so the subject stays out of the archived-only result.
    listTreatsDisagreeingHeadsAsActive: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [state1, root] = virtual(state0)(e.add({ parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x42n)) }))
        assert(root[0] === 'ok', ['expected root ok', root])
        // The two children differ only in `archived`, which is enough to make
        // them distinct blobs, hence two concurrent heads of one root.
        const [state2, kept] = virtual(state1)(e.add({ parents: [root[1]], subject: 'doc' }))
        assert(kept[0] === 'ok', ['expected the unarchived child ok', kept])
        const [state3, dropped] = virtual(state2)(e.add({ parents: [root[1]], subject: 'doc', archived: true }))
        assert(dropped[0] === 'ok', ['expected the archived child ok', dropped])
        const [state4, heads] = virtual(state3)(e.head('doc'))
        assertEq(heads.length, 2)
        const [state5, active] = virtual(state4)(e.list())
        assertEq(active.length, 1)
        assertEq(active[0], 'doc')
        const [, archived] = virtual(state5)(e.list(true))
        assertEq(archived.length, 0)
    },
    // `archived` is a property of a revision, not of a subject: a subject
    // archived at one revision is active again as soon as an unarchived child
    // demotes that revision out of the head set.
    listIgnoresArchivedRevisionsThatAreNoLongerHeads: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [state1, root] = virtual(state0)(e.add({ parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x45n)), archived: true }))
        assert(root[0] === 'ok', ['expected the archived root ok', root])
        const [state2, revived] = virtual(state1)(e.add({ parents: [root[1]], subject: 'doc' }))
        assert(revived[0] === 'ok', ['expected the unarchived child ok', revived])
        const [state3, active] = virtual(state2)(e.list())
        assertEq(active.length, 1)
        assertEq(active[0], 'doc')
        const [, archived] = virtual(state3)(e.list(true))
        assertEq(archived.length, 0)
    },
    // A subject can end up with no current head at all, and a status is a
    // statement about heads — so such a subject is neither active nor
    // archived and belongs to neither result. Nothing verifies that a stored
    // blob actually hashes to the key it sits under, so a hand-crafted or
    // corrupt store can present a revision naming its own hash as its parent;
    // `fixedCas` reproduces exactly that, which a real `fileCas` cannot.
    listExcludesSubjectWithNoCurrentHeads: () => {
        const selfHash = vec8(0x43n)
        const snapshotHash = vecToCBase32(vec8(0x44n))
        const text = `{"dialect":"${revisionDialect}","subject":"doc","parents":["${vecToCBase32(selfHash)}"],"snapshot":"${snapshotHash}","generation":1}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const cas = fixedCas([[selfHash, bytes]])
        const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
        const e = evo(cas)(cacheKey)
        const [state1, heads] = virtual(state0)(e.head('doc'))
        assertEq(heads.length, 0)
        const [state2, active] = virtual(state1)(e.list())
        assertEq(active.length, 0)
        const [, archived] = virtual(state2)(e.list(true))
        assertEq(archived.length, 0)
    },
    // Adding the exact same revision twice yields the same (deduplicated)
    // content hash and must not duplicate the head entry.
    addRevisionIdempotentOnDuplicateContent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const input = { parents: [], subject: 'x', snapshot: vecToCBase32(vec8(0x33n)) }
        const [state1, r1] = virtual(state0)(e.add(input))
        assert(r1[0] === 'ok', ['expected first add ok', r1])
        const [state2, r2] = virtual(state1)(e.add(input))
        assert(r2[0] === 'ok', ['expected second add ok', r2])
        assertEq(r1[1], r2[1])
        const [, heads] = virtual(state2)(e.head('x'))
        assertEq(heads.length, 1)
    },
    // Two `add` calls describing the same logical revision but spelling the
    // parent reference differently (canonical vs. an accepted uppercase
    // alias) must serialize identically and dedupe to one head — otherwise
    // `addRevision` itself would be the source of the very spelling drift
    // `canonicalHash` exists to prevent.
    addRevisionCanonicalizesParentSpellingBeforeSerializing: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const root = { parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x2en)) }
        const [state1, rootResult] = virtual(state0)(e.add(root))
        assert(rootResult[0] === 'ok', ['expected root ok', rootResult])
        const rootHash = rootResult[1]
        assert(rootHash !== rootHash.toUpperCase(), 'expected the sample hash to contain letters')
        /** @type {RevisionData} */
        const child1 = { parents: [rootHash], subject: 'doc' }
        const [state2, child1Result] = virtual(state1)(e.add(child1))
        assert(child1Result[0] === 'ok', ['expected child1 ok', child1Result])
        /** @type {RevisionData} */
        const child2 = { parents: [rootHash.toUpperCase()], subject: 'doc' }
        const [state3, child2Result] = virtual(state2)(e.add(child2))
        assert(child2Result[0] === 'ok', ['expected child2 ok', child2Result])
        assertEq(child1Result[1], child2Result[1])
        const [, heads] = virtual(state3)(e.head('doc'))
        assertEq(heads.length, 1)
        assertEq(heads[0], child1Result[1])
    },
    // `subject` omitted with exactly one parent is inherited from that
    // parent's own `subject`.
    addRevisionResolvesSubjectFromSingleParent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const root = { parents: [], subject: 'inherit-me', snapshot: vecToCBase32(vec8(0x44n)) }
        const [state1, rootResult] = virtual(state0)(e.add(root))
        assert(rootResult[0] === 'ok', ['expected root ok', rootResult])
        const rootHash = rootResult[1]
        /** @type {RevisionData} */
        const child = { parents: [rootHash] }
        const [state2, childResult] = virtual(state1)(e.add(child))
        assert(childResult[0] === 'ok', ['expected child ok', childResult])
        const childHash = childResult[1]
        const [, heads] = virtual(state2)(e.head('inherit-me'))
        assertEq(heads.length, 1)
        assertEq(heads[0], childHash)
    },
    // `add` writes both inference-derived fields explicitly: a root gets
    // `generation` 0 and, with no input `snapshot`, its `subject` (a hash) as
    // the snapshot reference; a single-parent child with no input `snapshot`
    // inherits the parent's stored snapshot and gets `generation` 1.
    addComputesGenerationAndResolvesSnapshot: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const subjectHash = vecToCBase32(vec8(0x71n))
        const [state1, rootResult] = virtual(state0)(e.add({ parents: [], subject: subjectHash }))
        assert(rootResult[0] === 'ok', ['expected root ok', rootResult])
        const rootHashVec = unwrap(cBase32ToVec(rootResult[1]))
        const [state2, root] = virtual(state1)(decodeRevisionBlob(c)(rootHashVec))
        assert(root !== null, 'expected the stored root to decode')
        assertEq(root?.generation, 0)
        assertEq(root?.snapshot, subjectHash)

        const [state3, childResult] = virtual(state2)(e.add({ parents: [rootResult[1]], subject: subjectHash }))
        assert(childResult[0] === 'ok', ['expected child ok', childResult])
        const childHashVec = unwrap(cBase32ToVec(childResult[1]))
        const [, child] = virtual(state3)(decodeRevisionBlob(c)(childHashVec))
        assert(child !== null, 'expected the stored child to decode')
        assertEq(child?.generation, 1)
        assertEq(child?.snapshot, subjectHash)
    },
    // A merge takes `1 + max(parents' generations)`: a parent at generation 2
    // and one at generation 1 yield generation 3.
    addComputesMergeGenerationFromMaxOfParents: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const snap = vecToCBase32(vec8(0x72n))
        // Mainline chain: root(gen0) → a(gen1) → b(gen2).
        const [state1, root] = virtual(state0)(e.add({ parents: [], subject: 'm', snapshot: snap }))
        assert(root[0] === 'ok', ['expected root ok', root])
        const [state2, a] = virtual(state1)(e.add({ parents: [root[1]], subject: 'm', snapshot: snap }))
        assert(a[0] === 'ok', ['expected a ok', a])
        const [state3, b] = virtual(state2)(e.add({ parents: [a[1]], subject: 'm', snapshot: snap }))
        assert(b[0] === 'ok', ['expected b ok', b])
        // Side branch off root: c(gen1).
        const [state4, cRev] = virtual(state3)(e.add({ parents: [root[1]], subject: 'm', snapshot: snap }))
        assert(cRev[0] === 'ok', ['expected c ok', cRev])
        // Merge of b(gen2) and c(gen1) → gen3.
        const [state5, merge] = virtual(state4)(e.add({ parents: [b[1], cRev[1]], subject: 'm', snapshot: snap }))
        assert(merge[0] === 'ok', ['expected merge ok', merge])
        const mergeHashVec = unwrap(cBase32ToVec(merge[1]))
        const [, mergeRev] = virtual(state5)(decodeRevisionBlob(c)(mergeHashVec))
        assert(mergeRev !== null, 'expected the stored merge to decode')
        assertEq(mergeRev?.generation, 3)
    },
    // `generation` is an input field only so a value read back by
    // `revision` round-trips into `add` unchanged: `add` never reads it, and
    // supplying a wrong one must not reach the stored blob — the revision is
    // byte-identical to the same `add` without it.
    addIgnoresSuppliedGeneration: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const subjectHash = vecToCBase32(vec8(0x73n))
        const [state1, claimed] = virtual(state0)(e.add({ parents: [], subject: subjectHash, generation: 42 }))
        assert(claimed[0] === 'ok', ['expected add ok', claimed])
        const [state2, plain] = virtual(state1)(e.add({ parents: [], subject: subjectHash }))
        assert(plain[0] === 'ok', ['expected add ok', plain])
        assertEq(claimed[1], plain[1])
        const [, revision] = virtual(state2)(e.revision(claimed[1]))
        assert(revision[0] === 'ok', ['expected revision ok', revision])
        assertEq(revision[1].generation, 0)
    },
    addRevisionSubjectRequiredForZeroParents: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({ parents: [] }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('subject is required'), ['unexpected message', result])
    },
    // Zero parents and no input `snapshot`: `resolveSnapshot` falls back to
    // `subject` as the reference, which must itself be a hash. A subject with
    // characters outside the cbase32 alphabet ('not-a-hash!') therefore has
    // nothing to resolve the snapshot to and is an error — the format requires
    // an explicit `snapshot`.
    addRevisionNonHashSubjectWithoutSnapshotIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({ parents: [], subject: 'not-a-hash!' }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('subject must be a valid hash'), ['unexpected message', result])
    },
    addRevisionInvalidParentHashIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({ parents: ['not a valid cbase32!'] }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('invalid parent hash'), ['unexpected message', result])
    },
    addRevisionParentNotARevisionIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const missingParent = vecToCBase32(vec8(0x55n))
        const [, result] = virtual(state0)(e.add({ parents: [missingParent] }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('parent is not a revision blob'), ['unexpected message', result])
    },
    // An explicit `subject` must not bypass parent validation: a missing
    // parent is still an error even though `subject` alone would otherwise
    // resolve without looking at any parent.
    addRevisionValidatesParentsEvenWithExplicitSubject: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const missingParent = vecToCBase32(vec8(0x66n))
        const [, result] = virtual(state0)(e.add({ parents: [missingParent], subject: 'doc' }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('parent is not a revision blob'), ['unexpected message', result])
    },
    // A revision models one step in the evolution of a single subject: a
    // parent that actually belongs to a *different* subject must be
    // rejected, even though it exists and is a valid revision — otherwise
    // the new revision would silently graft onto an unrelated object's
    // history, and head demotion (scoped to the child's own subject) would
    // never remove the parent from its real subject's head set.
    addRevisionRejectsCrossSubjectParent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const rootA = { parents: [], subject: 'A', snapshot: vecToCBase32(vec8(0x67n)) }
        const [state1, rootAResult] = virtual(state0)(e.add(rootA))
        assert(rootAResult[0] === 'ok', ['expected rootA ok', rootAResult])
        const [, result] = virtual(state1)(e.add({ parents: [rootAResult[1]], subject: 'B' }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('different subject'), ['unexpected message', result])
    },
    // With multiple parents, a failure on an earlier one short-circuits the
    // fold — the second (here, a well-formed but nonexistent) parent is
    // never even looked up.
    addRevisionShortCircuitsOnFirstInvalidParentAmongMultiple: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const missingParent = vecToCBase32(vec8(0x99n))
        const [, result] = virtual(state0)(e.add({ parents: ['not a valid cbase32!', missingParent], subject: 'doc' }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('invalid parent hash'), ['unexpected message', result])
    },
    // Two *valid* parents without an explicit `snapshot` cannot resolve one
    // (no single parent snapshot to inherit) — a distinct failure from a
    // missing/invalid parent, reported by `resolveSnapshot` at the write
    // boundary now that the format requires an explicit `snapshot`.
    addRevisionInvalidReferencesIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const rootA = { parents: [], subject: 'merge', snapshot: vecToCBase32(vec8(0x77n)) }
        const [state1, rootAResult] = virtual(state0)(e.add(rootA))
        assert(rootAResult[0] === 'ok', ['expected rootA ok', rootAResult])
        /** @type {RevisionData} */
        const rootB = { parents: [], subject: 'merge', snapshot: vecToCBase32(vec8(0x88n)) }
        const [state2, rootBResult] = virtual(state1)(e.add(rootB))
        assert(rootBResult[0] === 'ok', ['expected rootB ok', rootBResult])
        const [, result] = virtual(state2)(e.add({ parents: [rootAResult[1], rootBResult[1]], subject: 'merge' }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && !result[1].includes('parent is not a revision blob'), ['unexpected message', result])
    },
    addRevisionTooLargeToEncodeIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const hugeSubject = 'x'.repeat(200_000)
        /** @type {RevisionData} */
        const input = { parents: [], subject: hugeSubject, snapshot: vecToCBase32(vec8(0x88n)) }
        const [, result] = virtual(state0)(e.add(input))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1] === 'revision too large to encode', ['unexpected message', result])
    },
    addRevisionWriteFailureIsError: () => {
        const [, cacheKey] = virtual(emptyState)(initEvo(writeFailingCas))
        const e = evo(writeFailingCas)(cacheKey)
        const [, result] = virtual(emptyState)(e.add({ parents: [], subject: vecToCBase32(vec8(0x99n)) }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1] === 'failed to write revision to CAS', ['unexpected message', result])
    },
    // Every way `revision` can fail is its own message, not one `null`: an
    // undecodable hash, a hash the store has nothing under, a read that failed
    // for any other reason, and a blob that is not a revision.
    // `decodeRevisionBlob` collapses all but the first (it exists to scan
    // stores of arbitrary content); this read keeps them apart.
    revisionInvalidHashIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.revision('not a valid cbase32!'))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('invalid hash'), ['unexpected message', result])
    },
    revisionMissingHashIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.revision(vecToCBase32(vec8(0x9an))))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('revision not found'), ['unexpected message', result])
    },
    // Regression: a read failure that is not a missing shard — a permission or
    // mid-stream I/O error, or a blob too large to buffer into one `Vec` —
    // must not be reported as "not found". The blob may well be there; saying
    // it is absent would be a false answer, not merely a vague one.
    revisionReadFailureIsNotReportedAsMissing: () => {
        const [state0, cacheKey] = virtual(emptyState)(initEvo(readFailingCas))
        const e = evo(readFailingCas)(cacheKey)
        const [, result] = virtual(state0)(e.revision(vecToCBase32(vec8(0x9bn))))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('failed to read revision'), ['unexpected message', result])
    },
    revisionNonRevisionBlobIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const content = vec8(0x41n) // 'A' — valid UTF-8, not revision JSON
        const [state1, w] = virtual(state0)(c.write(nonEmpty(ok(content), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, result] = virtual(state1)(e.revision(vecToCBase32(w[1])))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('not a revision blob'), ['unexpected message', result])
    },
    // A blob written by somebody else can spell its references in any accepted
    // cbase32 alias (case, `i`/`l`/`o`). What `revision` returns is
    // canonicalized, so a client can compare it against `head` output
    // directly instead of knowing about cbase32 aliasing.
    revisionCanonicalizesReferenceSpellings: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const parentCanonical = vecToCBase32(vec8(0xffn))
        const snapshotCanonical = vecToCBase32(vec8(0xfen))
        const parentAlias = parentCanonical.toUpperCase()
        const snapshotAlias = snapshotCanonical.toUpperCase()
        assert(
            parentAlias !== parentCanonical && snapshotAlias !== snapshotCanonical,
            'expected the sample hashes to contain letters')
        const text = `{"dialect":"${revisionDialect}","subject":"doc","parents":["${parentAlias}"],"snapshot":"${snapshotAlias}","generation":1}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const [state1, w] = virtual(state0)(c.write(nonEmpty(ok(bytes), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, result] = virtual(state1)(e.revision(vecToCBase32(w[1])))
        assert(result[0] === 'ok', ['expected revision ok', result])
        assertEq(result[1].parents.length, 1)
        assertEq(result[1].parents[0], parentCanonical)
        assertEq(result[1].snapshot, snapshotCanonical)
        assertEq(result[1].subject, 'doc')
        assertEq(result[1].archived, undefined)
    },
    // What you add is what you get back: every field of a stored revision
    // comes back in the same `RevisionData` shape `add` takes, so the value
    // can be added again unchanged — same content, same hash.
    revisionRoundTripsThroughAdd: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const subjectHash = vecToCBase32(vec8(0x74n))
        const [state1, root] = virtual(state0)(e.add({ parents: [], subject: subjectHash }))
        assert(root[0] === 'ok', ['expected root ok', root])
        const [state2, child] = virtual(state1)(e.add({ parents: [root[1]], archived: true }))
        assert(child[0] === 'ok', ['expected child ok', child])
        const [state3, result] = virtual(state2)(e.revision(child[1]))
        assert(result[0] === 'ok', ['expected revision ok', result])
        assertEq(result[1].subject, subjectHash)
        assertEq(result[1].snapshot, subjectHash)
        assertEq(result[1].generation, 1)
        assertEq(result[1].archived, true)
        assertEq(result[1].parents.length, 1)
        assertEq(result[1].parents[0], root[1])
        const [, readded] = virtual(state3)(e.add(result[1]))
        assert(readded[0] === 'ok', ['expected re-add ok', readded])
        assertEq(readded[1], child[1])
    },
    revisionLockRoundTripsAndCanonicalizes: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const canonical = vecToCBase32(vec8(0xffn))
        const alias = canonical.toUpperCase()
        const [state1, added] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: canonical,
            lock: { dependency: alias },
        }))
        assert(added[0] === 'ok', ['expected add ok', added])
        const [, result] = virtual(state1)(e.revision(added[1]))
        assert(result[0] === 'ok', ['expected revision ok', result])
        const lock = result[1].lock
        assert(typeof lock === 'object', ['expected an inline lock map', lock])
        assertEq(lock.dependency, canonical)
    },
    // A `lock` naming a `vnd.fjs.lock` blob is stored and read back as the
    // reference it is: validated as a hash and re-spelled canonically, like
    // `snapshot`, and never followed — resolving one is a resolver's job.
    revisionSharedLockReferenceRoundTripsAndCanonicalizes: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const canonical = vecToCBase32(vec8(0xffn))
        const alias = canonical.toUpperCase()
        const [state1, added] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: canonical, lock: alias,
        }))
        assert(added[0] === 'ok', ['expected add ok', added])
        const [state2, result] = virtual(state1)(e.revision(added[1]))
        assert(result[0] === 'ok', ['expected revision ok', result])
        assertEq(result[1].lock, canonical)
        const [, readded] = virtual(state2)(e.add(result[1]))
        assert(readded[0] === 'ok', ['expected re-add ok', readded])
        assertEq(readded[1], added[1])
    },
    // A shared-lock reference is checked as a hash on the way in, so a
    // non-cBase32 one fails the write instead of being stored unresolvable.
    revisionInvalidSharedLockReferenceIsRejected: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0xffn)),
            lock: 'https://example.com/lock',
        }))
        assert(result[0] === 'error', ['expected error', result])
        assert(result[1].includes('lock reference is not a valid hash'), result[1])
    },
    // A nested lock map round-trips with its scope structure intact, and
    // canonicalization recurses into it: an alias spelling bound inside a
    // scope comes back canonical, like a direct one.
    revisionNestedLockRoundTripsAndCanonicalizes: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const canonical = vecToCBase32(vec8(0xffn))
        const alias = canonical.toUpperCase()
        const [state1, added] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: canonical,
            lock: { B: { D: alias }, C: canonical },
        }))
        assert(added[0] === 'ok', ['expected add ok', added])
        const [state2, result] = virtual(state1)(e.revision(added[1]))
        assert(result[0] === 'ok', ['expected revision ok', result])
        const lock = result[1].lock
        assert(typeof lock === 'object', ['expected an inline lock map', lock])
        const scope = lock.B
        assert(typeof scope === 'object', ['expected a nested scope', scope])
        assertEq(scope.D, canonical)
        // The read value is still valid `add` input, and re-adding it reuses
        // the same address — the round trip loses nothing.
        const [, readded] = virtual(state2)(e.add(result[1]))
        assert(readded[0] === 'ok', ['expected re-add ok', readded])
        assertEq(readded[1], added[1])
    },
    // Semantic checking recurses: a non-hash string inside a nested scope
    // fails the write, like one at the root.
    revisionInvalidNestedLockValueIsRejected: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x42n)),
            lock: { B: { dependency: 'not a hash!' } },
        }))
        assert(result[0] === 'error', ['expected error', result])
        assert(result[1].includes('B/dependency'))
    },
    revisionAbsentAndEmptyLocksRemainDistinct: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const snapshot = vecToCBase32(vec8(0x42n))
        const [state1, absent] = virtual(state0)(e.add({ parents: [], subject: 'absent', snapshot }))
        assert(absent[0] === 'ok', ['expected add ok', absent])
        const [state2, empty] = virtual(state1)(e.add({ parents: [], subject: 'empty', snapshot, lock: {} }))
        assert(empty[0] === 'ok', ['expected add ok', empty])
        const [state3, absentRead] = virtual(state2)(e.revision(absent[1]))
        assert(absentRead[0] === 'ok', ['expected revision ok', absentRead])
        const [, emptyRead] = virtual(state3)(e.revision(empty[1]))
        assert(emptyRead[0] === 'ok', ['expected revision ok', emptyRead])
        assertEq(absentRead[1].lock, undefined)
        assertEq(Object.keys(emptyRead[1].lock ?? {}).length, 0)
    },
    revisionInvalidLockValueIsRejected: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x42n)),
            lock: { dependency: 'not a hash!' },
        }))
        assertEq(result[0], 'error')
    },
    equivalentLockOrdersReuseOneCasAddress: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const a = vecToCBase32(vec8(0x1an))
        const b = vecToCBase32(vec8(0x2bn))
        const snapshot = vecToCBase32(vec8(0x3cn))
        const [state1, first] = virtual(state0)(e.add({ parents: [], subject: 'doc', snapshot, lock: { '2': b, '10': a } }))
        assert(first[0] === 'ok', ['expected add ok', first])
        const [, second] = virtual(state1)(e.add({ lock: { '10': a, '2': b }, snapshot, subject: 'doc', parents: [] }))
        assert(second[0] === 'ok', ['expected add ok', second])
        assertEq(second[1], first[1])
    },
    // Canonical serialization reaches into nested scopes, so two adds
    // differing only in the property order of a nested map — at the root and
    // inside the scope alike — deduplicate to one blob rather than leaving
    // two heads.
    equivalentNestedLockOrdersReuseOneCasAddress: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const a = vecToCBase32(vec8(0x1an))
        const b = vecToCBase32(vec8(0x2bn))
        const snapshot = vecToCBase32(vec8(0x3cn))
        const [state1, first] = virtual(state0)(e.add({
            parents: [], subject: 'doc', snapshot,
            lock: { B: { '2': b, '10': a }, A: a },
        }))
        assert(first[0] === 'ok', ['expected add ok', first])
        const [, second] = virtual(state1)(e.add({
            parents: [], subject: 'doc', snapshot,
            lock: { A: a, B: { '10': a, '2': b } },
        }))
        assert(second[0] === 'ok', ['expected add ok', second])
        assertEq(second[1], first[1])
    },
    // A raw CAS write (e.g. `cas_add`) of valid revision content is folded
    // into the cache exactly as `addRevision` would, without going through
    // `evo.add` — this is what keeps `cas_add` and `evo_add` writes to the
    // same store consistent (see `fjs/mcp`).
    syncRevisionFoldsValidRevisionIntoCache: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const subjectHash = vecToCBase32(vec8(0x13n))
        const text = `{"dialect":"${revisionDialect}","subject":"${subjectHash}","parents":[],"snapshot":"${subjectHash}","generation":0}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected sample revision to encode as UTF-8')
        const hashVec = vec8(0x14n)
        const [state1] = virtual(state0)(syncRevision(cacheKey)(hashVec)(bytes))
        const [, heads] = virtual(state1)(evo(c)(cacheKey).head(subjectHash))
        assertEq(heads.length, 1)
        assertEq(heads[0], vecToCBase32(hashVec))
    },
    syncRevisionIgnoresNonRevisionContent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const [state1] = virtual(state0)(syncRevision(cacheKey)(vec8(0x15n))(vec8(0x41n)))
        const [, subjects] = virtual(state1)(evo(c)(cacheKey).list())
        assertEq(subjects.length, 0)
    },
    evoHeadUnknownSubjectIsEmpty: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, heads] = virtual(state0)(e.head('nope'))
        assertEq(heads.length, 0)
    },
    // Regression: subjects are arbitrary caller-supplied strings, so one can
    // collide with an inherited `Object.prototype` name. Plain bracket
    // indexing on the `bySubject` map would return the inherited value
    // (e.g. the `toString` function) instead of "no entry yet", crashing on
    // `.hashes` — the cache must use an own-property lookup instead.
    evoHeadUnknownPrototypeNamedSubjectIsEmpty: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, heads] = virtual(state0)(e.head('constructor'))
        assertEq(heads.length, 0)
    },
    evoAddAndHeadHandlePrototypeNamedSubject: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        /** @type {RevisionData} */
        const input = { parents: [], subject: 'toString', snapshot: vecToCBase32(vec8(0x16n)) }
        const [state1, result] = virtual(state0)(e.add(input))
        assert(result[0] === 'ok', ['expected add ok', result])
        const [, heads] = virtual(state1)(e.head('toString'))
        assertEq(heads.length, 1)
        assertEq(heads[0], result[1])
    },
}
