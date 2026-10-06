/**
 * Type-level API of the memo executor: what a program is run with.
 *
 * @module
 */

import type { Values } from '../value/types.ts'

/** Resolved module arguments; function frames belong to represented functions. */
export type Invocation = {
    readonly args: Values
}
