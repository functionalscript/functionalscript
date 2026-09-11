/**
 * Type-level API of a tag.
 *
 * @module
 */

import type { Payload } from '../header/types.ts'
import type { ObjectType, Oid } from '../types.ts'

/**
 * A tag is its header list and its message, and nothing else: the shape a
 * commit has too, read by the same grammar. `object`, `type`, `tag` and
 * `tagger` are the well-known headers, and the functions of
 * `./module.f.mjs` read them off the list; a signature, where there is
 * one, is part of the message.
 */
export type Tag = Payload

/**
 * What a tag names and what it says that object is: the `object` header's
 * id and the `type` header's type, which a reader takes together since
 * Git's own parse takes them together.
 */
export type TagTarget = {
    readonly id: Oid
    readonly type: ObjectType
}
