/**
 * Type-level API of the header block a commit and a tag share.
 *
 * @module
 */

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
 */
export type Payload = {
    readonly headers: readonly Header[]
    readonly message: Bytes
}
