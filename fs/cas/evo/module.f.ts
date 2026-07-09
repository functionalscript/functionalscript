/**
 * Store-touching operations for the `revision` content format
 * (`fs/media/revision`): head resolution and content materialization over a
 * `Cas<O>`. "evo" for evolution — mirrors the existing `fs/cas/cli/` and
 * `fs/cas/mcp/` sibling layout.
 *
 * Depends on `fs/cas` (the store) and `fs/media/revision` (the pure format).
 * This keeps `fs/cas/module.f.ts` itself focused on hashing/addressing —
 * see `fs/cas/todo/revision-content-format.md`.
 *
 * First iteration only: materialization supports zero or one parent and no
 * `changes` (`changes`/CRDT replay and multi-parent merges are future work —
 * a merge revision must already carry `content`, which this module can
 * always resolve regardless of parent count).
 *
 * A revision can never reference itself, directly or transitively, as its
 * own parent: a parent is named by its CAS hash, which is only known once
 * the parent blob already exists, so the DAG is acyclic by construction —
 * no cycle guard is needed when walking `parents`.
 *
 * @module
 */
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { decodeRevision, type Revision } from '../../media/revision/module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'
import { tokenize } from '../../media/json/tokenizer/module.f.ts'
import { parse as parseJsonTokens } from '../../media/json/parser/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { foldStep, okStep, pure, type Effect, type Operation } from '../../effects/module.f.ts'
import { collectRead, type Cas } from '../module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'
import { toOption } from '../../types/nullable/module.f.ts'

/**
 * Reads the blob at `hash` and decodes it as a `Revision`. Fails (rather
 * than throwing) when the blob is absent, not UTF-8, not JSON, or does not
 * satisfy the `revision` schema — any of which just means "not a revision
 * blob", a routine outcome when walking an arbitrary store.
 */
export const readRevision = <O extends Operation>(c: Cas<O>) => (hash: Vec): Effect<O, Result<Revision, string>> =>
    collectRead(c.read(hash)).step(([tag, bytes]) => {
        if (tag === 'error') { return pure(error('no such hash')) }
        const text = fromVec(bytes)
        if (text === null) { return pure(error('content is not valid UTF-8')) }
        const [jtag, value] = parseJsonTokens(tokenize(stringToList(text)))
        if (jtag === 'error') { return pure(error(value)) }
        const [dtag, revision] = decodeRevision(value)
        return pure(dtag === 'error' ? error(revision.message) : ok(revision))
    })

type RevisionEntry = readonly[Vec, Revision]

/** Every stored blob that decodes as a `Revision` of the given `object`, paired with its hash. */
export const revisionsOf = <O extends Operation>(c: Cas<O>) => (object: string): Effect<O, readonly RevisionEntry[]> =>
    c.list().step(hashes =>
        foldStep((hash: Vec) => (acc: readonly RevisionEntry[]): Effect<O, readonly RevisionEntry[]> =>
            readRevision(c)(hash).step(([tag, revision]) =>
                pure(tag === 'ok' && revision.object === object ? [...acc, [hash, revision] as const] : acc)))
        ([])(hashes))

/**
 * Resolves a `parents` hash string to its `Vec`. `fs/media/revision` does
 * not itself check that a `parents` entry decodes to a valid hash, so an
 * invalid one is simply dropped here (`toOption`) rather than treated as an
 * error — a store that only ever writes through `fs/media/revision`'s
 * schema can still write a `parents` string that isn't a real hash, and
 * silently ignoring it is the same graceful handling an absent parent gets.
 */
const toVec = (s: string): readonly Vec[] => toOption(cBase32ToVec(s))

/**
 * Resolves the current head(s) of `object`: every revision of `object` that
 * is not listed as a `parent` by any other revision of the same `object`.
 * A revision of a *different* object referencing the same hash (or an
 * unrelated blob) never demotes a head — the reverse index is scoped per
 * `object`, matching `fs/media/revision`'s materialization notes.
 *
 * A `parents` entry is decoded and re-encoded to its canonical cbase32 form
 * before comparison — cbase32 accepts more than one spelling of the same
 * hash (case-insensitive, `fs/basen/cbase32`'s Crockford-style
 * normalization), while `vecToCBase32` always produces the canonical one, so
 * comparing the raw stored string would miss a same-hash parent recorded in
 * a non-canonical spelling and wrongly leave it as a head.
 */
export const heads = <O extends Operation>(c: Cas<O>) => (object: string): Effect<O, readonly Vec[]> =>
    revisionsOf(c)(object).step(entries => {
        const parentHashes = new Set(entries.flatMap(([, revision]) => revision.parents.flatMap(toVec).map(vecToCBase32)))
        return pure(entries.flatMap(([hash]) =>
            parentHashes.has(vecToCBase32(hash)) ? [] : [hash]))
    })

/**
 * Reads a `parents` entry and verifies it belongs to the same `object` as
 * its child. A parent named by hash is just another blob in the store —
 * nothing prevents it from being a revision of a *different* `object* — but
 * per-object evolution (`heads`, `generation`) requires every step of one
 * object's history to share its `object` identity, so a mismatched parent
 * must fail rather than silently letting another object's content or
 * generation leak into this one's.
 */
const readSameObjectParent = <O extends Operation>(c: Cas<O>) => (object: string) => (hash: Vec): Effect<O, Result<Revision, string>> =>
    readRevision(c)(hash).step(okStep(revision =>
        pure(revision.object === object ? ok(revision) : error('parent revision belongs to a different object'))))

/**
 * Materializes the ref (a CAS hash, never the bytes themselves) that a
 * revision resolves to: `content` if present, otherwise — since `changes`
 * is not implemented yet — the revision's single parent's materialization,
 * or `object` when there are no parents.
 *
 * Fails when: the blob does not decode as a `Revision`; it carries
 * `changes` (unimplemented); it has more than one parent without `content`
 * (a merge revision, per the spec, must carry `content`); or its single
 * parent is a revision of a different `object`.
 */
export const materialize = <O extends Operation>(c: Cas<O>) => (hash: Vec): Effect<O, Result<string, string>> =>
    readRevision(c)(hash).step(okStep(revision => materializeRevision(c)(revision)))

const materializeRevision = <O extends Operation>(c: Cas<O>) => (revision: Revision): Effect<O, Result<string, string>> => {
    if (revision.content !== undefined) { return pure(ok(revision.content)) }
    if (revision.changes !== undefined) { return pure(error('changes materialization is not implemented yet')) }
    const parentHashes = revision.parents.flatMap(toVec)
    if (parentHashes.length === 0) { return pure(ok(revision.object)) }
    if (parentHashes.length > 1) { return pure(error('multi-parent revision must carry content')) }
    return readSameObjectParent(c)(revision.object)(parentHashes[0]).step(okStep(materializeRevision(c)))
}

/**
 * Recomputes `object`'s evolution generation for `hash` from its `parents`
 * chain (`0` with no parents, otherwise `1 + max(parent.generation)`), so a
 * caller can compare it against a revision's cached `generation` field
 * instead of trusting an unverified value from an untrusted store.
 */
export const computeGeneration = <O extends Operation>(c: Cas<O>) => (hash: Vec): Effect<O, Result<number, string>> =>
    readRevision(c)(hash).step(okStep(revision => computeGenerationOf(c)(revision)))

const computeGenerationOf = <O extends Operation>(c: Cas<O>) => (revision: Revision): Effect<O, Result<number, string>> => {
    const parentHashes = revision.parents.flatMap(toVec)
    if (parentHashes.length === 0) { return pure(ok(0)) }
    return foldStep((parentHash: Vec) => (acc: Result<number, string>): Effect<O, Result<number, string>> =>
        okStep<number, string, O, number>(accGen =>
            readSameObjectParent(c)(revision.object)(parentHash).step(okStep(parentRevision =>
                computeGenerationOf(c)(parentRevision).step(okStep<number, string, O, number>(g => pure(ok(Math.max(accGen, g))))))))(acc))
        (ok(-1))(parentHashes)
        .step(okStep<number, string, O, number>(maxGen => pure(ok(maxGen + 1))))
}
