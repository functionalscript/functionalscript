/**
 * Type-level API of the memo executor: what a program is run with.
 *
 * @module
 */

/** The captured frame and the arguments an invocation runs over. */
export type Invocation = {
    readonly frame: unknown
    readonly args: readonly unknown[]
}
