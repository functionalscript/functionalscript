/**
 * Implementation-private types of `toArray` without a host iterator.
 *
 * @module
 */

/**
 * The arrays `toArray` has collected and not yet joined, the latest on top
 * and each shorter than the one beneath it; `null` when there is none.
 */
export type _Chunks<T> = {
    readonly first: readonly T[]
    readonly tail: _Chunks<T>
} | null
