import { assert, assertEq } from '../../asserts/module.f.ts'
import { vec } from '../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../cbase32/module.f.ts'
import {
    evolution,
    heads,
    isHash,
    isRef,
    materialize,
    merge,
    validateRevision,
    verifyGeneration,
    type Entry,
    type Hash,
    type Revision,
} from './module.f.ts'

/** A distinct fake cbase32 CAS hash, for building test fixtures without real content hashing. */
const mkHash = (n: bigint): Hash => vecToCBase32(vec(16n)(n))

const objectHash = mkHash(1n)
const bridgeUrl = 'https://example.com/doc'

const rev = (over: Partial<Revision>): Revision => ({
    evolution,
    object: objectHash,
    parents: [],
    content: undefined,
    changes: undefined,
    generation: undefined,
    archived: undefined,
    ...over,
})

const storeOf = (entries: readonly Entry[]) =>
    (h: Hash): Revision | undefined => entries.find(([k]) => k === h)?.[1]

export const proof = {
    ref: {
        hashIsRef: () => assert(isRef(objectHash)),
        bridgeUrlIsRef: () => assert(isRef(bridgeUrl)),
        bridgeUrlIsNotHash: () => assert(!isHash(bridgeUrl)),
        garbageIsNotRef: () => assert(!isRef('not-a-ref')),
    },
    validate: {
        minimal: () => assert(validateRevision(rev({}))[0] === 'ok'),
        withContent: () => assert(validateRevision(rev({ content: mkHash(2n) }))[0] === 'ok'),
        archived: () => assert(validateRevision(rev({ archived: true }))[0] === 'ok'),
        wrongEvolutionTag: () =>
            assert(validateRevision({ ...rev({}), evolution: 'https://example.com/other' })[0] === 'error'),
        parentBridgeUrlRejected: () =>
            assert(validateRevision(rev({ parents: [bridgeUrl] }))[0] === 'error'),
        objectMustBeRef: () =>
            assert(validateRevision(rev({ object: 'not a ref!' }))[0] === 'error'),
        notAnObject: () => assert(validateRevision(42)[0] === 'error'),
    },
    heads: {
        firstRevisionIsHead: () => {
            const h1 = mkHash(10n)
            const r1 = rev({})
            const hs = heads([[h1, r1]])(objectHash)
            assertEq(hs.length, 1)
            assertEq(hs[0], h1)
        },
        linearHistoryHasOneHead: () => {
            const h1 = mkHash(10n)
            const h2 = mkHash(11n)
            const r1 = rev({})
            const r2 = rev({ parents: [h1] })
            const hs = heads([[h1, r1], [h2, r2]])(objectHash)
            assertEq(hs.length, 1)
            assertEq(hs[0], h2)
        },
        branchGivesManyHeads: () => {
            const h1 = mkHash(10n)
            const h2 = mkHash(11n)
            const h3 = mkHash(12n)
            const r1 = rev({})
            const r2 = rev({ parents: [h1] })
            const r3 = rev({ parents: [h1] })
            const hs = heads([[h1, r1], [h2, r2], [h3, r3]])(objectHash)
            assertEq(hs.length, 2)
            assert(hs.includes(h2) && hs.includes(h3))
        },
        mergeCollapsesBranchToOneHead: () => {
            const h1 = mkHash(10n)
            const h2 = mkHash(11n)
            const h3 = mkHash(12n)
            const h4 = mkHash(13n)
            const r1 = rev({})
            const r2 = rev({ parents: [h1] })
            const r3 = rev({ parents: [h1] })
            const r4 = rev({ parents: [h2, h3], content: mkHash(99n) })
            const hs = heads([[h1, r1], [h2, r2], [h3, r3], [h4, r4]])(objectHash)
            assertEq(hs.length, 1)
            assertEq(hs[0], h4)
        },
        differentObjectDoesNotDemoteHead: () => {
            // A revision of a *different* object that happens to list this object's
            // head hash as a parent must not demote it.
            const otherObject = mkHash(20n)
            const h1 = mkHash(10n)
            const r1 = rev({})
            const foreign = rev({ object: otherObject, parents: [h1] })
            const foreignHash = mkHash(30n)
            const hs = heads([[h1, r1], [foreignHash, foreign]])(objectHash)
            assertEq(hs.length, 1)
            assertEq(hs[0], h1)
        },
        retroactiveDemotionBySync: () => {
            // Before sync: h1 is the lone head.
            const h1 = mkHash(10n)
            const r1 = rev({})
            const before = heads([[h1, r1]])(objectHash)
            assertEq(before.length, 1)
            assertEq(before[0], h1)
            // A newly synced child of h1 demotes it retroactively.
            const h2 = mkHash(11n)
            const r2 = rev({ parents: [h1] })
            const after = heads([[h1, r1], [h2, r2]])(objectHash)
            assertEq(after.length, 1)
            assertEq(after[0], h2)
        },
        archivedObjectStillResolvesHeads: () => {
            const h1 = mkHash(10n)
            const r1 = rev({ archived: true })
            const hs = heads([[h1, r1]])(objectHash)
            assertEq(hs.length, 1)
            assertEq(hs[0], h1)
        },
    },
    materialize: {
        firstRevisionUsesObject: () => {
            const get = storeOf([])
            const r = rev({})
            const m = materialize(get)(r)
            assert(m[0] === 'ok' && m[1] === objectHash)
        },
        contentWins: () => {
            const get = storeOf([])
            const c = mkHash(2n)
            const r = rev({ content: c })
            const m = materialize(get)(r)
            assert(m[0] === 'ok' && m[1] === c)
        },
        followsParentChain: () => {
            const h1 = mkHash(10n)
            const c1 = mkHash(2n)
            const r1 = rev({ content: c1 })
            const r2 = rev({ parents: [h1] })
            const get = storeOf([[h1, r1]])
            const m = materialize(get)(r2)
            assert(m[0] === 'ok' && m[1] === c1)
        },
        missingParentIsError: () => {
            const get = storeOf([])
            const r = rev({ parents: [mkHash(999n)] })
            assert(materialize(get)(r)[0] === 'error')
        },
        mergeWithoutContentIsError: () => {
            const h1 = mkHash(10n)
            const h2 = mkHash(11n)
            const get = storeOf([])
            const r = rev({ parents: [h1, h2] })
            assert(materialize(get)(r)[0] === 'error')
        },
        changesWithoutContentIsError: () => {
            const get = storeOf([])
            const r = rev({ changes: [mkHash(2n)] })
            assert(materialize(get)(r)[0] === 'error')
        },
    },
    generation: {
        firstRevisionIsZero: () => {
            const get = storeOf([])
            assert(verifyGeneration(get)(rev({ generation: 0 })))
        },
        chainIncrements: () => {
            const h1 = mkHash(10n)
            const r1 = rev({ generation: 0 })
            const get = storeOf([[h1, r1]])
            assert(verifyGeneration(get)(rev({ parents: [h1], generation: 1 })))
        },
        mismatchIsRejected: () => {
            const h1 = mkHash(10n)
            const r1 = rev({ generation: 0 })
            const get = storeOf([[h1, r1]])
            assert(!verifyGeneration(get)(rev({ parents: [h1], generation: 5 })))
        },
        absentGenerationIsTrusted: () => {
            const get = storeOf([])
            assert(verifyGeneration(get)(rev({})))
        },
    },
    merge: {
        buildsMergeRevision: () => {
            const h1 = mkHash(10n)
            const h2 = mkHash(11n)
            const r1 = rev({ generation: 0 })
            const r2 = rev({ generation: 0 })
            const get = storeOf([[h1, r1], [h2, r2]])
            const content = mkHash(99n)
            const m = merge(get)(objectHash, [h1, h2], content)
            assert(m[0] === 'ok')
            if (m[0] === 'ok') {
                assertEq(m[1].generation, 1)
                assertEq(m[1].content, content)
                assert(validateRevision(m[1])[0] === 'ok')
            }
        },
        missingParentIsError: () => {
            const get = storeOf([])
            assert(merge(get)(objectHash, [mkHash(404n)], mkHash(99n))[0] === 'error')
        },
        noParentsIsError: () => {
            const get = storeOf([])
            assert(merge(get)(objectHash, [], mkHash(99n))[0] === 'error')
        },
    },
}
