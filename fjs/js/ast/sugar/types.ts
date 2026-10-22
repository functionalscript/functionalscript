/**
 * Resolved source modules expanded into immutable FAST.
 * Source constructs are declared in source.ts; import identities come from
 * linking, independently of the values those imports hold.
 *
 * @module
 */

import type { BindingId, Block } from '../types.ts'

export type { ExpansionPlan, SourceBlock, SourceExit, SourceFunction, SourceImport, SourceLoop, SourceModule, SourceParameter, SourceStatement, SourceValue } from './source.ts'

/** Bindings supplied by the module boundary, followed by its computation. */
export type Module = {
    readonly parameters: readonly BindingId[]
    readonly body: Block
}
