/**
 * Type-level API of the header block a commit and a tag share.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Result } from '../../types/result/types.ts'
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
 * no empty line after it. The type cannot hold a writer to that: `null` is
 * already `List`'s empty, so `Nullable<Bytes>` is the same type as `Bytes`
 * and nothing checks which of the two a caller means. It is the meaning
 * that changed, and a caller that built a payload with `message: null`
 * meaning an empty message now writes an object one byte shorter, with
 * another id. Git reads such an object — its parse stops at a
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

/**
 * A value's parser: what the value means, or `null` where it means nothing
 * this field may hold.
 */
export type Parse<T> = (value: Bytes) => Nullable<T>

/**
 * One well-known field of a commit or a tag, read by position: its index,
 * key and two messages held once, and a view for each way a caller wants
 * a failure reported. Each view takes the parser, since one field is read
 * at any width by one caller and at the repository's by another.
 */
export type Field = {
    /** The field, or a panic: `missing` where the header is not there, `[bad, value]` where `parse` refuses its value. */
    readonly get: <T>(parse: Parse<T>) => (p: Payload) => T
    /** The field, or `null` where the header is not there or `parse` refuses its value: for an object nobody has vouched for. */
    readonly tryGet: <T>(parse: Parse<T>) => (p: Payload) => Nullable<T>
    /** The field, or the message for whichever of the two ways it is not there: for a `validate`. */
    readonly check: <T>(parse: Parse<T>) => (p: Payload) => Result<T, string>
}

/**
 * A field that may be absent but is never malformed, read by position:
 * `null` where the header is not there.
 */
export type OptionalField = {
    /** The field or `null`, or a panic of `[bad, value]` where `parse` refuses its value. */
    readonly get: <T>(parse: Parse<T>) => (p: Payload) => Nullable<T>
    /** `ok(null)` where the header is not there, the field where it is, and `bad` where `parse` refuses its value: for a `validate`. */
    readonly check: <T>(parse: Parse<T>) => (p: Payload) => Result<Nullable<T>, string>
}
