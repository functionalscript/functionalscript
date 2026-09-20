/**
 * Type-level API for `fjs/fsc/edag/module.f.mjs`: a module compiled before
 * its imports are read. Also carries the graph demo's, `./demo.f.mjs`: its
 * `_walk`/`_shapeOf` are exported as linkage, and a shipped declaration
 * pulls in whatever it names, whether or not the name means to be public —
 * so `_State` and `_Shape` live here, in the public declaration closure,
 * rather than in `./private.ts`, which the package never ships.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { AstImport } from '../ast/types.ts'
import type { Edge, Node } from '../../website/demo/graph/types.ts'

/**
 * A module as an EDAG over its imports: the imports in source order — each
 * its specifier and whether it names a JSON module — and the computation
 * of what the module exports, in which import `i` is the parameter
 * `['.', ['args'], i]`. A compiler's structure and no part of EDAG —
 * resolution replaces each parameter with the imported module's own EDAG
 * and the specifiers go with it, so an EDAG never carries one.
 */
export type Unresolved = {
    readonly imports: readonly AstImport[]
    readonly edag: Exp
}

/**
 * `demo.f.mjs`'s own walk state: every `Exp` reference seen so far and the
 * node id it was given, the {@link Node}s and {@link Edge}s built from them,
 * and the next id to hand out.
 */
export type _State = {
    readonly refs: readonly (readonly [object, number])[]
    readonly nodes: readonly Node[]
    readonly edges: readonly Edge[]
    readonly next: number
}

/** An `Exp`'s own label and its labeled children, as `_shapeOf` (`./demo.f.mjs`) reads them off before any node exists. */
export type _Shape = {
    readonly kind: string
    readonly label: string
    readonly children: readonly (readonly [string, Exp])[]
}
