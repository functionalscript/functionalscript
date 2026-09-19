/**
 * Type-level API for `fjs/fsc/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports, the nodes its rewrite set builds and the
 * alphabet it returns them in — the input alphabet is the grammar's, in
 * `./grammar/types.ts`.
 *
 * @module
 */

import type { TokenMetadata, TokenPosition } from '../../ebnf/lib/js/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Primitive } from '../../media/datajs/types.ts'
import type { BinaryTag } from '../ast/types.ts'
import type { DjsTokenWithMetadata } from '../tokenizer/types.ts'

/**
 * A parse failure and where it is.
 *
 * `metadata` is the anchor — the position a reader is pointed at, `null` when
 * there is no token to point at (an empty stream, or a `.json` input read by a
 * reader that tracks no positions).
 *
 * `end` extends that anchor into a span, and is present only when the failure
 * came with one. A lexical error passes through the `end` its token carried, so
 * an unterminated string spans its opening quote to where the input ran out. A
 * *grammar* failure has no span: it points at one token, and a token's extent is
 * not recorded — see `ErrorToken` in `fjs/ebnf/lib/js/types.ts`, and
 * `../parser/README.md` for the widening that would give every token one.
 */
export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
    readonly end?: TokenPosition | undefined
    /**
     * The file a failure with no token is in, when the failure knows one: a
     * missing file, a cycle, a body that fails to evaluate — each in an
     * imported module as readily as in the one being compiled, which
     * `metadata: null` alone would name.
     */
    readonly path?: string | undefined
}

/**
 * A value as the mappings build it, before names are resolved: a primitive
 * converted from its token, a reference by the identifier token that spells
 * it — its name, and the position an error is anchored at — a property
 * access by the token its key is read from, a call by its arguments in the
 * order written, a negation by its operand, a function by the token naming
 * its parameter — `null` where the list is empty, there being no token —
 * and its body,
 * a block body by its ordered, tagged statements, or a
 * container of its items in the order written.
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
 * [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md):
 * arithmetic, strict comparison, and bitwise. `-` alone is both a prefix
 * and an infix, told apart by arity exactly as `~`'s prefix and every
 * infix are told apart from each other, by tag; `**` is right-associative,
 * folded by the grammar rather than by this tree, so `2 ** 3 ** 2` is
 * already `['**', 2, ['**', 3, 2]]` here.
 */
export type Node =
    | readonly ['primitive', Primitive]
    | readonly ['ref', DjsTokenWithMetadata]
    | readonly ['.', Node, DjsTokenWithMetadata]
    | readonly ['()', Node, readonly Node[]]
    | readonly ['-', Node]
    | readonly ['~', Node]
    | readonly [BinaryTag, Node, Node]
    | readonly ['=>', DjsTokenWithMetadata | null, Node]
    | Block
    | Container

/**
 * The block syntax currently understood: zero or more `const` declarations
 * followed by one explicit value-returning statement. The grammar enforces
 * this order; bare returns, extra statements and ASI remain unsupported.
 */
export type Block = readonly ['block', readonly [...(readonly ['const', Const])[], readonly ['return', Node]]]

/** An array of its items, or an object of its members, each in the order written. */
export type Container =
    | readonly ['array', readonly Node[]]
    | readonly ['object', readonly Entry[]]

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
 * An `import`: the token naming what it binds, the module specifier, and
 * its attribute when it has one — the tokens its key and value are read
 * from, which anchor the error a key or value the language does not know
 * earns.
 */
export type Import = {
    readonly name: DjsTokenWithMetadata
    readonly module: string
    readonly attribute: readonly [DjsTokenWithMetadata, DjsTokenWithMetadata] | null
}

/** A `const`: the token naming what it binds, and its value. */
export type Const = {
    readonly name: DjsTokenWithMetadata
    readonly value: Node
}

/** A module declaration, with its source export marker retained. */
export type ModuleConst = {
    readonly declaration: Const
    readonly exported: boolean
}

/** A whole module as matched: declarations in order and an optional final default. */
export type Module = {
    readonly imports: readonly Import[]
    readonly consts: readonly ModuleConst[]
    readonly exported: Node | null
}

/**
 * The output alphabet: what the mappings return, each tagged by the rule it
 * came from. The input alphabet's metadata is the token itself, which has
 * no `id`, and that is what tells the two apart at a position typed as
 * either.
 */
export type Out =
    | { readonly id: 'value', readonly node: Node }
    | { readonly id: 'values', readonly items: List<Node> }
    | { readonly id: 'member', readonly member: Entry }
    | { readonly id: 'members', readonly items: List<Entry> }
    | { readonly id: 'import', readonly statement: Import }
    | { readonly id: 'const', readonly statement: Const }
    | { readonly id: 'export', readonly consts: List<ModuleConst>, readonly default: Node | null }
    | { readonly id: 'module', readonly module: Module }
