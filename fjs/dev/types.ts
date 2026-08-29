/**
 * Types for indexing modules and loading FunctionalScript files.
 *
 * @module
 */

import type { StringMap } from '../types/object/types.ts'
import type { Access, All, Import, Readdir } from '../effects/node/types.ts'

export type Module = {
    readonly proof?: unknown
    readonly [k: string]: unknown
}

export type ModuleMap = StringMap<Module>

/** The effect operations required to discover and load a module map. */
export type LoadModuleOperations = Access | Import | All | Readdir
