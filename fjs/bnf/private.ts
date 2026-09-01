/**
 * Implementation-private types for the AST renderer in `./testlib.f.mjs`.
 *
 * @module
 */

import type { Ast } from './matcher/types.ts'

/**
 * The metadata-bearing leaf shared by both parser backends.
 */
export type _Leaf = readonly [number, unknown]

export type _AstNode = Ast<_Leaf>

export type _AstChild = _AstNode | _Leaf

/**
 * The renderer's accumulator: the parts already rendered, and the run of
 * consumed code points being accumulated as one quoted string.
 */
export type _Parts = {
    readonly parts: readonly string[]
    readonly text: string
}
