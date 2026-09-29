/**
 * Type-level API for `fjs/compiler/module.f.mjs`: the compiler's value model is
 * DataJS's, in `fjs/media/datajs/types.ts`; what is the compiler's own is the
 * effect it runs in.
 *
 * @module
 */

import type { All, Mkdir, ReadFile, Readdir, ResolveFileModule, Write, WriteFile } from '../effects/node/types.ts'

/**
 * The effect operations `compile` performs: file I/O and error output, and
 * the directory walk of the check it runs with no arguments.
 */
export type _CompileOp = All | Mkdir | ReadFile | Readdir | ResolveFileModule | WriteFile | Write

/** What the no-argument check counted: the `.f.js` files it read, and among them the ones the compiler refused. */
export type _Checked = {
    readonly checked: number
    readonly refused: number
}
