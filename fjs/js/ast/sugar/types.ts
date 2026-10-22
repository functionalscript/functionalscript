/**
 * Existing admitted source modules expanded into normalized FAST.
 * Import identities are supplied by linking, independently of their values.
 *
 * @module
 */

import type { BindingId, Block } from '../types.ts'

/** Bindings supplied by the module boundary, followed by its computation. */
export type Module = {
    readonly parameters: readonly BindingId[]
    readonly body: Block
}
