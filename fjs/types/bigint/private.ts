/**
 * Types for this module's demo. Nothing outside this directory names them: a
 * demo is a page, not an API.
 *
 * @module
 */

/** One implementation's measurement, or why there is not one. */
export type _Row = {
    readonly name: string
    /** Milliseconds, or `null` where `note` says what happened instead. */
    readonly ms: number | null
    /** What happened instead of a measurement, or `null` when one was taken. */
    readonly note: string | null
}

/**
 * Before a reader asks, there is nothing to show; afterwards there is a row
 * per implementation. The rows are kept in both, so a second run replaces a
 * table rather than clearing the page first.
 */
export type _State = {
    readonly kind: 'idle' | 'done'
    readonly rows: readonly _Row[]
}
