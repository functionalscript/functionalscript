/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 *
 * @import { Sha2, State as Sha2State } from '../crypto/sha2/types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { Operation } from '../effects/types.ts'
 * @import { Effect, NotImplemented } from '../effects/io/types.ts'
 * @import { IoChannel, Now, RandomInt, ReadBytes, Readdir, Rm } from '../effects/node/types.ts'
 *  @import { List } from '../effects/list/types.ts'
 * @import { Cas, FileCas, FileCasOperation } from './types.ts'
 */

import { join, normalize, parse } from '../path/module.f.mjs'
import { empty, length, maxLength, maxLengthBytes, msb, vec } from '../types/bit_vec/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../basen/cbase32/module.f.mjs'
import { mapStep, pure, step } from '../effects/module.f.mjs'
import {
    catchStep,
    foldStep,
    forEachStep,
    history,
    historyStep,
    mapStep as ioMapStep,
    pureError,
    pureOk,
    resultStep,
    step as ioStep,
} from '../effects/io/module.f.mjs'
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
    writeBytes,
} from '../effects/node/module.f.mjs'
import { toOption } from '../types/nullable/module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { splitAt } from '../types/string/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../effects/list/module.f.mjs'

const split2 = splitAt(2)

const prefix = '.cas'

/** Converts a content key to its sharded relative CAS file path.
 *
 * @type {(key: Vec) => string}
 */
export const toPath = key => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return join(prefix, a, b, c)
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
 * @param {List<O, Vec, IoChannel>} stream
 * @returns {Effect<O, Vec, IoChannel>}
 */
export const collectRead = stream => {
    /** @type {(acc: Vec) => (s: List<O, Vec, IoChannel>) => Effect<O, Vec, IoChannel>} */
    const loop = acc => s =>
        ioStep(s, node => {
            if (node === undefined) { return pureOk(acc) }
            const { first, tail } = node
            if (length(acc) + length(first) > maxLength) {
                return pureError(ioError({ message: `cas blob exceeds maximum vector length of ${maxLength} bits` }))
            }
            return loop(msb.concat(acc)(first))(tail)
        })
    return loop(empty)(stream)
}

/** Maximum chunk size for streaming reads: the largest `Vec` the runtime allows. */
const chunkBytes = Number(maxLengthBytes)

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
 * @param {List<O1, Vec, IoChannel>} payload
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
        const rel = toPath(hash)
        const dst = join(path, rel)
        const dstDir = join(path, ...parse(rel).slice(0, -1))
        const created = step(mkdir(dstDir, { recursive: true }), () => rename(curPath, dst))
        const removed = step(created, () => rm(curPath))
        const stated = step(removed, () => stat(dst))
        return mapStep(
            stated,
            st => st[0] === 'ok' && st[1].size === offset ? ok(hash) : error(ioError({ message: 'publish size mismatch' })))
    }
    // Any streaming error fails closed: delete the partial file, return the error.
    /** @type {(curPath: string, e: IoChannel) => Effect<FileCasOperation, Vec, IoChannel>} */
    const fail = (curPath, e) =>
        mapStep(rm(curPath), () => error(e))
    const rndEffect = ioStep(gcStage(stageDir), () => random256)
    return ioStep(rndEffect, rnd => {
        const rndStr = vecToCBase32(rnd)
        /** @type {(state: Sha2State, offset: number, curPath: string) => (stream: List<O1, Vec, IoChannel>) => Effect<O1 | FileCasOperation, Vec, IoChannel>} */
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
                        const newOffset = offset + Number(length(chunk) / 8n)
                        // Renew the lease: rename to a fresh deadline (keeps `delta` constant).
                        // The new path is still needed after the rename, to recurse with,
                        // so the rename captures it rather than closing over it.
                        const nextPath = ioMapStep(
                            now(),
                            t => join(stageDir, stageName(t + leaseDelta, rndStr)))
                        const renamed = historyStep(
                            history(nextPath),
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
        const started = ioStep(mkdir(stageDir, { recursive: true }), () => now())
        return ioStep(started, t0 => {
            const path0 = join(stageDir, stageName(t0 + leaseDelta, rndStr))
            return ioStep(
                createExclusive(path0),
                () => loop(sha2.init, 0, path0)(payload))
        })
    })
}

/**
 * Builds a content-addressable storage facade from a SHA-2 implementation.
 *
 * @type {(sha2: Sha2) => (path: string) => FileCas}
 */
export const fileCas = sha2 => path => {
    const storePrefix = join(path, prefix)
    const normalizedStorePrefix = normalize(storePrefix)
    const stageDir = join(storePrefix, stageRel)
    return {
        read: hash => {
            const p = join(path, toPath(hash))
            /** @type {(offset: number) => List<FileCasOperation, Vec, IoChannel>} */
            const loop = offset =>
                // A missing shard or read error fails the stream, and `step`
                // propagates it — the cell's own failure can never be mistaken
                // for the `undefined` that ends one.
                ioStep(
                    readBytes(p, offset, chunkBytes),
                    // End the stream only on an empty read; every non-empty read — including a
                    // final short (`< CHUNK_BYTES`) chunk — is emitted as a cell.
                    chunk => length(chunk) === 0n
                        ? elEmpty()
                        : nonEmpty(chunk, loop(offset + chunkBytes)))
            return loop(0)
        },
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
                                ? cBase32ToVec(normalize(parentPath).substring(normalizedStorePrefix.length).replaceAll('/', '') + name)
                                : null)))),
        url: hash =>
            join(path, toPath(hash))
    }
}

/** 256-bit random `Vec` built from 8 sequential `randomInt` (32-bit) calls.
 *
 * @type {Effect<RandomInt, Vec, NotImplemented>}
 */
const random256 =
    foldStep(
        pureOk([0, 1, 2, 3, 4, 5, 6, 7]),
        empty,
        () => (/** @type {Vec} */ acc) =>
            ioMapStep(randomInt(), r => msb.concat(acc)(vec(32n)(BigInt(r)))))

/** Streams any file at `filePath` in `<=128 KiB` chunks.
 *
 * A failed read fails the stream. It used to be yielded as an error *item*
 * followed by an explicit empty tail — a tail no consumer would ever pull.
 *
 * @type {(filePath: string) => List<ReadBytes, Vec, IoChannel>}
 */
const streamFile = filePath => {
    /** @type {(offset: number) => List<ReadBytes, Vec, IoChannel>} */
    const loop = offset =>
        ioStep(
            readBytes(filePath, offset, chunkBytes),
            chunk => length(chunk) === 0n
                ? elEmpty()
                : nonEmpty(chunk, loop(offset + chunkBytes)))
    return loop(0)
}

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

