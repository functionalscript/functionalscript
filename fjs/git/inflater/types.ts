/**
 * Types for reading a zlib stream for Git.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'
import type { List } from '../../types/list/types.ts'
import type { State } from '../../zlib/inflate/types.ts'

/**
 * A stream being read: where the inflater is, and the chunks it has made so
 * far, the newest first, which is how a list is appended to without copying.
 */
export type Progress = {
    readonly state: State
    readonly made: List<Vec>
}

/** Why a stream was refused, as the channel carries it: the code the host's `inflate` gave, and a message. */
export type Refusal = {
    readonly code: string
    readonly message: string
}
