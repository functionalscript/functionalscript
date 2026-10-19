/**
 * Types for the 32 KiB window of an inflater.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'

/**
 * The bytes a stream has produced, of which the last 32 KiB can be read back.
 * It is data and nothing else, so a window can be kept and compared.
 */
export type Window = {
    /** Full blocks, the oldest first. */
    readonly blocks: readonly (readonly number[])[]
    /** The bytes after the blocks, the newest first. */
    readonly tail: List<number>
    /** How many bytes `tail` holds, fewer than a block. */
    readonly tailLength: number
    /** How many bytes the stream has produced in all. */
    readonly length: number
}
