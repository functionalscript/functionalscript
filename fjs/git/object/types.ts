/**
 * Type-level API of the loose object envelope.
 *
 * @module
 */

import type { Bytes, ObjectType } from '../types.ts'

/**
 * An object read past its envelope: its type, and the bytes after the NUL,
 * as many as the envelope's size claimed.
 */
export type Envelope = {
    readonly type: ObjectType
    readonly payload: Bytes
}
