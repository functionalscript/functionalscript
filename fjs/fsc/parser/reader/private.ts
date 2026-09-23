/**
 * Implementation-private types for the DJS syntax reader: the token stream
 * the grammar reads and the positions a reader inspects. The nodes the
 * rewrite set builds are public, in `./types.ts`, since the set is.
 *
 * @module
 */

import type { Meta, Unmapped } from '../../../ebnf/ast/types.ts'
import type { TokenMetadata } from '../../../ebnf/lib/js/types.ts'
import type { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
import type { Out } from './types.ts'

export type _TokenStream = {
    readonly tokens: readonly DjsTokenWithMetadata[]
    readonly eofMetadata: TokenMetadata
}

/** A position a reader inspects: a symbol of either alphabet, or a node the machine built. */
export type _Leaf = Meta<DjsTokenWithMetadata | Out> | readonly unknown[]

/**
 * The `[thing, accesses]` pair every base branch — primitive, reference,
 * array, object — opens with: `unary`'s own shape, and `value`/`body`'s
 * before their trailing tail lists. `accesses` is a position of its own,
 * unmapped where it is read.
 */
export type _BaseNode = Unmapped<readonly [unknown, _Leaf]>

/**
 * `**`'s own optional round, `'**' t unary`: no round, or one holding the
 * operand at the third position — the symbol itself, not a variant, since
 * `**` is the one spelling.
 */
export type _PowTailNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, _Leaf]>]>

/**
 * One round of a binary layer's repeat, `op t unary tail*`: the matched
 * operator's own variant at the first position, the operand at the third,
 * and every layer below this one's own tail list trailing it — as many
 * positions as the layer is deep, `multiplicative`'s own round carrying
 * none, each unmapped where {@link applyTail} reads it.
 */
export type _TailRound = Unmapped<readonly [Unmapped<readonly [string, _Leaf]>, unknown, _Leaf, ..._Leaf[]]>

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
 * `? t value : t value`, the arms at the third and sixth positions, each
 * a value its mapping replaced by a symbol.
 */
export type _ConditionalNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, _Leaf, unknown, unknown, _Leaf]>]>

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

/**
 * The node of a choice of one symbol per word — `identifier` or
 * `identifierName` — where a name stands: the token one level in, under
 * the alternative the word matched, as a `const`'s name is read.
 */
export type _NameNode = Unmapped<readonly [unknown, _Leaf]>

/**
 * The node of `afterName` where it stands past a `)` in `named`'s cover
 * branch, after the tail lists a spread position leaves untyped: the
 * branch taken, `arrow` holding `=> t body` and `value` holding
 * `n access* powTail tail`, each unmapped where `afterNamed` reads it.
 */
export type _AfterNameNode = Unmapped<
    | readonly ['arrow', Unmapped<readonly [_Leaf, unknown, _Leaf]>]
    | readonly ['value', Unmapped<readonly [unknown, Unmapped<readonly _AccessNode[]>, _PowTailNode, ..._Leaf[]]>]>

/** The node of one access, `[tag, branch]`: the branch holds the key's token at its third position, under the name's own alternative for `.name`. */
export type _AccessNode = Unmapped<readonly [string, unknown]>

/**
 * The branch of a property access, `. t name t` or `[ t key t ] t`: the
 * token its key is read from at the third position, under the identifier's
 * or the constant's own alternative.
 */
export type _KeyBranch = Unmapped<readonly [unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, ...unknown[]]>

/**
 * The branch of a call, `( t [ items(value) ] ) t`: the `(` an error against
 * the call is anchored at, and its arguments at the third position, the same
 * optional list an array holds.
 */
export type _CallBranch = Unmapped<readonly [_Leaf, unknown, _OptionalList, ...unknown[]]>

/**
 * The node of an import's optional attribute: no round, or one holding
 * `with t { t identifier t : t string t } t`, the key at the fifth position
 * and the value's token at the ninth. The key is an `identifier`, a choice
 * of one symbol per word, so its token is one level in, under the
 * alternative the word matched — as a `const`'s name is.
 */
export type _AttributeNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, unknown, unknown, unknown, _Leaf, ...unknown[]]>]>
