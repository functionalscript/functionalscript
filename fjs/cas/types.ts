/**
 * Types for content-addressable storage utilities.
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { Effect, Operation } from '../effects/types.ts'
import type { List } from '../effects/list/types.ts'
import type { Access, CreateExclusive, IoChannel, Mkdir, Now, RandomInt, ReadBytes, Readdir, Rename, Rm, Stat, WriteBytes } from '../effects/node/types.ts'

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
     * Streams the content for `hash` out in `<=128 KiB` chunks.
     *
     * A missing shard or an I/O error **fails the stream** rather than ending
     * it, so it can never be mistaken for end-of-stream. That distinction used
     * to be a rule this comment had to state, with an `ok(chunk)`/`error` item
     * union that every consumer kept apart by hand; it is now the difference
     * between an `error` cell and an `ok(undefined)` one, which nothing can
     * confuse.
     */
    readonly read: (hash: Vec) => List<O, Vec, IoChannel>
    /**
     * Consumes a chunk stream, hashing incrementally, and returns the content
     * address. A stream that fails aborts the upload with that failure.
     */
    readonly write: <O1 extends Operation>(payload: List<O1, Vec, IoChannel>) => Effect<O | O1, Vec, IoChannel>
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
    readonly list: () => Effect<O, readonly Vec[], IoChannel>
}

export type FileCas = Cas<FileCasOperation> & {
    url: (v: Vec) => string
}
