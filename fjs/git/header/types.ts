/**
 * Type-level API of the header block a commit and a tag share.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Bytes } from '../types.ts'

/**
 * One header, byte for byte: its key, any byte but SP and LF, and its
 * value, with a continuation line joined to the line before it by the LF
 * that separated them and its leading SP dropped. The writer puts both
 * back, so a value round-trips whatever it holds.
 */
export type Header = readonly [key: Bytes, value: Bytes]

/**
 * The payload of a commit or a tag: every header as read, in order, and
 * the message — everything after the empty line, to the end of the object.
 * One representation and nothing beside it, so that a writer has one
 * source and the well-known fields are functions over the headers.
 *
 * `message` is `null` where the object ended at its last header's LF, with
 * no empty line after it. Git reads such an object — its parse stops at a
 * line that is no header, and the end of the input is one of those — and
 * none of Git's own writers makes one, so it comes from a hand-made object
 * or another tool. It is not the same object as one with an empty line and
 * an empty message: those are two byte strings and so two ids, and a reader
 * that gave them one value could not write either back. Hence `null` rather
 * than an empty list.
 */
export type Payload = {
    readonly headers: readonly Header[]
    readonly message: Nullable<Bytes>
}
