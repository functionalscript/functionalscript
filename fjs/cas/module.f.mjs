/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 *
 * @import { Sha2, State as Sha2State } from '../crypto/sha2/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { Operation } from '../effects/types.ts'
 * @import { Effect, NotImplemented } from '../effects/types.ts'
 * @import { IoChannel, Now, RandomInt, ReadBytes, Readdir, Rm } from '../effects/node/types.ts'
 *  @import { EffectList } from '../effects/list/types.ts'
 * @import { Cas, FileCas, FileCasOperation } from './types.ts'
 */

import { join, normalize } from '../path/module.f.mjs'
import { byteLength, empty, isWholeBytes, maxLength, msb, vec } from '../types/bit_vec/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../basen/cbase32/module.f.mjs'
import {
    catchStep,
    foldStep,
    forEachStep,
    history,
    historyStep,
    mapStep as ioMapStep,
    pureError,
    pureOk,
    resultMapStep,
    resultStep,
    step as ioStep,
} from '../effects/module.f.mjs'
import {
    access,
    createExclusive,
    ioError,
    isNotFound,
    mkdir,
    now,
    randomInt,
    readBytes,
    readdir,
    rename,
    rm,
    stat,
    readChunks,
    writeBytes,
} from '../effects/node/module.f.mjs'
import { toOption } from '../types/nullable/module.f.js'
import { error, ok } from '../types/result/module.f.js'
import { splitAt } from '../types/string/module.f.mjs'

const split2 = splitAt(2)

/**
 * The directory every shard sits under, relative to the store's root: the
 * `.cas` of `~/.cas/`, and of a Git branch's tree in
 * [`fjs/cas/git`](./git/module.f.mjs), whose listing starts at it.
 */
export const prefix = '.cas'

/** The sharded location of a content key: its relative directory and file name.
 * The one owner of the shard layout; `toPath` and `publish` are its two views,
 * and `unshard` is its inverse.
 *
 * @type {(key: Vec) => { readonly dir: string, readonly name: string }}
 */
const shard = key => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return { dir: join(prefix, a, b), name: c }
}

/** The inverse of `shard`: recovers a content key from its shard path relative
 * to the `.cas` directory, or `null` if the path, without its separators, is
 * not cBase32. It does not check the key's length, so a cBase32 path of the
 * wrong length decodes to a key no hash produced.
 *
 * Exported for the listing of a store that is no directory — a Git tree's,
 * in [`fjs/cas/git`](./git/module.f.mjs) — which walks the same layout.
 *
 * @type {(relPath: string) => Vec | null}
 */
export const unshard = relPath => cBase32ToVec(relPath.replaceAll('/', ''))

/** Converts a content key to its sharded relative CAS file path.
 *
 * @type {(key: Vec) => string}
 */
export const toPath = key => {
    const { dir, name } = shard(key)
    return join(dir, name)
}

/**
 * Drains a `Cas<O>.read` chunk stream into a single `Vec`. Used by any caller
 * that needs the whole blob at once (an MCP `content: true` fetch, an Evo
 * revision decode): the chunk stream is concatenated, and a stream that fails
 * fails this. A single `Vec` cannot exceed `maxLength` bits; concatenating past
 * it would overflow the runtime's `bigint` constraint, so that case fails here
 * too rather than crashing the process.
 *
 * @template {Operation} O
 * @param {EffectList<O, Vec, IoChannel>} stream
 * @returns {Effect<O, Vec, IoChannel>}
 */
export const collectRead = stream => {
    /** @type {(acc: Vec) => (s: EffectList<O, Vec, IoChannel>) => Effect<O, Vec, IoChannel>} */
    const loop = acc => s =>
        ioStep(s, node => {
            if (node === undefined) { return pureOk(acc) }
            const { first, tail } = node
            const next = msb.tryConcat(acc)(first)
            if (next === null) {
                return pureError(ioError({ message: `cas blob exceeds maximum vector length of ${maxLength} bits` }))
            }
            return loop(next)(tail)
        })
    return loop(empty)(stream)
}


/** What a chunk that is not whole bytes is refused as: `writeBytes`'s words, since `write` fails the same chunk through it. */
const partialByte = pureError(ioError({ message: 'invalid buffer size' }))

/**
 * `sha2` folded over the rest of a stream from `state`: the fold
 * {@link contentKey} runs, one link per chunk. A chunk that is not whole
 * bytes is refused as `write` refuses it, rather than hashed into a key no
 * store can hold content under.
 *
 * @template {Operation} O
 * @param {Sha2} sha2
 * @param {Sha2State} state
 * @param {EffectList<O, Vec, IoChannel>} s
 * @returns {Effect<O, Vec, IoChannel>}
 */
const digested = (sha2, state, s) => ioStep(s, node => {
    if (node === undefined) { return pureOk(sha2.end(state)) }
    return isWholeBytes(node.first) ? digested(sha2, sha2.append(node.first)(state), node.tail) : partialByte
})

/**
 * The content key of a payload, computed without storing it: `sha2` folded
 * over the stream's chunks, which is the fold `write` runs beside its
 * `writeBytes`, so for the same bytes the key this answers and the key
 * `write` returns are one key. That is what lets a caller ask a store whether
 * content is there before, or instead of, adding it — the build cache in
 * [`fjs/ci/todo/097-smart-ca-ci.md`](../ci/todo/097-smart-ca-ci.md) hashes a
 * candidate manifest to look it up, and adding it to find out would record a
 * success that never happened.
 *
 * Pure in the payload: a stream of pure cells issues no command at all, and
 * one that pulls through effects issues only the stream's own. A stream that
 * fails fails this with its own failure, as `write` fails, and no key is
 * answered for the bytes that arrived before it; a chunk that is not whole
 * bytes fails it as `write` fails on one, since a key for content no store
 * can hold is a lookup that can only miss.
 *
 * The operation set is the payload's: `contentKey(sha2)` fixes nothing,
 * and the stream handed to what it answers decides `O`, so a caller holding
 * the effect before running it holds one its runner's operation map types.
 *
 * @param {Sha2} sha2
 * @returns {<O extends Operation>(payload: EffectList<O, Vec, IoChannel>) => Effect<O, Vec, IoChannel>}
 */
export const contentKey = sha2 => payload => digested(sha2, sha2.init, payload)

/** Staging directory under the store root; GC and every uploader share it. */
const stageRel = '_stage'

/**
 * Lease duration in ms: a staging file's deadline is `now() + leaseDelta`.
 * Renewed after every chunk, so it only has to cover the gap between two
 * consecutive chunks (see [staging-lease.md](./plan/staging-lease.md)).
 */
const leaseDelta = 30_000

/**
 * Fixed width for the zero-padded epoch-ms deadline embedded in a staging name,
 * so names sort lexically exactly as they sort chronologically. 19 digits keeps
 * epoch-ms (13 digits today) padded with headroom well past year 2286.
 */
const deadlineWidth = 19

/** Builds a `<deadline>-<random256>` staging file name.
 *
 * @type {(deadline: number, rnd: string) => string}
 */
const stageName = (deadline, rnd) =>
    `${String(deadline).padStart(deadlineWidth, '0')}-${rnd}`

/** Recovers the deadline (epoch ms) from a `<deadline>-<random256>` name.
 *
 * @type {(name: string) => number}
 */
const deadlineOf = name => Number(name.slice(0, name.indexOf('-')))

/** A staging path whose embedded deadline is `leaseDelta` ms in the future:
 * the one place a lease is (re)issued, whether by the initial create or by a
 * renewal.
 *
 * @type {(stageDir: string) => (rnd: string) => Effect<Now, string>}
 */
const freshStagePath = stageDir => rnd =>
    ioMapStep(now(), t => join(stageDir, stageName(t + leaseDelta, rnd)))

/**
 * Reclaims expired staging files: any `_stage/<deadline>-<rand>` whose deadline
 * is already in the past. Lazy and piggy-backed on `write`. Best-effort — a
 * missing `_stage/` (fresh store) or any `readdir`/`rm` error is ignored, and a
 * still-live lease is left alone; the fencing rename keeps even a misjudged
 * reclaim fail-safe (worst case: that upload restarts).
 *
 * The error channel is `never`, and that is the claim this function makes: it
 * catches every failure it can produce, so an upload composing it cannot fail
 * because of a sweep.
 *
 * @type {(stageDir: string) => Effect<Now | Readdir | Rm, void, never>}
 */
const gcStage = stageDir => {
    // The `readdir` result and the `now()` timestamp are both needed by the last
    // link, so the timestamp is carried forward in a history rather than closed
    // over by a nested continuation.
    const listed = historyStep(
        history(now()),
        () => readdir(stageDir, {}))
    const swept = ioStep(
        listed,
        ([dirents, t]) => {
            const expired = dirents.flatMap(d =>
                d.isFile && deadlineOf(d.name) < t ? [d.name] : [])
            // Each `rm` recovers on its own, so one undeletable file does not
            // stop the sweep at the file before it.
            return forEachStep(
                pureOk(expired),
                name => catchStep(rm(join(stageDir, name)), () => pureOk(undefined)))
        })
    // A fresh store has no `_stage/` yet, and a sweep that cannot run must not
    // fail the upload it is piggy-backed on.
    return catchStep(swept, () => pureOk(undefined))
}

// Lock-free staging upload (plan/staging-lease.md): stream each chunk straight
// to a `_stage/<deadline>-<rand>` file via `writeBytes` while folding it into the
// running SHA-2 state — the payload never lives in memory as a whole. The lease is
// renewed (rename to a fresh deadline) after every chunk; any error deletes the
// partial file and fails. On end-of-stream the file is published to its hash-derived
// shard path by a replace-`rename` (which also dedups/repairs a same-content shard),
// and success is confirmed by a `stat` size check. GC of expired staging files is
// piggy-backed at the start.
/**
 * @template {Operation} O1
 * @param {Sha2} sha2
 * @param {string} path
 * @param {string} stageDir
 * @param {EffectList<O1, Vec, IoChannel>} payload
 * @returns {Effect<O1 | FileCasOperation, Vec, IoChannel>}
 */
const writeImpl = (sha2, path, stageDir, payload) => {
    // Publish the finished staging file to its content-addressed shard. The three
    // filesystem steps run best-effort with their results ignored; success is decided
    // afterward by observing the target's size (see staging-lease.md "Publish ignores
    // results and checks the end state").
    /** @type {(state: Sha2State, offset: number, curPath: string) => Effect<FileCasOperation, Vec, IoChannel>} */
    const publish = (state, offset, curPath) => {
        const hash = sha2.end(state)
        const { dir, name } = shard(hash)
        const dstDir = join(path, dir)
        const dst = join(dstDir, name)
        // `resultStep` throughout, and that is the "ignores results" above
        // written in the type: each link runs whatever the previous one
        // answered, and only the closing `stat` decides the outcome.
        const created = resultStep(mkdir(dstDir, { recursive: true }), () => rename(curPath, dst))
        const removed = resultStep(created, () => rm(curPath))
        const stated = resultStep(removed, () => stat(dst))
        return resultMapStep(
            stated,
            st => st[0] === 'ok' && st[1].size === offset ? ok(hash) : error(ioError({ message: 'publish size mismatch' })))
    }
    // Any streaming error fails closed: delete the partial file, return the error.
    /** @type {(curPath: string, e: IoChannel) => Effect<FileCasOperation, Vec, IoChannel>} */
    const fail = (curPath, e) =>
        // The cleanup's own outcome is discarded on purpose: `e` is what the
        // caller needs to hear, and a failed `rm` has no better answer.
        resultMapStep(rm(curPath), () => error(e))
    const rndEffect = ioStep(gcStage(stageDir), () => random256)
    return ioStep(rndEffect, rnd => {
        const freshPath = freshStagePath(stageDir)(vecToCBase32(rnd))
        /** @type {(state: Sha2State, offset: number, curPath: string) => (stream: EffectList<O1, Vec, IoChannel>) => Effect<O1 | FileCasOperation, Vec, IoChannel>} */
        const loop = (state, offset, curPath) =>
            stream =>
                // `resultStep`, not `step`: a stream that fails must still be
                // cleaned up after, so this handles the failure rather than
                // letting it propagate past the partial file.
                resultStep(stream, r => {
                    if (r[0] === 'error') {
                        return fail(curPath, r[1])
                    }
                    const node = r[1]
                    if (node === undefined) {
                        return publish(state, offset, curPath)
                    }
                    const { first: chunk, tail } = node
                    // Both branches matter: a failed write is cleaned up after,
                    // rather than propagated with the partial file left behind.
                    return resultStep(writeBytes(curPath, offset, chunk), wb => {
                        if (wb[0] === 'error') { return fail(curPath, wb[1]) }
                        const newState = sha2.append(chunk)(state)
                        const newOffset = offset + Number(byteLength(chunk))
                        // Renew the lease: rename to a fresh deadline (keeps `delta` constant).
                        // The new path is still needed after the rename, to recurse with,
                        // so the rename captures it rather than closing over it.
                        const renamed = historyStep(
                            history(freshPath),
                            next => rename(curPath, next))
                        return resultStep(
                            renamed,
                            r => {
                                if (r[0] === 'error') { return fail(curPath, r[1]) }
                                const [, next] = r[1]
                                return loop(newState, newOffset, next)(tail)
                            })
                    })
                })
        const started = ioStep(mkdir(stageDir, { recursive: true }), () => freshPath)
        const created = historyStep(history(started), path0 => createExclusive(path0))
        return ioStep(created, ([, path0]) => loop(sha2.init, 0, path0)(payload))
    })
}

/** Streams any file at `filePath` in `<=128 KiB` chunks.
 *
 * A failed read fails the stream. It used to be yielded as an error *item*
 * followed by an explicit empty tail — a tail no consumer would ever pull.
 *
 * @type {(filePath: string) => EffectList<ReadBytes, Vec, IoChannel>}
 */
const streamFile = filePath => readChunks((offset, size) => readBytes(filePath, offset, size), null)

/**
 * Builds a content-addressable storage facade from a SHA-2 implementation.
 *
 * @type {(sha2: Sha2) => (path: string) => FileCas}
 */
export const fileCas = sha2 => path => {
    const storePrefix = join(path, prefix)
    const normalizedStorePrefix = normalize(storePrefix)
    const stageDir = join(storePrefix, stageRel)
    /** @type {(hash: Vec) => string} */
    const at = hash => join(path, toPath(hash))
    return {
        read: hash =>
            // Unbounded: an empty read ends the stream, and every non-empty
            // read — including a final short one — is a cell. A missing shard
            // or a read error fails the stream rather than ending it, so a
            // cell's failure is never mistaken for the end.
            //
            // Reading by NAME is safe here and would not be in a served tree:
            // a name in this store is its content's hash, published by `rename`
            // and only ever republishable with the same bytes, so whichever
            // inode a per-chunk open lands on holds what the last one held.
            streamFile(at(hash)),
        write: payload => writeImpl(sha2, path, stageDir, payload),
        list: () =>
            // A fresh store has no `.cas` directory yet. Treat *only* that case as an
            // empty store, mirroring how `read` fails a stream on a missing shard.
            // A `.cas` that exists but cannot be read (permissions, corruption) is a
            // genuine storage error and is surfaced, not masked as "no hashes".
            //
            // `resultStep` because both branches genuinely matter: the absent
            // store is a success answering `ok([])`, and every other failure is
            // the caller's to see. It used to `throw` here, which is what the
            // paragraph above always meant by "surfaced" but could not say
            // while the return type had no error channel to say it in.
            resultStep(access(storePrefix), a =>
                a[0] === 'error'
                    ? isNotFound(a[1]) ? pureOk([]) : pureError(a[1])
                    : ioMapStep(
                        readdir(storePrefix, { recursive: true }),
                        r => r.flatMap(({ name, parentPath, isFile }) =>
                            toOption(isFile
                                ? unshard(join(normalize(parentPath).substring(normalizedStorePrefix.length), name))
                                : null)))),
        url: at
    }
}

/** 256-bit random `Vec` built from 8 sequential `randomInt` (32-bit) calls:
 * what a name nobody else is writing to is made of, here for a staging file
 * and in [`fjs/cas/git`](./git/module.f.mjs) for a loose object's temporary
 * file, which is why it is exported.
 *
 * @type {Effect<RandomInt, Vec, NotImplemented>}
 */
export const random256 =
    foldStep(
        pureOk([0, 1, 2, 3, 4, 5, 6, 7]),
        empty,
        () => (/** @type {Vec} */ acc) =>
            ioMapStep(randomInt(), r => msb.concat(acc)(vec(32n)(BigInt(r)))))

/**
 * Streams the file at `path` through `cas.write`, returning the content hash.
 * Its one consumer is the CLI's `cas add`; the MCP `cas_add` tool takes inline
 * content and calls `write` itself, so it does not come through here.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(path: string) => Effect<O | ReadBytes, Vec, IoChannel>}
 */
export const casAddFile = cas => path =>
    // streamFile produces only ReadBytes effects. TypeScript can't prove ListEffect<ReadBytes,T>
    // ≤ ListEffect<O,T> for generic O (recursive type), but the cast is sound: every concrete
    // caller passes a Cas<O> where ReadBytes ⊆ O (e.g. FileCasOperation).
    cas.write(streamFile(path))

