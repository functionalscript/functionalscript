/**
 * Implementation-private types for the DJS parser: the token stream the
 * grammar reads, the positions a reader inspects, and the state of the
 * resolution. The nodes the rewrite set builds are public, in
 * `./types.ts`, since the set is.
 *
 * @module
 */

import type { Meta, Unmapped } from '../../ebnf/ast/types.ts'
import type { TokenMetadata } from '../../ebnf/lib/js/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { AstConst, AstModuleRef } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { Container, Node, Out, ParseError } from './types.ts'

/**
 * The ordinary token stream the grammar reads, with the tokenizer's one
 * physical end-of-input token split off.
 */
export type _TokenStream = {
    readonly tokens: readonly DjsTokenWithMetadata[]
    readonly eofMetadata: TokenMetadata
}

/** A position a reader inspects: a symbol of either alphabet, or a node the machine built. */
export type _Leaf = Meta<DjsTokenWithMetadata | Out> | readonly unknown[]

/**
 * A position holding an optional list, `[ items ]`: no round, or one
 * holding the list's node — which its mapping replaced by a symbol.
 */
export type _OptionalList = Unmapped<readonly [] | readonly [_Leaf]>

/**
 * The node of a list rule, `item [ ',' t [ items ] ]`, typed by shape as
 * `Unmapped` describes: the item, and optionally the comma, its trivia and
 * the rest of the list. One reader serves both lists.
 */
export type _ListNode = readonly [
    _Leaf,
    Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, _OptionalList]>]>,
]

/** The node of one access, `[tag, branch]`: the branch holds the key's token at its third position, under the name's own alternative for `.name`. */
export type _AccessNode = Unmapped<readonly [string, Unmapped<readonly [unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, ...unknown[]]>]>

/** The names bound so far, each to the reference that names it. */
export type _Env = OrderedMap<AstModuleRef>


/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the values of the items before it — a list, since appending
 * to an array per item would copy the whole prefix each time.
 */
export type _ContainerFrame = {
    readonly container: Container
    readonly index: number
    readonly done: List<AstConst>
}

/** An access whose base is being evaluated: the token its key is read from. */
export type _AccessFrame = {
    readonly key: DjsTokenWithMetadata
}

export type _Frame = _ContainerFrame | _AccessFrame

/** The containers suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step = readonly ['enter', Node] | Result<AstConst, ParseError>

export type _State = readonly [stack: _Stack, step: _Step]
