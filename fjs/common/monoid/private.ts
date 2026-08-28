/**
 * Implementation-private types for the monoid fold.
 */

/**
 * A run of `size` already-combined elements. Runs live on a stack whose top is
 * the most recent — and smallest — run, so `rest` holds everything to the left
 * of `value`.
 */
export type _Run<T> = {
    readonly size: number
    readonly value: T
    readonly rest: _Stack<T>
}

/** A stack of runs, `null` when empty. */
export type _Stack<T> = _Run<T> | null
