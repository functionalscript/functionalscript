/**
 * Type-level API for the compiler CLI and its file/effect boundary.
 * Module interpretation uses EDAG values; data outputs materialize their
 * selected result before serialization.
 *
 * @module
 */

import type { All, Mkdir, ReadWhole, Readdir, ResolveFileModule, Rm, Write, WriteBytes, WriteFile } from '../effects/node/types.ts'
import type { Effect } from '../effects/types.ts'
import type { Runtime } from '../edag/value/types.ts'
import type { SourceError } from './transpiler/types.ts'

/**
 * How a data output gets the runtime it interprets the module under: an
 * effect run only when a module is interpreted, never for a code output or
 * a JSON input, answering the runtime or none — `noRuntime`, for a caller
 * that compiles code outputs alone — or failing as a source does.
 */
export type RuntimeLoad = Effect<ReadWhole | ResolveFileModule, Runtime | undefined, SourceError>

/**
 * The effect operations `compile` performs: file I/O and error output, and
 * the directory walk of the check it runs with no arguments.
 */
export type _CompileOp = All | Mkdir | ReadWhole | Readdir | ResolveFileModule | Rm | WriteBytes | WriteFile | Write

/** What the no-argument check counted: the `.f.js` files it read, and among them the ones the compiler refused. */
export type _Checked = {
    readonly checked: number
    readonly refused: number
}
