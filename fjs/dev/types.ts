/**
 * Types for indexing modules and loading FunctionalScript files.
 *
 * @module
 */

import type { StringMap } from '../types/object/types.ts'
import type { Result } from '../types/result/types.ts'
import type { IoChannel } from '../effects/types.ts'
import type { Access, All, Import, Readdir } from '../effects/node/types.ts'

export type Module = {
    readonly proof?: unknown
    readonly [k: string]: unknown
}

/**
 * One discovered file: its exports, or why it would not load. A module that
 * throws while it is evaluated — a module-level `assert` that fails — is an
 * `error` here rather than a failure of the whole map.
 */
export type LoadedModule = Result<Module, IoChannel>

export type ModuleMap = StringMap<LoadedModule>

/** The effect operations required to discover and load a module map. */
export type LoadModuleOperations = Access | Import | All | Readdir
