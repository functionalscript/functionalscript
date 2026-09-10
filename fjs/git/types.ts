/**
 * Types shared by the Git object readers: what an object is made of.
 *
 * @module
 */

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
