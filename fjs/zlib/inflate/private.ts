/**
 * Types the inflater keeps to itself.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Window } from '../window/types.ts'
import type { State } from './types.ts'

/** A step taken: the state after it, and the output it made, if any. */
export type Taken = {
    readonly state: State
    readonly chunk: Nullable<Vec>
}

/** A symbol of a block of codes read: the window after it, where it ended, and whether it was the end of the block. */
export type Item = {
    readonly window: Window
    readonly pos: number
    readonly end: boolean
}
