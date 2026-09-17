/**
 * Implementation-private types for the DJS parser: the token stream the
 * grammar reads, the positions a reader inspects, and the state of the
 * resolution. The nodes the rewrite set builds are public, in
 * `./types.ts`, since the set is.
 *
 * @module
 */

import type { Ast, Meta, Unmapped } from '../../ebnf/ast/types.ts'
import type { TokenMetadata } from '../../ebnf/lib/js/types.ts'
import type { Rule } from '../../ebnf/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { AstArgs, AstConst, AstModuleRef } from '../ast/types.ts'
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
 * A position under `./grammar/module.f.mjs`'s `ladder` — `Value`/`Body`'s
 * `expr`, widened there to `Rule` since the nine-layer ladder is too deep a
 * type to spell out layer by layer. Unlike {@link _Leaf}, `unmapped` on an
 * `_Expr` yields another `_Expr` at every position under it (`Ast<Rule,…>`
 * resolves to itself recursively, the way `Ast<R,…>` does for any `R`), so a
 * reader may call `unmapped` once per grammar level it destructures, exactly
 * as it does against a precisely-typed node — see `README.md`'s "The tree is
 * `Ast<R, I, O>`". What it does not carry, `Value`/`Body`'s own precise
 * typing does past that boundary: a leaf's tag narrows only to `string`,
 * never to the operator it names, which is why `../module.f.mjs`'s ladder
 * readers close each with a targeted `Node`/`Op…Tag` cast once they have
 * walked the shape the grammar is known, by construction, to hold there.
 */
export type _Expr = Ast<Rule, DjsTokenWithMetadata, Out>

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

/**
 * The node of an import's optional attribute: no round, or one holding
 * `with t { t identifier t : t string t } t`, the key at the fifth position
 * and the value's token at the ninth. The key is an `identifier`, a choice
 * of one symbol per word, so its token is one level in, under the
 * alternative the word matched — as a `const`'s name is.
 */
export type _AttributeNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, unknown, unknown, unknown, _Leaf, ...unknown[]]>]>

/** The names bound so far, each to the reference that names it: a module's import or entry, or a function's arguments. */
export type _Env = OrderedMap<AstModuleRef | AstArgs>


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

/** A function whose body is being evaluated: the names bound outside it, to return to. */
export type _FunctionFrame = {
    readonly outer: _Env
}

export type _Frame = _ContainerFrame | _AccessFrame | _FunctionFrame

/** The containers, accesses and functions suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step = readonly ['enter', Node] | Result<AstConst, ParseError>

/** The frames suspended, the names bound where the node being evaluated stands, and what to do next. */
export type _State = readonly [stack: _Stack, env: _Env, step: _Step]
