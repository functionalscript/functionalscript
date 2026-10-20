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
import type { AstCall, AstConst, AstFrameRef, AstItem, AstMember, AstModuleRef, AstRest, AstStatic, AstSelf, BinaryTag, UnaryTag } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'
import type { ParseError } from './types.ts'
import type { BindingElement, BindingProperty, BindingTarget, Block, Chain, Container, If, Item, Key, Let, LoopBlock, Node, Switch, While } from './syntax/types.ts'

/** A named parameter, `i` of the function whose body names it: what the body reads it as, the `i`th argument. */
export type _Parameter = readonly ['arg', number]

/** The names bound so far, each to the reference that names it: a module's import or entry, a function's rest array or one of its fixed parameters — or a slot of a function's frame, for a word its body has read from the scopes around it and remembers, so that a later read of it stops at the body and a `const` of it in the body is refused. */
export type _Env = OrderedMap<_Ref>

/** What a name resolves to where it is written: a name bound in its own scope, or a slot of the function's frame. */
export type _Ref = AstModuleRef | AstRest | _Parameter | AstFrameRef | AstSelf

/**
 * Where an entry of a pattern reads from: the source value itself, `null`;
 * a property of an earlier entry of the same pattern — its position among
 * the pattern's entries, and the key, a constant an access admits; or a
 * member of a namespace, the static function it is, which a
 * pattern over the namespace reads in place of a property of a value.
 */
export type _Source = null | readonly [number, string | number] | AstStatic

/**
 * One entry a checked pattern makes: what it reads, {@link _Source}, and
 * whether the entry is the spread of that read — an array pattern's own
 * entry, the array its elements are read from — or the read itself.
 */
export type _Read = {
    readonly source: _Source
    readonly spread: boolean
}

/**
 * A binding pattern the fold has checked, flat, as the lowering reads it:
 * its entries in order, each a read of the source or of an earlier entry,
 * and the names it binds, each by its token — the word is the token's, and
 * the token is what a refusal after the value is read is anchored at — with
 * the position of the entry holding its value. Nothing the language does
 * not read is in it: a rest element, a computed key and a value in a
 * binding position were refused making it.
 */
export type _Plan = {
    readonly reads: readonly _Read[]
    readonly names: readonly (readonly [DjsTokenWithMetadata, number])[]
}

/**
 * What the plan's walk has still to judge, in document order: a target
 * with the read it is the target of; an element of an array pattern, a
 * rest element refused where it stands; or a property of an object
 * pattern, its key judged before its target, with the entry its source
 * is read from — or the word `Object`, where the pattern is over the
 * namespace and the key names a member of it.
 */
export type _Pending =
    | { readonly target: BindingTarget, readonly source: _Source }
    | { readonly element: BindingElement, readonly source: _Source }
    | { readonly property: BindingProperty, readonly parent: number | DjsTokenWithMetadata }

/** What the plan's walk has still to judge, the next on top, as {@link _Stack} holds the frames of a resolution. */
export type _PendingStack = { readonly top: _Pending, readonly rest: _PendingStack } | null

/**
 * What a checked pattern makes of its source: the entries, in order, the
 * body being built takes, and the words bound, each to the entry holding
 * its value.
 */
export type _Lowered = {
    readonly entries: readonly AstConst[]
    readonly bound: readonly (readonly [string, AstModuleRef])[]
}

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
    /**
     * The word of a loop's variable, in the scope of the function the loop
     * lowers to and in its block's, and `null` in every other: a read of
     * the word from a function nested in either is refused unless the
     * function is called where it is written, since JavaScript's closure
     * would see the variable's last value where the function's capture
     * holds the round's ([spec: loops](../../../spec/control-flow/loops.md)).
     */
    readonly loop: string | null
    /**
     * The reads of loop variables from this scope, a function nested in
     * one loop or more, in document order: each variable's first read, by
     * its word and the refusal of the read. The first refusal is raised
     * when the function closes anywhere but as the callee of a call,
     * where its closure, called at once, sees the round's value as
     * JavaScript's does; closed as a callee, each read passes to the
     * scope around it, whose frame holds the variable for the function's,
     * out to the scope the variable is the loop's in.
     */
    readonly loopReads: readonly (readonly [word: string, refusal: ParseError])[]
}

/**
 * What a frame that works through its operands in order holds besides its
 * own payload: the position of the operand being evaluated, and what the
 * ones before it made, a list since appending to an array per operand
 * would copy the whole prefix each time. One operand makes one value, or,
 * for a statement of a block body, the entries it lowers to.
 */
export type _Counted<T> = {
    readonly index: number
    readonly done: List<T>
}

/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the items before it as the AST has them — an array's items,
 * or an object's members and spreads, {@link _Counted}. A member with a computed
 * key is evaluated in two rounds, the key's and then the value's: `key`
 * holds the key's value between them, boxed since `null` and `undefined`
 * are values too, and is `null` otherwise.
 */
export type _ContainerFrame = _Counted<AstItem | AstMember> & {
    readonly container: Container
    readonly key: readonly [AstConst] | null
}

/**
 * A call being built: `operands(call)[index]` is being evaluated, and `done`
 * holds the values before it — the callee first and then each argument, in
 * the order written, which is the order they are evaluated in.
 */
export type _CallFrame = _Counted<AstItem> & {
    readonly call: readonly ['()', Node, readonly Item[]]
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
 * in document order, {@link _Counted}. The chain
 * itself gives the shape the values are put back into once every part is
 * done.
 */
export type _ChainFrame = _Counted<AstConst> & {
    readonly chain: Chain
    readonly parts: readonly _ChainPart[]
}

/**
 * A function whose expression body is being evaluated: the entries its
 * parameter patterns made, {@link _Bound}, which the body's value follows
 * as the last entry. The scope around the body is the body's scope's
 * `outer`, which the body's captures update, so the frame holds nothing
 * else.
 */
export type _FunctionFrame = {
    readonly function: readonly AstConst[]
}

/**
 * A parameter list bound: the names the function's body begins with, the
 * function's `length`, the entries its patterns make — the reads of the
 * fixed arguments a pattern is sugar for, which the body's own entries
 * follow — none for a list of names alone, and the parameters from the
 * first default on, {@link _Late}, which land after those entries and
 * before the body's own.
 */
export type _Bound = {
    readonly names: _Env
    readonly count: number
    readonly entries: readonly AstConst[]
    readonly late: readonly _Late[]
}

/**
 * A parameter from the first default on, read from the rest array rather
 * than as an argument so that the function's `length` stops before it, as
 * JavaScript's does
 * ([default parameters](../../../spec/todo/3125-default-parameters.md)):
 * what it binds, checked with the whole list; its default as written, or
 * `null`; and its source — the read of the rest array at its position, or,
 * for the rest parameter after such parameters, the slice past them.
 */
export type _Late = {
    readonly plan: _Plan
    readonly init: Node | null
    readonly source: AstConst
}

/**
 * A function whose late parameters, {@link _Late}, are landing before its
 * body: `late[index]` is the one whose default is being evaluated, in the
 * function's own scope; `done` holds the entries before it,
 * {@link _Counted}, and `entries` how many; and `body` is the function's
 * body, entered once the last has landed.
 */
export type _LateFrame = _Counted<AstConst> & {
    readonly late: readonly _Late[]
    readonly entries: number
    readonly body: Node
}

/**
 * A function whose block body is being evaluated: the statements to work
 * through — `statements[index]` is the statement being evaluated and
 * `plan` what it binds, checked before its value was entered so that a
 * statement wrong in both halves answers for the half a reader meets first,
 * `null` under a guard's condition or the terminator, which bind nothing;
 * `done` holds the entries before it, {@link _Counted}, and `entries` how many, which is where the next statement's land —
 * a `const` of one name makes one entry, a pattern several.
 *
 * The body begins at `first`: `0` for a function's body, and for the
 * statements after a guard the position after it in the same list, which
 * the continuation shares with the body it continues rather than copies —
 * a body of many guards would otherwise copy its tail once per guard.
 */
export type _BodyFrame = _Counted<AstConst> & {
    /** The statements of the block, the grammar's list, the terminator last. */
    readonly statements: Block[1]
    readonly first: number
    readonly plan: _Plan | null
    readonly entries: number
}

/**
 * A loop's `let` whose initial value is being evaluated: the block body's
 * frame at the `let`, the statement, and the word it binds.
 */
export type _LetFrame = {
    readonly let: Let
    readonly body: _BodyFrame
    readonly word: string
}

/**
 * A loop whose condition or block is being evaluated, in the scope of the
 * function it lowers to: the `while`, the block body's frame at the
 * `let`, the word, the initial value resolved, and the condition once it
 * is — `null` while it is being evaluated, and the value while the block
 * is, as the body of a parameterless function of its own.
 */
export type _LoopFrame = {
    readonly loop: While
    readonly body: _BodyFrame
    readonly word: string
    readonly init: AstConst
    readonly condition: AstConst | null
}

/**
 * A loop whose function is being closed: the block body's frame at the
 * `let`, the word, and the initial value, for the call of the function
 * that is the entry the two statements make.
 */
export type _LoopCallFrame = {
    readonly called: While
    readonly body: _BodyFrame
    readonly word: string
    readonly init: AstConst
}

/**
 * A loop's block being evaluated as the body of a parameterless function:
 * `block[index]` is the statement being evaluated — a `const`, with the
 * plan of what it binds, checked before its value was entered, or the
 * assignment, which rebinds the loop's variable, `word`, and has no plan —
 * `done` the entries before it, and `entries` how many, which is where the
 * next statement's land.
 */
export type _LoopBodyFrame = _Counted<AstConst> & {
    readonly block: LoopBlock[1]
    readonly word: string
    readonly plan: _Plan | null
    readonly entries: number
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
 * A switch whose cases are being evaluated, in order, each label in the
 * scope of the block the switch stands in and each block the body of a
 * parameterless function called where it stands, as a guard's arms are:
 * `switch` is the statement, `body` the block body's frame at the switch
 * with the discriminant made its next entry, which `discriminant` reads;
 * the case at `index` is under way — its label at `label` being
 * evaluated, or its block once `label` has passed its labels, and
 * `condition` the `||` of the tests of the labels resolved so far, `null`
 * before the first; and `arms` holds the cases closed, newest first, each
 * its condition and the call of its block's function. Past the last case
 * the tail is under way, the `default` block or the statements after the
 * switch, an arm as the others are.
 */
export type _SwitchFrame = {
    readonly switch: Switch
    readonly body: _BodyFrame
    readonly discriminant: AstConst
    readonly index: number
    readonly label: number
    readonly condition: AstConst | null
    readonly arms: List<readonly [AstConst, AstCall]>
}

/**
 * A unary operator whose operand is being evaluated: its tag, which is all
 * the node adds to the operand's value. A conversion, `Number(x)` or
 * `String(x)`, is entered from a call rather than from a prefix, and
 * closes the same way.
 */
export type _UnaryFrame = { readonly unary: UnaryTag }

/**
 * An `instanceof` whose left operand is being evaluated: its right operand,
 * checked once the left returns so that a fault in the left is reported
 * first, and the operator token the refusal is reported at.
 */
export type _InstanceOfFrame = { readonly instanceof: Node, readonly at: DjsTokenWithMetadata }

/** A binary operator whose left operand is being evaluated: the tag, and the right operand to enter once it resolves. */
export type _BinaryLeftFrame = { readonly tag: BinaryTag, readonly right: Node }

/** A binary operator whose right operand is being evaluated: the tag, and the left operand already resolved. */
export type _BinaryRightFrame = { readonly tag: BinaryTag, readonly left: AstConst }

/**
 * A conditional being built: its operand at `index` — the condition, then
 * each arm — is being evaluated, and `done` holds the values before it,
 * {@link _Counted}.
 */
export type _ConditionalFrame = _Counted<AstConst> & {
    readonly conditional: readonly ['?:', Node, Node, Node]
}

/**
 * A comma being built: its operand at `index` is being evaluated, and
 * `done` holds the values before it, {@link _Counted}.
 */
export type _CommaFrame = _Counted<AstConst> & {
    readonly comma: readonly Node[]
}

export type _Frame =
    | _ContainerFrame
    | _CallFrame
    | _AccessFrame
    | _IndexFrame
    | _ChainFrame
    | _UnaryFrame
    | _InstanceOfFrame
    | _BinaryLeftFrame
    | _BinaryRightFrame
    | _ConditionalFrame
    | _CommaFrame
    | _FunctionFrame
    | _LateFrame
    | _BodyFrame
    | _GuardFrame
    | _SwitchFrame
    | _LetFrame
    | _LoopFrame
    | _LoopCallFrame
    | _LoopBodyFrame

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
