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
 * What the reader typed, and what came of measuring it.
 *
 * `size` is the text rather than a number, so the field shows exactly what was
 * typed — including something that is not a number at all, which `note` then
 * explains. Parsing at the moment of measuring is what lets a half-typed value
 * exist without the page objecting to every keystroke.
 */
export type _State = {
    readonly kind: 'idle' | 'done'
    readonly size: string
    readonly rows: readonly _Row[]
    /** Why there are no rows, or `null` when there are. */
    readonly note: string | null
}
