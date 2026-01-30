/**
 * FunctionalScript Effects System
 * 
 * Main entry point for the effects system
 */

// Core Effects
export * as Effect from './effects/module.f.ts'

// Node.js Effects (pure constructors)
export * as NodeEffect from './effects/node/module.f.ts'

// Utilities
export * as Str from './string/module.f.ts'
export * as Arr from './array/module.f.ts'
export * as Path from './path/module.f.ts'

// Types
export type { Effect, Pure } from './effects/module.f.ts'
export type { 
    NodeEffect as NodeEffectType,
    ReadFile,
    WriteFile,
    FileExists,
    ReadDir,
    DeleteFile,
    MkDir,
    GetArgs,
    GetEnv,
    Exit,
    StdOut,
    StdErr,
    StdIn
} from './effects/node/module.f.ts'

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { Effect, NodeEffect } from '@functionalscript/effects'
 * 
 * // Create a pure effect
 * const program = Effect.flatMap((content: string) =>
 *     NodeEffect.stdOut(`File contains: ${content}\n`)
 * )(NodeEffect.readFile('input.txt'))
 * 
 * // Run it (impure)
 * import { runEffect } from '@functionalscript/effects/runner'
 * await runEffect(program)
 * ```
 */
