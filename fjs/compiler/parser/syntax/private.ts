/**
 * Implementation-private types for the syntax reader: the token stream the
 * grammar reads, and the positions a reader inspects. The nodes the
 * rewrite set builds are public, in `./types.ts`, since the set is.
 *
 * @module
 */

import type { Meta, Unmapped } from '../../../ebnf/ast/types.ts'
import type { TokenMetadata } from '../../../ebnf/lib/js/types.ts'
import type { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
import type { Item, Key, Out } from './types.ts'

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
 * `**`'s own optional round, `'**' unary`: no round, or one holding the
 * operand at the second position — the symbol itself, not a variant, since
 * `**` is the one spelling.
 */
export type _PowTailNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, _Leaf]>]>

/**
 * One round of a binary layer's repeat, `op unary tail*`: the matched
 * operator's own variant at the first position, the operand at the second,
 * and every layer below this one's own tail list trailing it — as many
 * positions as the layer is deep, `multiplicative`'s own round carrying
 * none, each unmapped where {@link applyTail} reads it.
 */
export type _TailRound = Unmapped<readonly [Unmapped<readonly [string, _Leaf]>, _Leaf, ..._Leaf[]]>

/**
 * The node of the short-circuit level, `circuitTail`: no round, or one
 * holding the branch the first operator committed to — its tag, and under
 * it that operator's own round, a {@link _TailRound}, followed by the
 * repeat lists the chain continues with, each unmapped where
 * {@link applyCircuit} reads it.
 */
export type _CircuitNode = Unmapped<readonly [] | readonly [Unmapped<readonly [string, Unmapped<readonly [_TailRound, ..._Leaf[]]>]>]>

/**
 * The node of the conditional, `conditionalTail`: no round, or one holding
 * `? value : value`, the arms at the second and fourth positions, each
 * a value its mapping replaced by a symbol.
 */
export type _ConditionalNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, _Leaf, unknown, _Leaf]>]>

/** The node of a statement's end, `[ ';' ]`: no round, or the one holding the `;`. */
export type _EndNode = Unmapped<readonly [] | readonly [unknown]>

/**
 * A position holding an optional list, `[ items ]`: no round, or one
 * holding the list's node — which its mapping replaced by a symbol.
 */
export type _OptionalList = Unmapped<readonly [] | readonly [_Leaf]>

/**
 * The node of a list rule, `item [ ',' [ items ] ]`, typed by shape as
 * `Unmapped` describes: the item, and optionally the comma and the rest of
 * the list. One reader serves both lists.
 */
export type _ListNode = readonly [
    _Leaf,
    Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, _OptionalList]>]>,
]

/**
 * The node of a function's parameter list: no round, or one holding
 * `... id`, the parameter's token at the second position. The parameter
 * is an `identifierName`, a choice of one symbol per word, so its token is
 * one level in, under the alternative the word matched — as a `const`'s
 * name is.
 */
export type _ParameterNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, Unmapped<readonly [unknown, _Leaf]>]>]>

/** The node of one named parameter after the first, `id`: the name's token one level in, under the alternative its word matched, as a `const`'s name is. */
export type _NameNode = Unmapped<readonly [unknown, _Leaf]>

/** The node of one access, `[tag, branch]`: the branch holds the key's token at its third position, under the name's own alternative for `.name`. */
export type _AccessNode = Unmapped<readonly [string, unknown]>

/**
 * The branch of a property access, `. name`: the token its key is read
 * from at the second position, under the identifier's own alternative.
 */
export type _KeyBranch = Unmapped<readonly [unknown, Unmapped<readonly [unknown, _Leaf]>, ...unknown[]]>

/**
 * The branch of an optional step, `?. optionalStep`: the step's own choice
 * at the second position — `[tag, branch]`, the branch a {@link _CallBranch}
 * for a call, an {@link _IndexBranch} for an index, and for a property the
 * name's own alternative, a {@link _NameNode}.
 */
export type _OptionalBranch = Unmapped<readonly [unknown, _Leaf]>

/** The branch of an index step, `[ value ]`: what the index rule's mapping returned, at the second position. */
export type _IndexBranch = Unmapped<readonly [unknown, _Leaf, unknown]>

/**
 * One step as `stepOf` reads it: whether `?.` guards it, and the token its
 * key is read from or the items of its call, one of the two.
 */
export type _StepRead = {
    readonly optional: boolean
    readonly key: Key | null
    readonly items: readonly Item[] | null
}

/**
 * The two bits a chain carries, `fjs/edag/README.md`'s Chains: whether a
 * receiver is live, and whether a short-circuit region is open.
 */
export type _ChainState = {
    readonly receiver: boolean
    readonly open: boolean
}

/**
 * The branch of a call, `( [ items(value) ] )`: the `(` an error against
 * the call is anchored at, and its arguments at the second position, the
 * same optional list an array holds.
 */
export type _CallBranch = Unmapped<readonly [_Leaf, _OptionalList, ...unknown[]]>

/**
 * The node of an import's optional attribute: no round, or one holding
 * `with { identifier : string }`, the key at the third position and the
 * value's token at the fifth. The key is an `identifier`, a choice of one
 * symbol per word, so its token is one level in, under the alternative
 * the word matched — as a `const`'s name is.
 */
export type _AttributeNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, unknown, _Leaf, ...unknown[]]>]>
