/**
 * Type-level API for `fjs/fsc/edag/module.f.mjs`: a module compiled before
 * its imports are read.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'

/**
 * A module as an EDAG over its imports: the specifiers in source order, and
 * the computation of what the module exports, in which import `i` is the
 * parameter `['.', ['args'], i]`. A compiler's structure and no part of
 * EDAG — resolution replaces each parameter with the imported module's own
 * EDAG and the paths go with it, so an EDAG never carries one.
 */
export type Unresolved = {
    readonly imports: readonly string[]
    readonly edag: Exp
}
