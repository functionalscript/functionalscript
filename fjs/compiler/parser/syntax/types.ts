/**
 * Type-level API for `fjs/compiler/parser/syntax/module.f.mjs`: the syntax
 * tree its rewrite set builds — a node per value, a record per statement,
 * a module of them — and the alphabet it returns them in, `Out`. The input
 * alphabet is the grammar's, in `../grammar/types.ts`, and the error a
 * reader reports is the parser's, in `../types.ts`.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { Primitive } from '../../../media/datajs/types.ts'
import type { BinaryTag } from '../../ast/types.ts'
import type { DjsTokenWithMetadata } from '../../tokenizer/types.ts'

/**
 * A value as the mappings build it, before names are resolved: a primitive
 * converted from its token, a reference by the identifier token that spells
 * it — its name, and the position an error is anchored at — a property
 * access by the token its key is read from, a call by its arguments in the
 * order written, a negation by its operand, a function by its parameter
 * list as written, {@link ParameterList}, and its body, a block body by
 * its ordered, tagged statements, or a container of its items in the
 * order written.
 *
 * A call carries no token of its own. It held the `(` while an error was
 * anchored there — a call on a numeric literal, which the fold refused —
 * and that refusal is gone, `-1()` being the negation of `1()` as
 * JavaScript reads it.
 *
 * A `block` stands only as a function's body. Even `{ return v; }` keeps
 * its block and return; only lowering may give it the same executable body
 * as the expression `v`.
 *
 * A binary operator is `[tag, left, right]`, its tag the token itself —
 * Stage A of
 * [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md):
 * arithmetic, strict comparison, and bitwise — and Stage B's lazy `&&`,
 * `||` and `??` the same shape, laziness being no shape difference here
 * any more than in the EDAG. `-` alone is both a prefix and an infix, told
 * apart by arity exactly as `~`'s prefix and every infix are told apart
 * from each other, by tag; `**` is right-associative, folded by the
 * grammar rather than by this tree, so `2 ** 3 ** 2` is already
 * `['**', 2, ['**', 3, 2]]` here.
 *
 * The conditional is `['?:', condition, then, else]`, the one node of
 * three operands: always three, nothing else carrying its tag at another
 * arity, so no length decides it as `-`'s does. Nested conditionals
 * associate to the right, folded by the grammar as `**` is.
 */
export type Node =
    | readonly ['primitive', Primitive]
    | readonly ['ref', DjsTokenWithMetadata]
    | readonly ['.', Node, DjsTokenWithMetadata]
    | readonly ['()', Node, readonly Item[]]
    | readonly ['-', Node]
    | readonly ['~', Node]
    | readonly [BinaryTag, Node, Node]
    | readonly ['?:', Node, Node, Node]
    | readonly ['=>', ParameterList, Node]
    | Block
    | Container

/**
 * The block syntax: zero or more statements — `const` declarations and
 * guards, {@link BlockStatement} — followed by the one statement that ends
 * it, a `return` or a `throw` with its value. The grammar enforces this
 * order; a bare `return`, a bare `throw` and a statement after the last are
 * unsupported.
 */
export type Block = readonly ['block', readonly [...(readonly BlockStatement[]), readonly ['return' | 'throw', ValueStatement]]]

/** A block's statement before the one that ends it, tagged by its keyword: a `const`, or a guard. */
export type BlockStatement = readonly ['const', Const] | readonly ['if', If]

/**
 * A guard, `if (condition) block`: the token it begins with, its condition,
 * and its block, which ends in `return` or `throw` as every block does. It
 * records no `;`: a block statement ends at its `}`, and JavaScript inserts
 * no semicolon after one, so the statement after a guard may share its
 * line. The statements after the guard, up to and including the body's own
 * terminator, are what runs when the condition is falsy; the fold makes
 * the two arms of a conditional of them
 * ([spec: functions](../../../../spec/README.md#functions)).
 */
export type If = {
    readonly start: DjsTokenWithMetadata
    readonly condition: Node
    readonly block: Block
}

/**
 * An item of an array or of a call's arguments: a value, or a spread of
 * one, `...value`, which no node is — it stands only in an item list.
 */
export type Item = Node | readonly ['...', Node]

/** An array of its items, or an object of its members, each in the order written. */
export type Container =
    | readonly ['array', readonly Item[]]
    | readonly ['object', readonly Member[]]

/**
 * A member of an object: a property, {@link Entry}, or a spread of a
 * value, `...value`, which no node is — it stands only in a member list.
 */
export type Member = Entry | readonly ['...', Node]

/**
 * One member of an object: the token its key is read from, which anchors
 * the error a plain `__proto__` earns, the name that token spells, whether
 * it is the computed spelling `["a"]`, and the value.
 */
export type Entry = {
    readonly key: DjsTokenWithMetadata
    readonly name: string
    readonly computed: boolean
    readonly value: Node
}

/**
 * What every statement records of its ends: the token it begins with, and
 * whether a `;` ended it. A statement written without its `;` ends where
 * JavaScript inserts one — at the newline before the next statement, at
 * `}`, or at the end of input — and where the next statement shares its
 * line instead, its first token is the one JavaScript refuses; the fold
 * refuses it there, by that token's `newline`
 * ([spec: module structure](../../../../spec/README.md#module-structure)).
 */
export type Statement = {
    readonly start: DjsTokenWithMetadata
    readonly semicolon: boolean
}

/**
 * An `import`: the exported/local binding pairs, the module specifier, and
 * its attribute when it has one — the tokens its key and value are read
 * from, which anchor the error a key or value the language does not know
 * earns.
 */
export type Import = Statement & {
    readonly bindings: readonly ImportBinding[]
    readonly module: string
    readonly attribute: readonly [DjsTokenWithMetadata, DjsTokenWithMetadata] | null
}

/** The selected export and the token binding its local name. */
export type ImportBinding = {
    readonly name: string
    readonly local: DjsTokenWithMetadata
}

/**
 * A `const`: the token naming what it binds, and its value. It begins at
 * its `const`, or at the `export` before one a module exports.
 */
export type Const = Statement & {
    readonly name: DjsTokenWithMetadata
    readonly value: Node
}

/**
 * A statement that is a value: a block's `return` or `throw`, and a
 * module's `export default` or `throw`. `first` is the token the value
 * begins with — after `return` or `throw`, the one JavaScript refuses on a
 * new line, and the fold with it.
 */
export type ValueStatement = Statement & {
    readonly first: DjsTokenWithMetadata
    readonly value: Node
}

/** A module declaration, with its source export marker retained. */
export type ModuleConst = {
    readonly declaration: Const
    readonly exported: boolean
}

/**
 * A whole module as matched: declarations in order, and what ends it — an
 * optional final `export default`, or the `throw` that stands in its place,
 * never both. A module with neither exports its named `const`s alone.
 */
export type Module = {
    readonly imports: readonly Import[]
    readonly consts: readonly ModuleConst[]
    readonly exported: ValueStatement | null
    readonly thrown: ValueStatement | null
}

/**
 * Ordered fixed names and an optional final rest name, with source tokens.
 * An invalid expression in a binding position retains its opening token so
 * the binding pass reports the early error at the parameter list; an `=>`
 * on a line after the list, which JavaScript refuses, retains the `=>`.
 */
export type ParameterList =
    | { readonly invalid: DjsTokenWithMetadata }
    | { readonly arrow: DjsTokenWithMetadata }
    | readonly ParameterBinding[]

/** A parameter token and whether it binds the tail. */
export type ParameterBinding = { readonly name: DjsTokenWithMetadata, readonly rest: boolean }

/**
 * The output alphabet: what the mappings return, each tagged by the rule it
 * came from. The input alphabet's metadata is the token itself, which has
 * no `id`, and that is what tells the two apart at a position typed as
 * either.
 *
 * A value a `(` opened is `paren` rather than `value`, holding the same
 * node: a group is no node of its own, so this id is the one trace of the
 * parentheses, and what tells the parameter `(a)` from `((a))`, which
 * JavaScript refuses. Either carries the token it begins with, `first`,
 * which a `return` asks for its line.
 */
export type Out =
    | { readonly id: 'value', readonly node: Node, readonly first: DjsTokenWithMetadata }
    | { readonly id: 'paren', readonly node: Node, readonly first: DjsTokenWithMetadata }
    | { readonly id: 'parameters', readonly items: List<ParameterBinding> }
    | { readonly id: 'item', readonly item: Item }
    | { readonly id: 'values', readonly items: List<Item> }
    | { readonly id: 'property', readonly property: Entry }
    | { readonly id: 'member', readonly member: Member }
    | { readonly id: 'members', readonly items: List<Member> }
    | { readonly id: 'importBinding', readonly binding: ImportBinding }
    | { readonly id: 'importBindings', readonly items: List<ImportBinding> }
    | { readonly id: 'import', readonly statement: Import }
    | { readonly id: 'const', readonly statement: Const }
    | { readonly id: 'statement', readonly statement: BlockStatement }
    | { readonly id: 'last', readonly consts: List<ModuleConst>, readonly default: ValueStatement | null, readonly thrown: ValueStatement | null }
    | { readonly id: 'module', readonly module: Module }
