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
const assertOk = <T>(r: Result<T, unknown>, expected: T): void => {
    assertEq(r[0], 'ok')
    if (r[0] === 'ok') { assertEq(r[1], expected) }
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

export const proof = {
    // Linear history: first revision has no parents and carries `content`;
    // the second revises it. `heads` resolves to only the tip, and
    // `materialize` on the tip returns its own `content` (highest precedence).
    linearHistory: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/content-a' }).step(hashA => {
                const a = vecToCBase32(hashA)
                return writeJson({ mimeType, object: objectA, parents: [a], content: 'https://example.com/content-b' }).step(hashB => {
                    const b = vecToCBase32(hashB)
                    return heads(c)(objectA).step(hs => {
                        assertEq(hs.length, 1)
                        assertEq(vecToCBase32(hs[0]), b)
                        return materialize(c)(hashB).step(mat => {
                            assertOk(mat, 'https://example.com/content-b')
                            // A third revision with a single parent and no `content` of its
                            // own must recurse through that parent to materialize.
                            return writeJson({ mimeType, object: objectA, parents: [b] }).step(hashC =>
                                materialize(c)(hashC).step(mat2 => {
                                    assertOk(mat2, 'https://example.com/content-b')
                                    return pure(undefined)
                                }))
                        })
                    })
                })
            })
        run(effect)
    },

    // First revision (no parents, no `content`, no `changes`) materializes
    // from `object` itself.
    firstRevisionMaterializesFromObject: () => {
        const effect = writeJson({ mimeType, object: objectA, parents: [] }).step(hashA =>
            materialize(c)(hashA).step(mat => {
                assertOk(mat, objectA)
                return pure(undefined)
            }))
        run(effect)
    },

    // Branch + merge: two revisions branch off a common first revision, then
    // a merge revision (two parents, `content`) resolves both into one head.
    branchAndMerge: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/root' }).step(hashRoot => {
                const root = vecToCBase32(hashRoot)
                return writeJson({ mimeType, object: objectA, parents: [root], content: 'https://example.com/left' }).step(hashLeft => {
                    const left = vecToCBase32(hashLeft)
                    return writeJson({ mimeType, object: objectA, parents: [root], content: 'https://example.com/right' }).step(hashRight => {
                        const right = vecToCBase32(hashRight)
                        return heads(c)(objectA).step(beforeMerge => {
                            assertEq(beforeMerge.length, 2)
                            return writeJson({ mimeType, object: objectA, parents: [left, right], content: 'https://example.com/merged' })
                                .step(hashMerge => {
                                    const merge = vecToCBase32(hashMerge)
                                    return heads(c)(objectA).step(afterMerge => {
                                        assertEq(afterMerge.length, 1)
                                        assertEq(vecToCBase32(afterMerge[0]), merge)
                                        return materialize(c)(hashMerge).step(mat => {
                                            assertOk(mat, 'https://example.com/merged')
                                            return computeGeneration(c)(hashMerge).step(gen => {
                                                assertOk(gen, 2)
                                                return pure(undefined)
                                            })
                                        })
                                    })
                                })
                        })
                    })
                })
            })
        run(effect)
    },

    // Many heads: three independent first revisions of the same object are
    // all heads at once (no merge yet).
    manyHeadsForOneObject: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/one' }).step(() =>
                writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/two' }).step(() =>
                    writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/three' }).step(() =>
                        heads(c)(objectA).step(hs => {
                            assertEq(hs.length, 3)
                            return pure(undefined)
                        }))))
        run(effect)
    },

    // An archived revision decodes with `archived: true` and still
    // participates in head resolution like any other revision.
    archivedObject: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/done', archived: true }).step(hash =>
                readRevision(c)(hash).step(([tag, revision]) => {
                    assertEq(tag, 'ok')
                    if (tag === 'error') { throw revision }
                    assertEq(revision.archived, true)
                    return heads(c)(objectA).step(hs => {
                        assertEq(hs.length, 1)
                        return pure(undefined)
                    })
                }))
        run(effect)
    },

    // A cached `generation` can be wrong (stale, or forged by an untrusted
    // source); `computeGeneration` recomputes it from `parents` instead of
    // trusting the stored field, so a caller can detect the mismatch.
    generationCacheMismatch: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/root' }).step(hashRoot => {
                const root = vecToCBase32(hashRoot)
                // Cached `generation` (99) is wrong: the real value is 1.
                return writeJson({ mimeType, object: objectA, parents: [root], content: 'https://example.com/child', generation: 99 })
                    .step(hashChild =>
                        readRevision(c)(hashChild).step(([tag, revision]) => {
                            assertEq(tag, 'ok')
                            if (tag === 'error') { throw revision }
                            return computeGeneration(c)(hashChild).step(gen => {
                                assertOk(gen, 1)
                                assert(gen[0] === 'ok' && gen[1] !== revision.generation)
                                return pure(undefined)
                            })
                        }))
            })
        run(effect)
    },

    // A previously-lone head is demoted the moment a newly synced revision
    // (of the same object) names it as a parent — sync just moves blobs, it
    // never has to reason about "current head" itself.
    headDemotedRetroactivelyBySync: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/root' }).step(hashRoot => {
                const root = vecToCBase32(hashRoot)
                return heads(c)(objectA).step(before => {
                    assertEq(before.length, 1)
                    // A revision synced in later, naming `root` as its parent.
                    return writeJson({ mimeType, object: objectA, parents: [root], content: 'https://example.com/synced-child' })
                        .step(hashChild => {
                            const child = vecToCBase32(hashChild)
                            return heads(c)(objectA).step(after => {
                                assertEq(after.length, 1)
                                assertEq(vecToCBase32(after[0]), child)
                                return pure(undefined)
                            })
                        })
                })
            })
        run(effect)
    },

    // `revisionsOf`/`heads` scope strictly to `object`: a revision of a
    // different object, and a non-revision blob entirely, are both ignored.
    unrelatedObjectAndNonRevisionBlobAreIgnored: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/a' }).step(() =>
                writeJson({ mimeType, object: objectB, parents: [], content: 'https://example.com/b' }).step(() =>
                    writeVec(utf8('just some unrelated text, not JSON at all {')).step(() =>
                        revisionsOf(c)(objectA).step(entries => {
                            assertEq(entries.length, 1)
                            return heads(c)(objectA).step(hs => {
                                assertEq(hs.length, 1)
                                return pure(undefined)
                            })
                        }))))
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
        const effect = writeVec(vec8(0xffn)).step(hash => readRevision(c)(hash))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },
    readRevisionMalformedJsonIsError: () => {
        const effect = writeVec(utf8('not json {')).step(hash => readRevision(c)(hash))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },
    readRevisionWrongShapeIsError: () => {
        const effect = writeJson({ notARevision: true }).step(hash => readRevision(c)(hash))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // materialize surfaces `changes` as not-yet-implemented rather than
    // silently ignoring it.
    materializeChangesNotImplemented: () => {
        const effect = writeJson({ mimeType, object: objectA, parents: [], changes: [objectA] })
            .step(hash => materialize(c)(hash))
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // A multi-parent (merge) revision without `content` cannot be
    // materialized — the spec requires a merge to carry `content`.
    materializeMultiParentWithoutContentIsError: () => {
        const effect =
            writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/left' }).step(hashLeft => {
                const left = vecToCBase32(hashLeft)
                return writeJson({ mimeType, object: objectA, parents: [], content: 'https://example.com/right' }).step(hashRight => {
                    const right = vecToCBase32(hashRight)
                    return writeJson({ mimeType, object: objectA, parents: [left, right] }).step(hashMerge =>
                        materialize(c)(hashMerge))
                })
            })
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },

    // computeGeneration propagates a parent's decode failure rather than
    // treating a corrupt ancestor as generation 0.
    computeGenerationPropagatesParentError: () => {
        const effect = writeVec(utf8('not json {')).step(hashBadParent => {
            const bad = vecToCBase32(hashBadParent)
            return writeJson({ mimeType, object: objectA, parents: [bad], content: 'https://example.com/child' })
                .step(hashChild => computeGeneration(c)(hashChild))
        })
        const [tag] = run(effect)
        assertEq(tag, 'error')
    },
}
