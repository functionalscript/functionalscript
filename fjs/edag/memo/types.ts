/**
 * Type-level API of the memo executor: what a program is run with.
 *
 * @module
 */

import type { Runtime, Values } from '../value/types.ts'

/** Resolved module arguments; function frames belong to represented functions. */
export type Invocation = {
    readonly args: Values
    /**
     * The runtime whose bodies answer the member functions the dispatcher
     * has no native implementation of (`../operations/types.ts`), handed on
     * to every function the module calls.
     */
    readonly runtime?: Runtime | undefined
}
