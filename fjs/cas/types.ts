/**
 * Types for content-addressable storage utilities.
 *
 * @module
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { Effect, Operation } from '../effects/types.ts'
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
    readonly write: <O1 extends Operation>(payload: List<O1, IoResult<Vec>>) => Effect<O | O1, IoResult<Vec>>
    /** Lists all stored content hashes. */
    readonly list: () => Effect<O, readonly Vec[]>
}

export type FileCas = Cas<FileCasOperation> & {
    url: (v: Vec) => string
}
