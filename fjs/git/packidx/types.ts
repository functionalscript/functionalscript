/**
 * Types for a pack index, the lookup from an object id to where its entry
 * sits in the pack beside it.
 *
 * @module
 */

import type { Oid } from '../types.ts'

/**
 * A decoded `.idx`: the ids the pack holds and where each one's entry
 * begins, plus the checksum that ties the two files together.
 *
 * `ids` is ascending, which is the order the file stores them in and the
 * order a lookup depends on. `offsets` runs parallel to it, so `offsets[i]`
 * is where `ids[i]`'s entry begins in the pack — the file stores the two as
 * separate tables in version 2 and interleaved in version 1, and both are
 * read into this one shape.
 *
 * The version itself is not here. It says how the bytes were laid out and
 * nothing about what they mean, so a consumer that kept it would only be
 * able to misuse it.
 */
export type Idx = {
    readonly ids: readonly Oid[]
    readonly offsets: readonly number[]
    readonly packChecksum: Oid
}
