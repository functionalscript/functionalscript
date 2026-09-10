/**
 * Type-level API of a tag.
 *
 * @module
 */

import type { Payload } from '../header/types.ts'

/**
 * A tag is its header list and its message, and nothing else: the shape a
 * commit has too, read by the same grammar. `object`, `type`, `tag` and
 * `tagger` are the well-known headers, and the functions of
 * `./module.f.mjs` read them off the list; a signature, where there is
 * one, is part of the message.
 */
export type Tag = Payload
