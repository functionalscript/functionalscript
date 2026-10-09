/**
 * Type-level API for the compiler CLI and its file/effect boundary.
 * Module interpretation uses EDAG values; data outputs materialize their
 * selected result before serialization.
 *
 * @module
 */

import type { All, Mkdir, ReadWhole, Readdir, ResolveFileModule, Rm, Write, WriteBytes, WriteFile } from '../effects/node/types.ts'

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
