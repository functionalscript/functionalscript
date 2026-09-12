/**
 * Operator types specialized to `bigint`.
 *
 * @module
 */

import type {
    Unary as OpUnary,
    Reduce as OpReduce,
} from '../function/operator/types.ts'

/**
 * Type representing a unary operation on `bigint`.
 */
export type Unary = OpUnary<bigint, bigint>

/**
 * Type representing a reduction operation on `bigint` values.
 */
export type Reduce = OpReduce<bigint>

/**
 * One implementation's measurement on this module's demo page, or why there is
 * not one.
 *
 * **Public because the demo's export is.** `demo.f.mjs` exports `demo`, and its
 * type names these, so they are in the package's declaration closure whether or
 * not anyone outside imports them. A `private.ts` is for types that stay out of
 * it — the published package ships every `.d.ts` but those — and a declaration
 * referring to one no consumer received does not type-check.
 */
export type DemoRow = {
    readonly name: string
    /** Milliseconds, or `null` where `note` says what happened instead. */
    readonly ms: number | null
    /** What happened instead of a measurement, or `null` when one was taken. */
    readonly note: string | null
}

/**
 * What the reader typed on the demo page, and what came of measuring it.
 *
 * `size` is the text rather than a number, so the field shows exactly what was
 * typed — including something that is not a number at all, which `note` then
 * explains. Parsing at the moment of measuring is what lets a half-typed value
 * exist without the page objecting to every keystroke.
 */
export type DemoState = {
    readonly kind: 'idle' | 'done'
    readonly size: string
    readonly rows: readonly DemoRow[]
    /** Why there are no rows, or `null` when there are. */
    readonly note: string | null
}
