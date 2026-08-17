/**
 * Types for content-addressable storage utilities.
 *
 * @module
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { RawEffect, Operation } from '../effects/types.ts'
import type { List } from '../effects/list/types.ts'
import type { IoResult, Mkdir, Now, RandomInt, ReadBytes, Readdir, Rename, Rm, CreateExclusive, WriteBytes, Access, Stat } from '../effects/node/types.ts'

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
    readonly read: (hash: Vec) => List<O, IoResult<Vec>>
    /**
     * Consumes a chunk stream — each item `ok(chunk)` or `error` — hashing incrementally,
     * and returns the content address. An error item aborts the upload.
     */
    readonly write: <O1 extends Operation>(payload: List<O1, IoResult<Vec>>) => RawEffect<O | O1, IoResult<Vec>>
    /**
     * Lists all stored content hashes.
     *
     * Fallible like its siblings: walking the store is IO, and a store that
     * cannot be walked must be distinguishable from one that is empty. An
     * absent store *is* empty and answers `ok([])` — that is the fresh-store
     * case, not a failure — but a directory that exists and cannot be read is
     * an error, and returning it is what lets a caller say so instead of
     * reporting no content.
     */
    readonly list: () => RawEffect<O, IoResult<readonly Vec[]>>
}

export type FileCas = Cas<FileCasOperation> & {
    url: (v: Vec) => string
}
