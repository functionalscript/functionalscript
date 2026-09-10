/**
 * Implementation-private types for the DJS parser: the token stream the
 * grammar reads, the nodes the rewrite set builds and the alphabet it
 * returns them in, and the state of the resolution above.
 *
 * @module
 */

import type { Meta, Unmapped } from '../../ebnf/ast/types.ts'
import type { TokenMetadata } from '../../js/tokenizer/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Primitive } from '../types.ts'
import type { AstConst, AstModuleRef } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { ParseError } from './types.ts'

/**
 * The ordinary token stream the grammar reads, with the tokenizer's one
 * physical end-of-input token split off.
 */
export type _TokenStream = {
    readonly tokens: readonly DjsTokenWithMetadata[]
    readonly eofMetadata: TokenMetadata
}

/**
 * A value as the mappings build it, before names are resolved: a primitive
 * converted from its token, a reference by the identifier token that spells
 * it — its name, and the position an error is anchored at — or a container
 * of its items in the order written.
 */
export type _Node =
    | readonly ['primitive', Primitive]
    | readonly ['ref', DjsTokenWithMetadata]
    | _Container

/** An array of its items, or an object of its members, each in the order written. */
export type _Container =
    | readonly ['array', readonly _Node[]]
    | readonly ['object', readonly _Member[]]

/**
 * One member of an object: the token its key is read from, which anchors
 * the error a plain `__proto__` earns, the name that token spells, whether
 * it is the computed spelling `["a"]`, and the value.
 */
export type _Member = {
    readonly key: DjsTokenWithMetadata
    readonly name: string
    readonly computed: boolean
    readonly value: _Node
}

/** An `import`: the token naming what it binds, and the module specifier. */
export type _Import = {
    readonly name: DjsTokenWithMetadata
    readonly module: string
}

/** A `const`: the token naming what it binds, and its value. */
export type _Const = {
    readonly name: DjsTokenWithMetadata
    readonly value: _Node
}

/** A whole module as matched: its statements in order, the export's value last. */
export type _Module = {
    readonly imports: readonly _Import[]
    readonly consts: readonly _Const[]
    readonly exported: _Node
}

/**
 * The output alphabet: what the mappings return, each tagged by the rule it
 * came from. The input alphabet's metadata is the token itself, which has
 * no `id`, and that is what tells the two apart at a position typed as
 * either.
 */
export type _Out =
    | { readonly id: 'value', readonly node: _Node }
    | { readonly id: 'values', readonly items: List<_Node> }
    | { readonly id: 'member', readonly member: _Member }
    | { readonly id: 'members', readonly items: List<_Member> }
    | { readonly id: 'import', readonly statement: _Import }
    | { readonly id: 'const', readonly statement: _Const }
    | { readonly id: 'export', readonly node: _Node }
    | { readonly id: 'module', readonly module: _Module }

/** A position a reader inspects: a symbol of either alphabet, or a node the machine built. */
export type _Leaf = Meta<DjsTokenWithMetadata | _Out> | readonly unknown[]

/**
 * A position holding an optional list, `[ items ]`: no round, or one
 * holding the list's node — which its mapping replaced by a symbol.
 */
export type _OptionalList = Unmapped<readonly [] | readonly [_Leaf]>

/**
 * The node of a list rule, `item t [ ',' t [ items ] ]`, typed by shape as
 * `Unmapped` describes: the item, its trivia, and optionally the comma, its
 * trivia and the rest of the list. One reader serves both lists.
 */
export type _ListNode = readonly [
    _Leaf,
    unknown,
    Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, _OptionalList]>]>,
]

/** The names bound so far, each to the reference that names it. */
export type _Env = OrderedMap<AstModuleRef>

/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the values of the items before it — a list, since appending
 * to an array per item would copy the whole prefix each time.
 */
export type _Frame = {
    readonly container: _Container
    readonly index: number
    readonly done: List<AstConst>
}

/** The containers suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step = readonly ['enter', _Node] | Result<AstConst, ParseError>

export type _State = readonly [stack: _Stack, step: _Step]
