/**
 * Implementation-private types for the DJS parser.
 */

import type { CodePointMeta } from '../../bnf/descent/types.ts'
import type { Ast } from '../../bnf/matcher/types.ts'
import type { TokenMetadata } from '../../js/tokenizer/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { AstConst, AstModuleRef } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { ParseError } from './types.ts'

/**
 * The ordinary token stream a BNF parser layer consumes, with the tokenizer's
 * one physical end-of-input token split off.
 */
export type _TokenStream = {
    readonly tokens: readonly DjsTokenWithMetadata[]
    readonly eofMetadata: TokenMetadata
}

/** A node of the matched module's AST, its leaves carrying the tokens. */
export type _Node = Ast<CodePointMeta<DjsTokenWithMetadata>>

/**
 * A fold in progress: the names bound so far, the module specifiers and the
 * body collected so far, and the first error if one has been met.
 *
 * The error rides in the state rather than wrapping every step in a `Result`,
 * so a step reads as one expression instead of a nested match. Once set it is
 * never replaced, which is what makes the reported error the *first* one.
 */
export type _FoldState = {
    readonly refs: OrderedMap<AstModuleRef>
    readonly modules: readonly string[]
    readonly consts: readonly AstConst[]
    readonly error: ParseError | null
}

/**
 * A frame of `foldValue`'s explicit stack: the container being built, the
 * element nodes still to read, and what has been built so far.
 *
 * `done` is a `List` rather than an array because a frame gains one element at a
 * time: appending to an array per element would copy the whole prefix each time,
 * which is what makes the obvious spelling quadratic in an array's length.
 */
export type _FoldFrame = {
    readonly items: readonly _Node[]
    readonly index: number
    readonly array: List<AstConst>
    readonly object: OrderedMap<AstConst>
    readonly keys: readonly(readonly[string, boolean])[]
    readonly isArray: boolean
}
