/**
 * Implementation-private types for the DJS parser: the state of the
 * resolution — the scope a node is resolved in, and the frames suspended
 * around it. The token stream and the positions a reader inspects are the
 * reader's, in `./reader/private.ts`.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { AstArgs, AstConst, AstFrameRef, AstModuleRef, AstParameter, BinaryTag } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { Block, Container, Node } from './reader/types.ts'
import type { ParseError } from './types.ts'

/** The names bound so far, each to the reference that names it: a module's import or entry, a function's arguments, or one of its named parameters. */
export type _Env = OrderedMap<AstModuleRef | AstArgs | AstParameter>

/** What a name resolves to where it is written: a name bound in its own scope, or a slot of the function's frame. */
export type _Ref = AstModuleRef | AstArgs | AstParameter | AstFrameRef

/**
 * The scope a node is resolved in: the names it binds itself, and — in a
 * function's body — what the body has captured so far from the scope
 * around it, `outer`, each the reference that names the value there, in
 * the order the body first named them, and the words it read from there,
 * which a `const` of the body may not then bind. The module's own scope
 * has no `outer` and captures nothing.
 *
 * `parameters` is how many named parameters the scope's function declares
 * — its `length`, `0` for the module and for a rest parameter or none —
 * carried to where the function is closed over its body.
 *
 * The captures grow while the body is resolved, and so do those of every
 * function around it that a capture passes through, so the whole chain is
 * the state, rebuilt where a capture lands.
 */
export type _Scope = {
    readonly names: _Env
    readonly captures: readonly _Ref[]
    readonly read: readonly string[]
    readonly outer: _Scope | null
    readonly parameters: number
}


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

/**
 * A function whose body is being evaluated. It carries nothing: the scope
 * around the body is the body's scope's `outer`, which the body's captures
 * update, and one is enough to tell the frame from the others.
 */
export type _FunctionFrame = {
    readonly function: true
}

/**
 * A function whose block body is being evaluated: the statements to work
 * through — `statements[index]` is the statement being evaluated and `word`
 * the name it binds, taken before its value was entered so that a statement
 * wrong in both halves answers for the half a reader meets first; `done`
 * holds the entries before it, a list for the reason a container's is.
 *
 * The current statement's tag distinguishes a declaration's initializer
 * from the final return value, where `word` names nothing.
 */
export type _BodyFrame = {
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

/** The frames suspended, the scope the node being evaluated stands in, and what to do next. */
export type _State = readonly [stack: _Stack, scope: _Scope, step: _Step]
