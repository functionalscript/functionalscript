/**
 * Implementation-private types for the module parser: the state of the
 * resolution — the names in scope, and the frames suspended around the
 * node being evaluated. The syntax tree the resolution walks is
 * `./syntax/types.ts`'s.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { AstConst, AstFrameRef, AstItem, AstModuleRef, AstRest, AstSelf, BinaryTag } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { ParseError } from './types.ts'
import type { Block, Chain, Container, If, Item, Key, Node } from './syntax/types.ts'

/** A named parameter, `i` of the function whose body names it: what the body reads it as, the `i`th argument. */
export type _Parameter = readonly ['arg', number]

/** The intrinsic `Object` namespace a word was read as, where nothing binds it: no value a module can name, and a binding that refuses a `const` of the word after the read, which in JavaScript the read would have named. */
export type _Intrinsic = readonly ['intrinsic']

/** The names bound so far, each to the reference that names it: a module's import or entry, a function's rest array or one of its fixed parameters — or a slot of a function's frame, for a word its body has read from the scopes around it and remembers, so that a later read of it stops at the body and a `const` of it in the body is refused — or the intrinsic, for `Object` read as the namespace the `entry` helper names where nothing binds the word, remembered in every scope out to the module's so that a `const` of the word after the read is refused the same way. */
export type _Env = OrderedMap<_Ref | _Intrinsic>

/** What a name resolves to where it is written: a name bound in its own scope, or a slot of the function's frame. */
export type _Ref = AstModuleRef | AstRest | _Parameter | AstFrameRef | AstSelf

/**
 * The scope a node is resolved in: the names it binds itself — its own,
 * and the words it has read from the scope around it, each bound to the
 * slot of its frame that holds the value, so that a read of one stops at
 * the body and a `const` of one is refused — and, in a function's body,
 * what the body has captured so far from the scope around it, `outer`,
 * each the reference that names the value there, in the order the body
 * first named them. The module's own scope has no `outer` and captures
 * nothing.
 *
 * The captures grow while the body is resolved, and so do those of every
 * function around it that a capture passes through, so the whole chain is
 * the state, rebuilt where a capture lands.
 *
 * The statements after a guard are resolved as the body of a function of
 * their own — the one the fold makes of them, {@link _GuardFrame} — but
 * JavaScript reads them in the block the guard stands in, so the names
 * of that block, `enclosing` — one environment per body the block was
 * continued from, a list so that each continuation adds one to the ones
 * before it rather than copying them — are theirs not to bind: a `const`
 * twice in one block is a syntax error there, and a `const` of a word the
 * block has already read from outside is the capture-shadowing the fold
 * refuses. A function's own body, a guard's block and the module enclose
 * nothing.
 */
export type _Scope = {
    readonly names: _Env
    /** The `length` of the function whose body this is: its named parameters counted, `0` for a rest parameter, none, or the module. */
    readonly count: number
    readonly captures: readonly _Ref[]
    readonly enclosing: List<_Env>
    readonly outer: _Scope | null
    /** The word the function whose body this is was the whole value of a `const` under, or `null`: what the body reads as the function itself, where nothing nearer binds the word. */
    readonly self: string | null
}


/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the values of the items before it — a list, since appending
 * to an array per item would copy the whole prefix each time.
 */
export type _ContainerFrame = {
    readonly container: Container
    readonly index: number
    readonly done: List<AstItem>
}

/**
 * A call being built: `operands(call)[index]` is being evaluated, and `done`
 * holds the values before it — the callee first and then each argument, in
 * the order written, which is the order they are evaluated in.
 */
export type _CallFrame = {
    readonly call: readonly ['()', Node, readonly Item[]]
    readonly index: number
    readonly done: List<AstItem>
}

/**
 * An access whose base is being evaluated: its key — the token a constant
 * is read from, or a computed key, entered once the base has its value,
 * {@link _IndexFrame} — and whether the access is the callee of a call — a
 * method call, whose constant key is checked against the member functions
 * a module may not call rather than the properties it may not read.
 */
export type _AccessFrame = {
    readonly key: Key
    readonly method: boolean
}

/**
 * An access whose base has its value and whose computed key, the
 * conversion `Number(i)`, is being evaluated: the base, for the access the
 * key's value closes.
 */
export type _IndexFrame = {
    readonly indexed: AstConst
}

/**
 * One operand of a chain in document order: a value to enter — its base
 * or callee, or an argument's operand — or a key, with whether a call step
 * follows it: a constant to judge, a method call's key being checked
 * against the member functions a module may not call rather than the
 * properties it may not read, as an access's is, or a computed key, entered
 * as a value is once it is the conversion.
 */
export type _ChainPart =
    | { readonly value: Node }
    | { readonly key: Key, readonly method: boolean }

/**
 * A chain being built: `parts[index]` is being evaluated or judged, and
 * `done` holds what came before it — each value's, and each key's name,
 * in document order — a list, for the reason a container's is. The chain
 * itself gives the shape the values are put back into once every part is
 * done.
 */
export type _ChainFrame = {
    readonly chain: Chain
    readonly parts: readonly _ChainPart[]
    readonly index: number
    readonly done: List<AstConst>
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
 * The body begins at `first`: `0` for a function's body, and for the
 * statements after a guard the position after it in the same list, which
 * the continuation shares with the body it continues rather than copies —
 * a body of many guards would otherwise copy its tail once per guard. The
 * entry a statement makes is numbered from `first`.
 *
 * The current statement's tag distinguishes a declaration's initializer
 * from the final return value, where `word` names nothing.
 */
export type _BodyFrame = {
    /** The statements of the block, the grammar's list, the terminator last. */
    readonly statements: Block[1]
    readonly first: number
    readonly index: number
    readonly word: string
    readonly done: List<AstConst>
}

/**
 * A guard whose arms are being evaluated, each the body of a parameterless
 * function called where it stands — the call the lowering inlines — so
 * that a `const` of either arm is the arm's alone: `body` is the block
 * body's frame at the guard, `condition` the guard's condition resolved,
 * and `then` the function of the guard's block once it is closed, `null`
 * while that block is being evaluated and the value once the statements
 * after the guard are.
 */
export type _GuardFrame = {
    readonly guard: If
    readonly body: _BodyFrame
    readonly condition: AstConst
    readonly then: AstConst | null
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

/**
 * A logical not whose operand is being evaluated. It carries nothing, for
 * the same reason {@link _NegFrame} does not.
 */
export type _NotFrame = { readonly not: true }

/**
 * A `typeof` whose operand is being evaluated. It carries nothing, for the
 * same reason {@link _NegFrame} does not.
 */
export type _TypeofFrame = { readonly typeof: true }

/**
 * An `instanceof` whose left operand is being evaluated: its right operand,
 * checked once the left returns so that a fault in the left is reported
 * first, and the operator token the refusal is reported at.
 */
export type _InstanceOfFrame = { readonly instanceof: Node, readonly at: DjsTokenWithMetadata }

/**
 * A `Number` conversion whose operand is being evaluated: the word, so
 * that the frame is the node's tag and a second conversion joins it rather
 * than adding a frame.
 */
export type _ConversionFrame = { readonly conversion: 'Number' }

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
    | _IndexFrame
    | _ChainFrame
    | _NegFrame
    | _BitnotFrame
    | _NotFrame
    | _TypeofFrame
    | _InstanceOfFrame
    | _ConversionFrame
    | _BinaryLeftFrame
    | _BinaryRightFrame
    | _ConditionalFrame
    | _FunctionFrame
    | _BodyFrame
    | _GuardFrame

/** The containers, calls, accesses, operators, conditionals and functions suspended around the node being evaluated, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: evaluate a node, or hand a value — or the error — to the frame on top. */
export type _Step =
    | readonly ['enter', Node]
    /** A `const`'s value to enter, with the word the `const` binds: a function is entered under it as its `self`. */
    | readonly ['define', Node, string]
    | Result<AstConst, ParseError>

/** The frames suspended, the scope the node being evaluated stands in, and what to do next. */
export type _State = readonly [stack: _Stack, scope: _Scope, step: _Step]
