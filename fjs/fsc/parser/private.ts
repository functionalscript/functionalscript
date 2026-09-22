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
import type { AstArgs, AstConst, AstModuleRef, BinaryTag } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { Block, Container, Node, Out, ParseError } from './types.ts'

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
 * The node of a function's parameter list: no round, or one holding
 * `... t id t`, the parameter's token at the third position. The parameter
 * is an `identifierName`, a choice of one symbol per word, so its token is
 * one level in, under the alternative the word matched — as a `const`'s
 * name is.
 */
export type _ParameterNode = Unmapped<readonly [] | readonly [Unmapped<readonly [unknown, unknown, Unmapped<readonly [unknown, _Leaf]>, unknown]>]>

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

/**
 * A call being built: `operands(call)[index]` is being evaluated, and `done`
 * holds the values before it — the callee first and then each argument, in
 * the order written, which is the order they are evaluated in.
 */
export type _CallFrame = {
    readonly call: readonly ['()', Node, readonly Node[]]
    readonly index: number
    readonly done: List<AstConst>
}

/**
 * An access whose base is being evaluated: the token its key is read from,
 * and whether the access is the callee of a call — a method call, whose
 * key is checked against the member functions a module may not call rather
 * than the properties it may not read.
 */
export type _AccessFrame = {
    readonly key: DjsTokenWithMetadata
    readonly method: boolean
}

/** A function whose body is being evaluated: the names bound outside it, to return to. */
export type _FunctionFrame = {
    readonly outer: _Env
    readonly captures: readonly AstConst[]
    readonly names: readonly string[]
}

/**
 * A function whose block body is being evaluated: the names bound outside
 * it, as {@link _FunctionFrame} holds them, and the statements to work
 * through — `statements[index]` is the statement being evaluated and `word`
 * the name it binds, taken before its value was entered so that a statement
 * wrong in both halves answers for the half a reader meets first; `done`
 * holds the entries before it, a list for the reason a container's is.
 *
 * The current statement's tag distinguishes a declaration's initializer
 * from the final return value, where `word` names nothing.
 */
export type _BodyFrame = {
    readonly outer: _Env
    readonly captures: readonly AstConst[]
    readonly names: readonly string[]
    readonly statements: Block[1]
    readonly index: number
    readonly word: string
    readonly done: List<AstConst>
}

/**
 * A negation whose operand is being evaluated. It carries nothing: the
 * node is the operand's value negated, and one is enough to tell the frame
 * from the others.
 */
export type _NegFrame = { readonly neg: true }

/**
 * A bitwise not whose operand is being evaluated. It carries nothing, for
 * the same reason {@link _NegFrame} does not.
 */
export type _BitnotFrame = { readonly bitnot: true }

/** A binary operator whose left operand is being evaluated: the tag, and the right operand to enter once it resolves. */
export type _BinaryLeftFrame = { readonly tag: BinaryTag, readonly right: Node }

/** A binary operator whose right operand is being evaluated: the tag, and the left operand already resolved. */
export type _BinaryRightFrame = { readonly tag: BinaryTag, readonly left: AstConst }

/**
 * A conditional being built: its operand at `index` — the condition, then
 * each arm — is being evaluated, and `done` holds the values before it, a
 * list for the reason a container's is.
 */
export type _ConditionalFrame = {
    readonly conditional: readonly ['?:', Node, Node, Node]
    readonly index: number
    readonly done: List<AstConst>
}

export type _Frame =
    | _ContainerFrame
    | _CallFrame
    | _AccessFrame
    | _NegFrame
    | _BitnotFrame
    | _BinaryLeftFrame
    | _BinaryRightFrame
    | _ConditionalFrame
    | _FunctionFrame
    | _BodyFrame

/** The containers, calls, accesses, operators, conditionals and functions suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step = readonly ['enter', Node] | Result<AstConst, ParseError>

/** The frames suspended, the names bound where the node being evaluated stands, and what to do next. */
export type _State = readonly [stack: _Stack, env: _Env, step: _Step]
