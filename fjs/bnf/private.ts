/**
 * Implementation-private types for the AST renderer in `./testlib.f.mjs`.
 */

import type { Ast } from './matcher/types.ts'

/**
 * The leaf of either backend's AST: `bnf/ll1` keeps the code point alone and
 * `bnf/descent` pairs it with metadata, so a renderer that takes both is
 * generic over exactly this.
 *
 * `showAst`'s exported declaration writes this union inline so the public
 * declaration does not depend on this private module.
 */
export type _Leaf = number | readonly [number, unknown]

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
