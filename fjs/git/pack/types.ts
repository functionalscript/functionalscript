/**
 * Types for a packfile's framing: what one entry says about itself.
 *
 * @module
 */

import type { ObjectType, Oid } from '../types.ts'

/**
 * A packfile's header: the version it is written in, and how many entries
 * follow it.
 */
export type PackHeader = {
    readonly version: number
    readonly count: number
}

/**
 * One entry's header, decoded: what it holds, how long the stream after it
 * inflates to, and where that stream begins.
 *
 * `dataAt` and `baseBack` are both relative to the entry, not to the pack,
 * because the decoder is handed the bytes from the entry onwards and has no
 * way to know where in the file they came from. A caller that knows the
 * entry's offset reads the base's as `offset - baseBack`.
 *
 * `size` is the inflated length of the stream this entry stores, which is the
 * object's length for the four object kinds and the *delta's* length for the
 * two delta kinds. The object a delta builds is longer than its delta and its
 * length is in the delta's own header, not here — measured on a pack where
 * the entry says 152 and the object is 427 bytes, which is also what
 * `git verify-pack -v` prints in its size column.
 */
export type Entry =
    | {
        readonly kind: 'object'
        readonly type: ObjectType
        readonly size: number
        readonly dataAt: number
    }
    | {
        readonly kind: 'ofsDelta'
        readonly size: number
        readonly baseBack: number
        readonly dataAt: number
    }
    | {
        readonly kind: 'refDelta'
        readonly size: number
        readonly baseId: Oid
        readonly dataAt: number
    }
