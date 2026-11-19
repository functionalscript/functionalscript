/**
 * Type-level API for `fjs/compiler/edag/module.f.js`: a module compiled before
 * its imports are read.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { AstImport } from '../ast/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'

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

/**
 * A module's full result and its export bindings. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly bindings: readonly (readonly [string, Exp])[]
}

/**
 * The modules linked so far, each under its identity: what one link hands
 * the next, so that a module two programs reach is read, parsed and lowered
 * once. `null` is none.
 */
export type _Linked = OrderedMap<_Resolved>
