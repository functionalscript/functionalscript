import { assert, assertEq } from '../../asserts/module.f.ts'
import { pure } from '../../effects/module.f.ts'
import { fileCas, type Cas } from '../module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { vec, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { ok, error, type Ok } from '../../types/result/module.f.ts'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.ts'
import type { IoResult } from '../../effects/node/module.f.ts'
import { tryUtf8 } from '../../text/module.f.ts'
import { dialect as revisionDialect } from '../../media/revision/module.f.ts'
import {
    buildCache, decodeRevisionBlob, initEvo, evo, emptyCache,
    type AddRevision,
} from './module.f.ts'

const home = '.'

// A `Cas<never>` whose `write` always fails — used to reach `addRevision`'s
// store-write-failure branch, which real `fileCas` has no easy way to trigger.
const writeFailingCas: Cas<never> = {
    read: () => elEmpty(),
    write: () => pure(error('boom')),
    list: () => pure([]),
}

export const proof = {
    buildCacheEmptyStoreYieldsEmptyCache: () => {
        const c = fileCas(sha256)(home)
        const [, cache] = virtual(emptyState)(buildCache(c))
        assertEq(JSON.stringify(cache), JSON.stringify(emptyCache))
    },
    buildCacheSkipsNonRevisionBlob: () => {
        const c = fileCas(sha256)(home)
        const content = vec8(0x41n) // 'A' — valid UTF-8, not revision JSON
        const [state1] = virtual(emptyState)(c.write(nonEmpty(ok(content), elEmpty<never, Ok<Vec>>())))
        const [, cache] = virtual(state1)(buildCache(c))
        assertEq(Object.keys(cache.heads).length, 0)
    },
    decodeRevisionBlobMissingHashIsNull: () => {
        const c = fileCas(sha256)(home)
        const [, revision] = virtual(emptyState)(decodeRevisionBlob(c)(vec8(0x99n)))
        assertEq(revision, null)
    },
    decodeRevisionBlobNonUtf8IsNull: () => {
        const c = fileCas(sha256)(home)
        const oddVec = vec(5n)(0b10101n) // not a whole number of bytes
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(oddVec), elEmpty<never, Ok<Vec>>())))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, revision] = virtual(state1)(decodeRevisionBlob(c)(w[1]))
        assertEq(revision, null)
    },
    decodeRevisionBlobInvalidJsonIsNull: () => {
        const c = fileCas(sha256)(home)
        const content = vec8(0x7bn) // '{' alone: valid UTF-8, not parseable JSON
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(content), elEmpty<never, Ok<Vec>>())))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, revision] = virtual(state1)(decodeRevisionBlob(c)(w[1]))
        assertEq(revision, null)
    },
    decodeRevisionBlobValidRevisionRoundTrips: () => {
        const c = fileCas(sha256)(home)
        const subjectHash = vecToCBase32(vec8(0x11n))
        const text = `{"dialect":"${revisionDialect}","subject":"${subjectHash}","parents":[]}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const [state1, w] = virtual(emptyState)(c.write(nonEmpty(ok(bytes as Vec), elEmpty<never, Ok<Vec>>())))
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
        const text = `{"dialect":"${revisionDialect}","subject":"${subjectHash}","parents":[]}`
        const bytes = tryUtf8(text)
        assert(bytes !== null, 'expected the sample revision text to encode as UTF-8')
        const [state1, w] = virtual(emptyState)(fileCas(sha256)(home).write(nonEmpty(ok(bytes as Vec), elEmpty<never, Ok<Vec>>())))
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, cache] = virtual(state1)(buildCache(c))
        assertEq(cache.heads[subjectHash]?.length, 1)
        assertEq(cache.heads[subjectHash]?.[0], vecToCBase32(w[1]))
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

        const rev0: AddRevision = { parents: [], subject: 'doc', snapshot: snapshotHash }
        const [state1, rev0Result] = virtual(state0)(e.add(rev0))
        assert(rev0Result[0] === 'ok', ['expected rev0 ok', rev0Result])
        const rev0Hash = rev0Result[1]

        const rev1: AddRevision = { parents: [rev0Hash], subject: 'doc' }
        const [state2, rev1Result] = virtual(state1)(e.add(rev1))
        assert(rev1Result[0] === 'ok', ['expected rev1 ok', rev1Result])
        const rev1Hash = rev1Result[1]

        const rev2: AddRevision = { parents: [rev0Hash], subject: 'doc', snapshot: snapshotHash }
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
    // Adding the exact same revision twice yields the same (deduplicated)
    // content hash and must not duplicate the head entry.
    addRevisionIdempotentOnDuplicateContent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const input: AddRevision = { parents: [], subject: 'x', snapshot: vecToCBase32(vec8(0x33n)) }
        const [state1, r1] = virtual(state0)(e.add(input))
        assert(r1[0] === 'ok', ['expected first add ok', r1])
        const [state2, r2] = virtual(state1)(e.add(input))
        assert(r2[0] === 'ok', ['expected second add ok', r2])
        assertEq(r1[1], r2[1])
        const [, heads] = virtual(state2)(e.head('x'))
        assertEq(heads.length, 1)
    },
    // `subject` omitted with exactly one parent is inherited from that
    // parent's own `subject`.
    addRevisionResolvesSubjectFromSingleParent: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const root: AddRevision = { parents: [], subject: 'inherit-me', snapshot: vecToCBase32(vec8(0x44n)) }
        const [state1, rootResult] = virtual(state0)(e.add(root))
        assert(rootResult[0] === 'ok', ['expected root ok', rootResult])
        const rootHash = rootResult[1]
        const child: AddRevision = { parents: [rootHash] }
        const [state2, childResult] = virtual(state1)(e.add(child))
        assert(childResult[0] === 'ok', ['expected child ok', childResult])
        const childHash = childResult[1]
        const [, heads] = virtual(state2)(e.head('inherit-me'))
        assertEq(heads.length, 1)
        assertEq(heads[0], childHash)
    },
    addRevisionSubjectRequiredForZeroParents: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, result] = virtual(state0)(e.add({ parents: [] }))
        assertEq(result[0], 'error')
        assert(result[0] === 'error' && result[1].includes('subject is required'), ['unexpected message', result])
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
    // Two parents without an explicit `snapshot` fail the `vnd.fjs.revision`
    // reference semantics (no single parent snapshot to inherit).
    addRevisionInvalidReferencesIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const p1 = vecToCBase32(vec8(0x66n))
        const p2 = vecToCBase32(vec8(0x77n))
        const [, result] = virtual(state0)(e.add({ parents: [p1, p2], subject: 'merge' }))
        assertEq(result[0], 'error')
    },
    addRevisionTooLargeToEncodeIsError: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const hugeSubject = 'x'.repeat(200_000)
        const input: AddRevision = { parents: [], subject: hugeSubject, snapshot: vecToCBase32(vec8(0x88n)) }
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
    evoHeadUnknownSubjectIsEmpty: () => {
        const c = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(c))
        const e = evo(c)(cacheKey)
        const [, heads] = virtual(state0)(e.head('nope'))
        assertEq(heads.length, 0)
    },
}
