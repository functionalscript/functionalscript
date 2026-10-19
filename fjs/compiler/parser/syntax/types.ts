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
    | readonly ['.', Node, Key]
    | readonly ['()', Node, readonly Item[]]
    | Chain
    | readonly ['-', Node]
    | readonly ['~', Node]
    | readonly ['!', Node]
    | readonly ['typeof', Node]
    // Template interpolation converts independently of any source binding.
    | readonly ['String', Node]
    | readonly [BinaryTag, Node, Node]
    // `instanceof` with its operator token: the grammar reads its right
    // operand as any relational operator's, and the fold admits one value
    // there, a reference to `Array`, refusing the rest at the operator —
    // the one token every spelling of the right side shares
    | readonly ['instanceof', Node, Node, DjsTokenWithMetadata]
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
export type Block = readonly ['block', readonly [...(readonly BlockStatement[]), BlockEnd]]

/**
 * The statement a block ends with, tagged by its keyword: a `return` or a
 * `throw` with its value, or a switch with a `default`, {@link Switch},
 * which the grammar lets nothing follow.
 */
export type BlockEnd = readonly ['return' | 'throw', ValueStatement] | readonly ['switch', Switch]

/** A block's statement before the one that ends it, tagged by its keyword: a `const`, a guard, a loop's `let`, its `while`, or a switch without a `default`, {@link Switch}, the statements after it in the list being what runs when no label matched. */
export type BlockStatement = readonly ['const', Const] | readonly ['if', If] | readonly ['let', Let] | readonly ['while', While] | readonly ['switch', Switch]

/**
 * A switch, `switch (discriminant) { case a: case b: block … default: block }`:
 * the token it begins with, its discriminant, its cases, one or more, and
 * its `default` block, `null` where it has none. It records no `;`, as a
 * guard does not. With a `default` it is the statement its block ends
 * with; without one, the statements after it, up to and including the
 * block's own end, are what runs when no label matched — the grammar reads
 * them as the switch's tail, and the reader puts them after it in the
 * block's one list, so that the fold reads them as it reads the
 * statements after a guard ([spec: switch](../../../../spec/control-flow/switch.md)).
 */
export type Switch = {
    readonly start: DjsTokenWithMetadata
    readonly discriminant: Node
    readonly cases: readonly Case[]
    readonly default: Block | null
}

/** A case of a switch: its labels, one or more values, each the `case` of a `case value:`, and its block, which ends in `return` or `throw` as every block does. */
export type Case = {
    readonly labels: readonly Node[]
    readonly block: Block
}

/**
 * A loop, `while (condition) block`: the token it begins with, its
 * condition, and its block, {@link LoopBlock}. It records no `;`, as a
 * guard does not. The `let` before it, a {@link Let},
 * declares the variable the block assigns; the fold reads the two
 * statements as one loop and refuses either alone
 * ([spec: loops](../../../../spec/control-flow/loops.md)).
 */
export type While = {
    readonly start: DjsTokenWithMetadata
    readonly condition: Node
    readonly block: LoopBlock
}

/** A loop's block: its statements in order, `const`s and assignments, and no terminator. */
export type LoopBlock = readonly ['loop', readonly LoopStatement[]]

/** A loop block's statement, tagged: a `const`, or an assignment. */
export type LoopStatement = readonly ['const', Const] | readonly ['assign', Assignment]

/**
 * An assignment, `name = value`: the token naming the variable, which the
 * statement begins at, and its value. The fold admits the loop's own
 * variable and refuses every other name.
 */
export type Assignment = Statement & {
    readonly name: DjsTokenWithMetadata
    readonly value: Node
}

/**
 * A guard, `if (condition) block`: the token it begins with, its condition,
 * and its block, which ends in `return` or `throw` as every block does. It
 * records no `;`: a block statement ends at its `}`, and JavaScript inserts
 * no semicolon after one, so the statement after a guard may share its
 * line. The statements after the guard, up to and including the body's own
 * terminator, are what runs when the condition is falsy; the fold makes
 * the two arms of a conditional of them
 * ([spec: functions](../../../../spec/functions/README.md)).
 */
export type If = {
    readonly start: DjsTokenWithMetadata
    readonly condition: Node
    readonly block: Block
}

/**
 * An access's key: the token a constant key is read from — the name after
 * `.`, or a string or a number literal in brackets, whose refusal is
 * anchored there — or a computed key, {@link ComputedKey}.
 */
export type Key = DjsTokenWithMetadata | ComputedKey

/**
 * Any other value in brackets, `a[i]`, and the token it begins with, which
 * its refusal is anchored at: the fold admits the conversion `Number(i)`
 * alone ([spec: property access](../../../../spec/property-access/README.md)).
 */
export type ComputedKey = readonly ['[]', Node, DjsTokenWithMetadata]

/**
 * An item of an array or of a call's arguments: a value, or a spread of
 * one, `...value`, which no node is — it stands only in an item list.
 */
export type Item = Node | readonly ['...', Node]

/**
 * An optional chain, in the EDAG's own shapes (`fjs/edag/README.md`,
 * Chains), its keys tokens as an access's is: a guarded access, `a?.b`, a
 * guarded call, `a?.(…)`, or an access whose first step is a guarded call,
 * `a.b?.(…)` — each with the steps the chain goes on with, {@link Step},
 * where it has any. The reader folds the steps written after a `?.` into
 * one of these until a group closes the region, and a group is where the
 * shapes differ from a nested access: `a?.b.c` is one chain and `(a?.b).c`
 * an access over one.
 */
export type Chain =
    | readonly ['?.', Node, Key]
    | readonly ['?.', Node, Key, Step]
    | readonly ['?.()', Node, readonly Item[]]
    | readonly ['?.()', Node, readonly Item[], Step]
    | readonly ['.', Node, Key, OptionalCall]

/**
 * One step a chain goes on with, and the steps after it: a property by its
 * key's token, a call by its items, a guarded call, or the call a group's
 * closing parenthesis put outside the region, `(a?.b)(…)`, after which
 * nothing continues the chain.
 */
export type Step =
    | readonly ['|.', Key]
    | readonly ['|.', Key, Step]
    | readonly ['|()', readonly Item[]]
    | readonly ['|()', readonly Item[], Step]
    | OptionalCall
    | readonly ['|!()', readonly Item[]]

/** A guarded call step, `?.(…)`, and the steps after it. */
export type OptionalCall =
    | readonly ['|?.()', readonly Item[]]
    | readonly ['|?.()', readonly Item[], Step]

/** An array of its items, or an object of its entries, each in the order written. */
export type Container =
    | readonly ['array', readonly Item[]]
    | readonly ['object', readonly Entry[]]

/**
 * An entry of an object: a member, {@link Member}, or a spread of a
 * value, `...value`, which no node is — it stands only in an entry list.
 */
export type Entry = Member | readonly ['...', Node]

/**
 * A member of an object, `key: value`: the token its key begins with,
 * which anchors the error a plain `__proto__` earns, the key by its
 * spelling, and the value. A constant key is the name its token spells,
 * {@link ConstantMember}; a computed key, `[k]`, is the node between the
 * brackets, {@link ComputedMember}, evaluated before the value as
 * JavaScript evaluates the two. The spelling matters for `__proto__`
 * alone: the computed and the shorthand spellings denote an own property,
 * the other two a prototype.
 */
export type Member = ConstantMember | ComputedMember

/**
 * A member whose key is a constant: the bare identifier, the string, or
 * the shorthand `{ a }`, a bare identifier with no value of its own, whose
 * value is the name's own reference.
 */
export type ConstantMember = {
    readonly key: DjsTokenWithMetadata
    readonly spelling: 'plain' | 'string' | 'shorthand'
    readonly name: string
    readonly value: Node
}

/**
 * A member whose key is computed, `[k]: v`: the node between the brackets,
 * any value — `["a"]` is the constant `"a"` by another spelling, and `[a]`
 * a key read at run time.
 */
export type ComputedMember = {
    readonly key: DjsTokenWithMetadata
    readonly spelling: 'computed'
    readonly node: Node
    readonly value: Node
}

/**
 * What every statement records of its ends: the token it begins with, and
 * whether a `;` ended it. A statement written without its `;` ends where
 * JavaScript inserts one — at the newline before the next statement, at
 * `}`, or at the end of input — and where the next statement shares its
 * line instead, its first token is the one JavaScript refuses; the fold
 * refuses it there, by that token's `newline`
 * ([spec: module structure](../../../../spec/modules/README.md)).
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
 * A `const`: what it binds — a name, or a binding pattern,
 * {@link BindingTarget} — and its value. It begins at its `const`, or at
 * the `export` before one a module exports.
 */
export type Const = Statement & {
    readonly target: BindingTarget
    readonly value: Node
}

/**
 * A loop's `let`, `let x = init;`: the token naming the one variable the
 * loop's block assigns, and its initial value. It begins at its `let`. A
 * name and never a pattern, the loop having one variable
 * ([spec: loops](../../../../spec/control-flow/loops.md)).
 */
export type Let = Statement & {
    readonly name: DjsTokenWithMetadata
    readonly value: Node
}

/**
 * What a binding binds, as written — a `const`'s, or a fixed parameter's:
 * a name, by its token; an array pattern, `[t, …]`, by its `[` and its
 * elements; or an object pattern, `{ p, … }`, by its `{` and its
 * properties
 * ([spec: destructuring](../../../../spec/bindings/destructuring.md)). A
 * pattern is read by the value rules — one symbol cannot tell a
 * parenthesized parameter list from a group, so the grammar reads a value
 * and the mappings keep this reading of it beside the node, as
 * JavaScript's cover grammar does — and a value that is no target is
 * recorded as `invalid`, at the token it begins with, for the fold to
 * refuse: a literal, an access, a call, an operator, a function, or a
 * group, `[(a)]`, which JavaScript refuses in a binding pattern though it
 * admits it in an assignment.
 */
export type BindingTarget =
    | readonly ['name', DjsTokenWithMetadata]
    | readonly ['array', DjsTokenWithMetadata, readonly BindingElement[]]
    | readonly ['object', DjsTokenWithMetadata, readonly BindingProperty[]]
    | readonly ['invalid', DjsTokenWithMetadata]

/**
 * An element of an array pattern: a target, or a rest element,
 * `...target`, by its `...` — JavaScript's, which the fold refuses for now
 * ([destructuring](../../../../spec/todo/2450-destructuring.md)).
 */
export type BindingElement = BindingTarget | readonly ['...', DjsTokenWithMetadata, BindingTarget]

/**
 * A property of an object pattern: its key, as an access's — the token a
 * constant key is read from, or a computed key — and the target it binds,
 * the shorthand `{ a }` binding the key's own name; or a rest property,
 * `...target`, by its `...`, which the fold refuses for now.
 */
export type BindingProperty =
    | { readonly key: Key, readonly target: BindingTarget }
    | readonly ['...', DjsTokenWithMetadata, BindingTarget]

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
 * A function's parameter list as written, {@link Parameters}; or what
 * keeps it from being one, for the fold to refuse: a list whose head is no
 * binding target — a literal, an access, an operator, or a group,
 * `((a)) => 1`, JavaScript's early error — retains the `(` that opened it,
 * and an `=>` on a line after the list, which JavaScript refuses, retains
 * the `=>`.
 */
export type ParameterList =
    | { readonly invalid: DjsTokenWithMetadata }
    | { readonly arrow: DjsTokenWithMetadata }
    | Parameters

/**
 * The fixed parameters in order, each a binding target — a name, or a
 * pattern, {@link BindingTarget} — with its default where it has one,
 * {@link Parameter}, and the rest parameter's token, or `null` where the
 * list has none. A rest parameter keeps a plain name and takes no default
 * ([spec: destructuring](../../../../spec/bindings/destructuring.md)).
 */
export type Parameters = {
    readonly fixed: readonly Parameter[]
    readonly rest: DjsTokenWithMetadata | null
}

/**
 * A fixed parameter as written: its binding target, or the target and its
 * default, `target = value`, by its `=`, which a refusal of the parameter
 * is anchored at, and the value as written
 * ([default parameters](../../../../spec/todo/3125-default-parameters.md)).
 */
export type Parameter = BindingTarget | readonly ['=', BindingTarget, DjsTokenWithMetadata, Node]

/**
 * The output alphabet: what the mappings return, each tagged by the rule it
 * came from. A `parameters` symbol is the list after a named list's first
 * parameter, its fixed parameters and its rest parameter's token, which the
 * list's reader puts the first before. The input alphabet's metadata is
 * the token itself, which has no `id`, and that is what tells the two
 * apart at a position typed as either.
 *
 * A value a `(` opened is `paren` rather than `value`, holding the same
 * node: a group is no node of its own, so this id is the one trace of the
 * parentheses, and what tells the parameter `(a)` from `((a))`, which
 * JavaScript refuses. Either carries the token it begins with, `first`,
 * which a `return` asks for its line.
 *
 * A value, an item, a member and their lists each carry a second reading
 * beside the node: the {@link BindingTarget} the same text is where a
 * binding is wanted, built as the node is, one mapping at a time, so that
 * a `const` or a parameter list reads it off the value it was read as. A
 * group has none: `(a)` is no target, so a `paren` is `invalid` wherever a
 * target is read, and the grouped item inside an array keeps that fact
 * through its own mapping.
 */
export type Out =
    | { readonly id: 'value', readonly node: Node, readonly first: DjsTokenWithMetadata, readonly target: BindingTarget }
    | { readonly id: 'paren', readonly node: Node, readonly first: DjsTokenWithMetadata }
    | { readonly id: 'parameters', readonly fixed: List<Parameter>, readonly rest: DjsTokenWithMetadata | null }
    | { readonly id: 'item', readonly item: Item, readonly target: BindingElement }
    | { readonly id: 'values', readonly items: List<Item>, readonly targets: List<BindingElement> }
    | { readonly id: 'member', readonly member: Member, readonly target: BindingProperty }
    | { readonly id: 'entry', readonly entry: Entry, readonly target: BindingProperty }
    | { readonly id: 'entries', readonly items: List<Entry>, readonly targets: List<BindingProperty> }
    | { readonly id: 'importBinding', readonly binding: ImportBinding }
    | { readonly id: 'importBindings', readonly items: List<ImportBinding> }
    | { readonly id: 'import', readonly statement: Import }
    | { readonly id: 'const', readonly statement: Const }
    | { readonly id: 'statement', readonly statement: BlockStatement }
    | { readonly id: 'end', readonly end: Block[1] }
    | { readonly id: 'loopStatement', readonly statement: LoopStatement }
    | { readonly id: 'last', readonly consts: List<ModuleConst>, readonly default: ValueStatement | null, readonly thrown: ValueStatement | null }
    | { readonly id: 'module', readonly module: Module }
