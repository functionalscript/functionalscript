/**
 * Content-addressable storage utilities for hashing, addressing, and path parsing.
 *
 * @module
 */
import { sha256, type Sha2, type State as Sha2State } from '../crypto/sha2/module.f.ts'
import { join, normalize, parse } from '../path/module.f.ts'
import { empty, length, maxLengthBytes, msb, vec, type Vec } from '../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../cbase32/module.f.ts'
import { foldStep, forEachStep, listEffectCons, listEffectEnd, pure, type Effect, type ListEffect, type Operation } from '../effects/module.f.ts'
import {
    access,
    createExclusive,
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
    type Access,
    type CreateExclusive,
    type IoResult,
    type Mkdir,
    type Now,
    type RandomInt,
    type ReadBytes,
    type Readdir,
    type Rename,
    type Rm,
    type Stat,
    type WriteBytes,
} from '../effects/node/module.f.ts'
import { toOption } from '../types/nullable/module.f.ts'
import { error, ok, unwrap } from '../types/result/module.f.ts'
import { splitAt } from '../types/string/module.f.ts'

const split2 = splitAt(2)

const prefix = '.cas'

/** Converts a content key to its sharded relative CAS file path. */
export const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return join(prefix, a, b, c)
}

/**
 * The filesystem effects the streaming CAS performs: `read` pulls shards
 * (`ReadBytes`); `list` walks the store (`Access`/`Readdir`); `write` runs the
 * lock-free staging upload (`Mkdir`/`CreateExclusive`/`WriteBytes`/`Rename`/`Rm`/
 * `Stat`, lease deadlines from `Now`, staging names from `RandomInt`) and GC's
 * expired staging files (`Readdir`/`Rm`).
 */
export type FileCasOperation =
    | ReadBytes | Mkdir | Readdir | Access | Rename | Rm
    | RandomInt | Now | CreateExclusive | WriteBytes | Stat
    | Now | Readdir | Rm

export type Cas<O extends Operation> = {
    /**
     * Streams the content for `hash` out in `<=128 KiB` chunks. Every pull yields an
     * explicit `ok(chunk)` or `error` item, so a missing shard or I/O error is a distinct
     * error *item* in the stream, never collapsed into end-of-stream (`undefined`).
     */
    readonly read: (hash: Vec) => ListEffect<O, IoResult<Vec>>
    /**
     * Consumes a chunk stream — each item `ok(chunk)` or `error` — hashing incrementally,
     * and returns the content address. An error item aborts the upload.
     */
    readonly write: <O1 extends Operation>(payload: ListEffect<O1, IoResult<Vec>>) => Effect<O | O1, IoResult<Vec>>
    /** Lists all stored content hashes. */
    readonly list: () => Effect<O, readonly Vec[]>
}

/** Maximum chunk size for streaming reads: the largest `Vec` the runtime allows. */
const chunkBytes = Number(maxLengthBytes)

/** Staging directory under the store root; GC and every uploader share it. */
const stageRel = '_stage'

/**
 * Lease duration in ms: a staging file's deadline is `now() + leaseDelta`.
 * Renewed after every chunk, so it only has to cover the gap between two
 * consecutive chunks (see [staging-lease.md](../../issues/cas/staging-lease.md)).
 */
const leaseDelta = 30_000

/**
 * Fixed width for the zero-padded epoch-ms deadline embedded in a staging name,
 * so names sort lexically exactly as they sort chronologically. 19 digits keeps
 * epoch-ms (13 digits today) padded with headroom well past year 2286.
 */
const deadlineWidth = 19

/** Builds a `<deadline>-<random256>` staging file name. */
const stageName = (deadline: number, rnd: string): string =>
    `${String(deadline).padStart(deadlineWidth, '0')}-${rnd}`

/** Recovers the deadline (epoch ms) from a `<deadline>-<random256>` name. */
const deadlineOf = (name: string): number => Number(name.slice(0, name.indexOf('-')))

/**
 * Reclaims expired staging files: any `_stage/<deadline>-<rand>` whose deadline
 * is already in the past. Lazy and piggy-backed on `write`. Best-effort — a
 * missing `_stage/` (fresh store) or any `readdir`/`rm` error is ignored, and a
 * still-live lease is left alone; the fencing rename keeps even a misjudged
 * reclaim fail-safe (worst case: that upload restarts).
 */
const gcStage = <O extends Now | Readdir | Rm>(stageDir: string): Effect<O, void> =>
    now().step(t =>
        readdir(stageDir, {}).step(([k, v]) => {
            if (k === 'error') { return pure(undefined) }
            const expired = v.flatMap(d =>
                d.isFile && deadlineOf(d.name) < t ? [d.name] : [])
            return forEachStep((name: string) =>
                rm(join(stageDir, name)).step(() => pure(undefined)))(expired)
        }))

export type FileCas = Cas<FileCasOperation> & {
    url: (v: Vec) => string
}

/**
 * Builds a content-addressable storage facade from a SHA-2 implementation.
 */
export const fileCas = (sha2: Sha2) => (path: string): FileCas => {
    const storePrefix = join(path, prefix)
    const normalizedStorePrefix = normalize(storePrefix)
    const stageDir = join(storePrefix, stageRel)
    return {
        read: (hash: Vec): ListEffect<FileCasOperation, IoResult<Vec>> => {
            const p = join(path, toPath(hash))
            const loop = (offset: number): ListEffect<FileCasOperation, IoResult<Vec>> =>
                readBytes(p, offset, chunkBytes).step((result): ListEffect<FileCasOperation, IoResult<Vec>> => {
                    // A missing shard or read error is an explicit error item, never EOF.
                    if (result[0] === 'error') { return listEffectCons<FileCasOperation, IoResult<Vec>>(result, listEffectEnd()) }
                    const chunk = result[1]
                    // End the stream only on an empty read; every non-empty read — including a
                    // final short (`< CHUNK_BYTES`) chunk — is emitted as an `ok` item.
                    return length(chunk) === 0n
                        ? listEffectEnd()
                        : listEffectCons(ok(chunk), loop(offset + chunkBytes))
                })
            return loop(0)
        },
        // Lock-free staging upload (issues/cas/staging-lease.md): stream each chunk straight
        // to a `_stage/<deadline>-<rand>` file via `writeBytes` while folding it into the
        // running SHA-2 state — the payload never lives in memory as a whole. The lease is
        // renewed (rename to a fresh deadline) after every chunk; any error deletes the
        // partial file and fails. On end-of-stream the file is published to its hash-derived
        // shard path by a replace-`rename` (which also dedups/repairs a same-content shard),
        // and success is confirmed by a `stat` size check. GC of expired staging files is
        // piggy-backed at the start.
        write: <O1 extends Operation>(payload: ListEffect<O1, IoResult<Vec>>): Effect<O1 | FileCasOperation, IoResult<Vec>> => {
            // Publish the finished staging file to its content-addressed shard. The three
            // filesystem steps run best-effort with their results ignored; success is decided
            // afterward by observing the target's size (see staging-lease.md "Publish ignores
            // results and checks the end state").
            const publish = (state: Sha2State, offset: number, curPath: string): Effect<FileCasOperation, IoResult<Vec>> => {
                const hash = sha2.end(state)
                const rel = toPath(hash)
                const dst = join(path, rel)
                const dstDir = join(path, ...parse(rel).slice(0, -1))
                return mkdir(dstDir, { recursive: true })
                    .step(() => rename(curPath, dst))
                    .step(() => rm(curPath))
                    .step(() => stat(dst))
                    .step(st => pure(st[0] === 'ok' && st[1].size === offset ? ok(hash) : error('publish size mismatch')))
            }
            // Any streaming error fails closed: delete the partial file, return the error.
            const fail = (curPath: string, e: unknown): Effect<FileCasOperation, IoResult<Vec>> =>
                rm(curPath).step(() => pure(error(e)))
            return gcStage(stageDir).step(() =>
                random256.step(rnd => {
                    const rndStr = vecToCBase32(rnd)
                    const loop = (state: Sha2State, offset: number, curPath: string) =>
                        (stream: ListEffect<O1, IoResult<Vec>>): Effect<O1 | FileCasOperation, IoResult<Vec>> =>
                            stream.step((node): Effect<O1 | FileCasOperation, IoResult<Vec>> => {
                                if (node === undefined) { return publish(state, offset, curPath) }
                                const [item, rest] = node
                                if (item[0] === 'error') { return fail(curPath, item[1]) }
                                const chunk = item[1]
                                return writeBytes(curPath, offset, chunk).step(wb => {
                                    if (wb[0] === 'error') { return fail(curPath, wb[1]) }
                                    const newState = sha2.append(chunk)(state)
                                    const newOffset = offset + Number(length(chunk) / 8n)
                                    // Renew the lease: rename to a fresh deadline (keeps `delta` constant).
                                    return now().step(t => {
                                        const next = join(stageDir, stageName(t + leaseDelta, rndStr))
                                        return rename(curPath, next).step(([t, v]) =>
                                            t === 'error'
                                                ? fail(curPath, v)
                                                : loop(newState, newOffset, next)(rest))
                                    })
                                })
                            })
                    return mkdir(stageDir, { recursive: true }).step(() =>
                        now().step(t0 => {
                            const path0 = join(stageDir, stageName(t0 + leaseDelta, rndStr))
                            return createExclusive(path0).step(ce =>
                                ce[0] === 'error'
                                    ? pure(error(ce[1]))
                                    : loop(sha2.init, 0, path0)(payload))
                        }))
                }))
        },
        list: (): Effect<FileCasOperation, readonly Vec[]> =>
            // A fresh store has no `.cas` directory yet. Treat *only* that case as an
            // empty store, mirroring how `read` maps a missing shard to an error item.
            // A `.cas` that exists but cannot be read (permissions, corruption) is a
            // genuine storage error and is surfaced, not masked as "no hashes".
            access(storePrefix).step(a => {
                if (a[0] === 'error') {
                    if (isNotFound(a[1])) { return pure([] satisfies readonly Vec[]) }
                    throw a[1]
                }
                return readdir(storePrefix, { recursive: true })
                    .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
                        toOption(isFile
                            ? cBase32ToVec(normalize(parentPath).substring(normalizedStorePrefix.length).replaceAll('/', '') + name)
                            : null))))
            }),
        url: (hash: Vec) =>
            join(path, toPath(hash))
    }
}

/** 256-bit random `Vec` built from 8 sequential `randomInt` (32-bit) calls. */
const random256: Effect<RandomInt, Vec> =
    foldStep((_: number) => (acc: Vec): Effect<RandomInt, Vec> =>
        randomInt().step(r => pure(msb.concat(acc)(vec(32n)(BigInt(r)))))
    )(empty)([0, 1, 2, 3, 4, 5, 6, 7])

/** Streams any file at `filePath` in `<=128 KiB` chunks as a `ListEffect` of `ok` items. */
const streamFile = (filePath: string): ListEffect<ReadBytes, IoResult<Vec>> => {
    const loop = (offset: number): ListEffect<ReadBytes, IoResult<Vec>> =>
        readBytes(filePath, offset, chunkBytes).step((result): ListEffect<ReadBytes, IoResult<Vec>> => {
            if (result[0] === 'error') { return listEffectCons<ReadBytes, IoResult<Vec>>(result, listEffectEnd()) }
            const chunk = result[1]
            return length(chunk) === 0n
                ? listEffectEnd()
                : listEffectCons(ok(chunk), loop(offset + chunkBytes))
        })
    return loop(0)
}

/**
 * Streams the file at `path` through `cas.write`, returning the content hash.
 * Both the CLI `cas add` and the MCP `add` delegate to this; the MCP layer
 * additionally deletes the source file on success.
 */
export const casAddFile = <O extends Operation>(cas: Cas<O>) => (path: string): Effect<O | ReadBytes, IoResult<Vec>> =>
    // streamFile produces only ReadBytes effects. TypeScript can't prove ListEffect<ReadBytes,T>
    // ≤ ListEffect<O,T> for generic O (recursive type), but the cast is sound: every concrete
    // caller passes a Cas<O> where ReadBytes ⊆ O (e.g. FileCasOperation).
    cas.write(streamFile(path))

/**
 * Upload pipeline: streams `fileName` from `~/cas_upload/` through `casAddFile`,
 * then deletes the source on success. On failure the source is left in place so
 * the upload can be retried; `write` already cleans up its own partial staging file.
 */
export const casUpload = (home: string) => (fileName: string): Effect<FileCasOperation, IoResult<Vec>> => {
    const src = join(home, 'cas_upload', fileName)
    const c = fileCas(sha256)(home)
    return casAddFile(c)(src).step((result): Effect<FileCasOperation, IoResult<Vec>> => {
        if (result[0] === 'error') { return pure(result) }
        return rm(src).step(() => pure(result))
    })
}

