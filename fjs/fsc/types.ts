/**
 * Type-level API for `fjs/fsc/module.f.mjs`: the compiler's value model is
 * DataJS's, in `fjs/media/datajs/types.ts`; what is the compiler's own is the
 * effect it runs in.
 *
 * @module
 */

import type { Mkdir, ReadFile, ResolveFileModule, Write, WriteFile } from '../effects/node/types.ts'

/** The effect operations `compile` performs: file I/O and error output. */
export type _CompileOp = Mkdir | ReadFile | ResolveFileModule | WriteFile | Write
