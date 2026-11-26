/**
 * What the inline pass carries through a body.
 *
 * @module
 */

import type { CheckedFn, Term } from '../types.ts'

/**
 * How a body's names read where the pass writes it: at the top of a
 * function or a constant, each as it is; in a copy of a function's body at
 * a call, each with the call's own prefix, but a parameter that the call
 * passes in place.
 */
export type _Names = {
    /** What a `get` of a local reads. */
    readonly local: (name: string) => Term
    /** The name that a local or a label takes where it is bound. */
    readonly bind: (name: string) => string
    /** The labels of the loops of the body, whose parameters a `br` names too. */
    readonly loops: readonly string[]
}

/** What a function's body is written with: the functions whose calls the pass inlines, and the names that it binds already. */
export type _Pass = {
    /** A function whose body the pass writes in place of a call of it, typed, or `null` for one whose calls it keeps. */
    readonly inlined: (name: string) => CheckedFn | null
    /** The names of locals and labels that the function or the constant binds already. */
    readonly taken: readonly string[]
}

/** A term that the pass wrote, and the number of the next prefix. */
export type _Written = readonly [Term, number]
