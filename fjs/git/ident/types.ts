/**
 * Type-level API of an ident: who, and when.
 *
 * @module
 */

import type { Bytes } from '../types.ts'

/**
 * The value of an `author`, `committer` or `tagger` header, read: the name
 * without the SP that separates it from `<`, the email without its angle
 * brackets, the time as the seconds it counts, and the zone as it was
 * spelled, a sign and four digits. The name and the email are bytes, in
 * whatever encoding the object's author used; the zone is ASCII by the
 * format, so it is text.
 */
export type Ident = {
    readonly name: Bytes
    readonly email: Bytes
    readonly time: bigint
    readonly tz: string
}
