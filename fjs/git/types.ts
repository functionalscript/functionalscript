/**
 * Types shared by the Git object readers: what an object is made of.
 *
 * @module
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { List } from '../types/list/types.ts'

/**
 * A field the format leaves unbounded — a message, a header, a name — as
 * a list of bytes, one per item. A `Vec` holds 128 KiB, so it is the type
 * of a field the format fixes the width of, an object id, and of nothing
 * else.
 */
export type Bytes = List<number>

/** The four kinds of object, as the envelope names them. */
export type ObjectType = 'blob' | 'tree' | 'commit' | 'tag'

/**
 * An object id as the raw bytes it is, 20 of them in a SHA-1 repository
 * and 32 in a SHA-256 one: the one field the format fixes the width of,
 * and so the one held as a `Vec`.
 */
export type Oid = Vec

/**
 * The width of an object id in bytes, a property of the repository and
 * not of any object: `20` for SHA-1, `32` for SHA-256. A number, since
 * `times` takes its bound as one.
 */
export type OidBytes = 20 | 32
