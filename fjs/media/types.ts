/**
 * Type-level API for `fjs/media/module.f.mjs`: the `DialectEntry` registry
 * shape `detect` and `dialectEntry` share with every registered dialect.
 *
 * @module
 */

import type { Unknown } from '../types/rtti/ts/types.ts'

/**
 * One registered dialect: the name it tags itself with, and a predicate
 * deciding whether an already-parsed value is one of its blobs.
 *
 * `match` takes rtti's `Unknown` — the encoding-neutral one, admitting
 * `bigint` and `undefined` — not `fjs/media/json`'s JSON-only `Unknown`, so an
 * entry stays usable by a future non-JSON detector over the same dialects.
 *
 * The type is deliberately not opaque: a caller may write the struct by hand.
 * The list is that caller's own declaration of what it wants recognized,
 * passed to its own `detect` call, so a fabricated entry mislabels only that
 * caller's results — there is no trust boundary between a caller and entries it
 * writes itself. The boundary that does exist, untrusted blob content, is on
 * the other side of `match`.
 */
export type DialectEntry = {
    readonly dialect: string
    readonly match: (_: Unknown) => boolean
}
