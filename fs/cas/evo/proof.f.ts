import { assert, assertEq } from '../../asserts/module.f.ts'
import { pure, type Effect } from '../../effects/module.f.ts'
import { nonEmpty, empty as elEmpty, type List } from '../../effects/list/module.f.ts'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { fileCas, type FileCasOperation } from '../module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { vec, vec8, type Vec } from '../../types/bit_vec/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { ok, unwrap, type Ok, type Result } from '../../types/result/module.f.ts'
import type { IoResult } from '../../effects/node/module.f.ts'
import { mimeType } from '../../media/revision/module.f.ts'
import { heads, materialize, computeGeneration, readRevision, revisionsOf } from './module.f.ts'

/** `Result` values are tuples, so `assertEq`'s `===` never matches two
 *  independently constructed ones — compare tag and payload separately. */
const assertOk = <T>([t, v]: Result<T, unknown>, expected: T): void => {
    assertEq(t, 'ok')
    if (t === 'ok') { assertEq(v, expected) }
}

const home = '.'
const c = fileCas(sha256)(home)

/** A fixed, valid cbase32 hash used as an `object` identity in tests that
 *  never dereference it (only revisions themselves are stored). */
const objectA = vecToCBase32(vec(256n)(0x1n))
const objectB = vecToCBase32(vec(256n)(0x2n))

const writeVec = (bytes: Vec): Effect<FileCasOperation, Vec> => {
    const payload: List<never, IoResult<Vec>> = nonEmpty(ok(bytes), elEmpty<never, Ok<Vec>>())
    return c.write(payload).step(r => pure(unwrap(r)))
}

const writeJson = (value: unknown): Effect<FileCasOperation, Vec> => writeVec(utf8(JSON.stringify(value)))

const run = <T>(effect: Effect<FileCasOperation, T>): T => virtual(emptyState)(effect)[1]

const rootJson = { mimeType, object: objectA, parents: [] as readonly string[], content: 'https://example.com/root' }
const urlB = 'https://example.com/content-b'

export const proof = {
    // Linear history: first revision has no parents and carries `content`;
    // the second revises it. `heads` resolves to only the tip, and
    // `materialize` on the tip returns its own `content` (highest precedence).
    // A third revision with a single parent and no `content` of its own must
    // recurse through that parent to materialize.
    linearHistory: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/content-a' })
            .step(hashA => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashA)], content: urlB }))
            .step(hashB => heads(c)(objectA).step(hs => pure({ hashB, hs })))
            .step(({ hashB, hs }) => {
                assertEq(hs.length, 1)
                assertEq(vecToCBase32(hs[0]), vecToCBase32(hashB))
                return materialize(c)(hashB).step(mat => pure({ hashB, mat }))
            })
            .step(({ hashB, mat }) => {
                assertOk(mat, urlB)
                return writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashB)] })
            })
            .step(hashC => materialize(c)(hashC))
            .step(mat2 => {
                assertOk(mat2, urlB)
                return pure(undefined)
            })
        run(effect)
    },

    // First revision (no parents, no `content`, no `changes`) materializes
    // from `object` itself.
    firstRevisionMaterializesFromObject: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [] })
            .step(hashA => materialize(c)(hashA))
            .step(mat => {
                assertOk(mat, objectA)
                return pure(undefined)
            })
        run(effect)
    },

    // Branch + merge: two revisions branch off a common first revision, then
    // a merge revision (two parents, `content`) resolves both into one head.
    branchAndMerge: () => {
        const effect =
            writeJson(rootJson)
            .step(hashRoot => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashRoot)], content: 'https://example.com/left' })
                .step(hashLeft => pure({ hashRoot, hashLeft })))
            .step(({ hashRoot, hashLeft }) => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashRoot)], content: 'https://example.com/right' })
                .step(hashRight => pure({ hashLeft, hashRight })))
            .step(({ hashLeft, hashRight }) => heads(c)(objectA).step(beforeMerge => pure({ hashLeft, hashRight, beforeMerge })))
            .step(({ hashLeft, hashRight, beforeMerge }) => {
                assertEq(beforeMerge.length, 2)
                return writeJson({
                    mimeType, object: objectA,
                    parents: [vecToCBase32(hashLeft), vecToCBase32(hashRight)],
                    content: 'https://example.com/merged',
                })
            })
            .step(hashMerge => heads(c)(objectA).step(afterMerge => pure({ hashMerge, afterMerge })))
            .step(({ hashMerge, afterMerge }) => {
                assertEq(afterMerge.length, 1)
                assertEq(vecToCBase32(afterMerge[0]), vecToCBase32(hashMerge))
                return materialize(c)(hashMerge).step(mat => pure({ hashMerge, mat }))
            })
            .step(({ hashMerge, mat }) => {
                assertOk(mat, 'https://example.com/merged')
                return computeGeneration(c)(hashMerge)
            })
            .step(gen => {
                assertOk(gen, 2)
                return pure(undefined)
            })
        run(effect)
    },

    // Many heads: three independent first revisions of the same object are
    // all heads at once (no merge yet).
    manyHeadsForOneObject: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/one' })
            .step(() => writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/two' }))
            .step(() => writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/three' }))
            .step(() => heads(c)(objectA))
            .step(hs => {
                assertEq(hs.length, 3)
                return pure(undefined)
            })
        run(effect)
    },

    // An archived revision decodes with `archived: true` and still
    // participates in head resolution like any other revision.
    archivedObject: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/done', archived: true })
            .step(hash => readRevision(c)(hash).step(r => pure(unwrap(r))))
            .step(revision => {
                assertEq(revision.archived, true)
                return heads(c)(objectA)
            })
            .step(hs => {
                assertEq(hs.length, 1)
                return pure(undefined)
            })
        run(effect)
    },

    // A cached `generation` can be wrong (stale, or forged by an untrusted
    // source); `computeGeneration` recomputes it from `parents` instead of
    // trusting the stored field, so a caller can detect the mismatch.
    generationCacheMismatch: () => {
        const effect =
            writeJson(rootJson)
            // Cached `generation` (99) is wrong: the real value is 1.
            .step(hashRoot => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashRoot)], content: 'https://example.com/child', generation: 99 }))
            .step(hashChild => readRevision(c)(hashChild).step(r => pure({ hashChild, revision: unwrap(r) })))
            .step(({ hashChild, revision }) => computeGeneration(c)(hashChild).step(gen => pure({ gen, revision })))
            .step(({ gen, revision }) => {
                assertOk(gen, 1)
                assert(gen[0] === 'ok' && gen[1] !== revision.generation)
                return pure(undefined)
            })
        run(effect)
    },

    // A previously-lone head is demoted the moment a newly synced revision
    // (of the same object) names it as a parent — sync just moves blobs, it
    // never has to reason about "current head" itself.
    headDemotedRetroactivelyBySync: () => {
        const effect =
            writeJson(rootJson)
            .step(hashRoot => heads(c)(objectA).step(before => pure({ hashRoot, before })))
            .step(({ hashRoot, before }) => {
                assertEq(before.length, 1)
                // A revision synced in later, naming `root` as its parent.
                return writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashRoot)], content: 'https://example.com/synced-child' })
            })
            .step(hashChild => heads(c)(objectA).step(after => pure({ hashChild, after })))
            .step(({ hashChild, after }) => {
                assertEq(after.length, 1)
                assertEq(vecToCBase32(after[0]), vecToCBase32(hashChild))
                return pure(undefined)
            })
        run(effect)
    },

    // `heads` must recognize a parent recorded in a non-canonical cbase32
    // spelling (cbase32 decoding is case-insensitive) as the same hash
    // `vecToCBase32` produces — otherwise the parent stays wrongly listed
    // as a head after a same-hash-different-spelling sync.
    headsCanonicalizesNonCanonicalParentSpelling: () => {
        const effect =
            writeJson(rootJson)
            .step(hashRoot => writeJson({
                mimeType, object: objectA,
                parents: [vecToCBase32(hashRoot).toUpperCase()],
                content: 'https://example.com/child',
            }).step(hashChild => pure({ hashChild })))
            .step(({ hashChild }) => heads(c)(objectA).step(hs => pure({ hashChild, hs })))
            .step(({ hashChild, hs }) => {
                assertEq(hs.length, 1)
                assertEq(vecToCBase32(hs[0]), vecToCBase32(hashChild))
                return pure(undefined)
            })
        run(effect)
    },

    // `revisionsOf`/`heads` scope strictly to `object`: a revision of a
    // different object, and a non-revision blob entirely, are both ignored.
    unrelatedObjectAndNonRevisionBlobAreIgnored: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/a' })
            .step(() => writeJson({ mimeType, object: objectB, parents: [], content: 'https://example.com/b' }))
            .step(() => writeVec(utf8('just some unrelated text, not JSON at all {')))
            .step(() => revisionsOf(c)(objectA))
            .step(entries => {
                assertEq(entries.length, 1)
                return heads(c)(objectA)
            })
            .step(hs => {
                assertEq(hs.length, 1)
                return pure(undefined)
            })
        run(effect)
    },

    // `heads` on an object with no stored revisions at all is empty.
    headsOfUnknownObjectIsEmpty: () => {
        const hs = run(heads(c)(objectA))
        assertEq(hs.length, 0)
    },

    // readRevision failure modes, each a distinct branch: absent hash,
    // non-UTF-8 bytes, syntactically invalid JSON, and JSON that doesn't
    // satisfy the `revision` schema.
    readRevisionMissingHashIsError: () => {
        const [tag] = run(readRevision(c)(vec8(0x99n)))
        assertEq(tag, 'error')
    },
    readRevisionInvalidUtf8IsError: () => {
        const [tag] = run(writeVec(vec8(0xffn)).step(hash => readRevision(c)(hash)))
        assertEq(tag, 'error')
    },
    readRevisionMalformedJsonIsError: () => {
        const [tag, message] = run(writeVec(utf8('not json {')).step(hash => readRevision(c)(hash)))
        assertEq(tag, 'error')
        // The diagnostic from the JSON parser is returned as-is, not just an opaque tag.
        assert(typeof message === 'string' && message.length > 0)
    },
    readRevisionWrongShapeIsError: () => {
        const [tag] = run(writeJson({ notARevision: true }).step(hash => readRevision(c)(hash)))
        assertEq(tag, 'error')
    },

    // materialize surfaces `changes` as not-yet-implemented rather than
    // silently ignoring it.
    materializeChangesNotImplemented: () => {
        const [tag] = run(writeJson({ mimeType, object: objectA, parents: [], changes: [objectA] })
            .step(hash => materialize(c)(hash)))
        assertEq(tag, 'error')
    },

    // A multi-parent (merge) revision without `content` cannot be
    // materialized — the spec requires a merge to carry `content`.
    materializeMultiParentWithoutContentIsError: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/left' })
            .step(hashLeft => writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/right' }).step(hashRight => pure({ hashLeft, hashRight })))
            .step(({ hashLeft, hashRight }) => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashLeft), vecToCBase32(hashRight)] }))
            .step(hashMerge => materialize(c)(hashMerge))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // computeGeneration propagates a parent's decode failure rather than
    // treating a corrupt ancestor as generation 0.
    computeGenerationPropagatesParentError: () => {
        const effect =
            writeVec(utf8('not json {'))
            .step(hashBadParent => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashBadParent)], content: 'https://example.com/child' }))
            .step(hashChild => computeGeneration(c)(hashChild))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // materialize must not resolve a single parent's content when that
    // parent is a revision of a *different* object — per-object evolution
    // requires every step of one object's history to share its `object`.
    materializeRejectsParentFromDifferentObject: () => {
        const effect =
            writeJson({ mimeType, object: objectB, parents: [], content: 'https://example.com/b-root' })
            .step(hashBRoot => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashBRoot)] }))
            .step(hashChild => materialize(c)(hashChild))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // Same cross-object guard for `computeGeneration`.
    computeGenerationRejectsParentFromDifferentObject: () => {
        const effect =
            writeJson({ mimeType, object: objectB, parents: [], content: 'https://example.com/b-root' })
            .step(hashBRoot => writeJson({ mimeType, object: objectA, parents: [vecToCBase32(hashBRoot)], content: 'https://example.com/a-child' }))
            .step(hashChild => computeGeneration(c)(hashChild))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },
}
