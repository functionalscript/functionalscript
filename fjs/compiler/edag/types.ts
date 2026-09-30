/**
 * Type-level API for `fjs/compiler/edag/module.f.mjs`: a module compiled before
 * its imports are read.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { AstImport } from '../ast/types.ts'

/**
 * A module as an EDAG over its imports: the imports in source order — each
 * its specifier, selected export name and whether it names a JSON module — and the computation
 * of what the module exports, in which import `i` selects its export from
 * the parameter slot `['.', ['args'], i]` as `['.', ['.', ['args'], i], name]`,
 * or is the bare slot when its import list is empty. A compiler's structure
 * and no part of EDAG — resolution replaces each import with the export it
 * selects from the imported module's own EDAG and the specifiers go with it,
 * so an EDAG never carries one.
 */
export type Unresolved = {
    readonly imports: readonly AstImport[]
    readonly edag: Exp
}
