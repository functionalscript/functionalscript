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
 * Stage A's unary-only tag (`spec/todo/2340-operators.md`): bitwise not.
 * Unary `-` is {@link Op12Tag}, legal at both arities, as
 * `fjs/edag/types.ts`'s `Op12Id` has it; unary `+`/`!`/`typeof` are not this
 * grammar's yet.
 */
export type Op1Tag = '~'

/** The one Stage A tag legal at both arities: unary negation, binary subtraction. */
export type Op12Tag = '-'

/**
 * Stage A's remaining binary tags: arithmetic but `-`, strict comparison,
 * bitwise but `~`. A subset of `fjs/edag/types.ts`'s `Op2Id` plus its
 * `Op12Id`'s `+`, which the grammar only ever builds at binary arity, having
 * no unary `+` syntax: the grammar has no `==`/`!=`, `instanceof`/`in`, or
 * the lazy `&&`/`||`/`??`/`?:`/`,` of later stages.
 */
export type Op2Tag = '+' | '===' | '!==' | '>' | '>=' | '<' | '<=' | '*' | '/' | '%' | '**' | '&' | '|' | '^' | '<<' | '>>' | '>>>'

/**
 * A value as the mappings build it, before names are resolved: a primitive
 * converted from its token, a reference by the identifier token that spells
 * it — its name, and the position an error is anchored at — a property
 * access by the token its key is read from, a function by the token naming
 * its parameter and its body, or a container of its items in the order
 * written.
 */
export type Node =
    | readonly ['primitive', Primitive]
    | readonly ['ref', DjsTokenWithMetadata]
    | readonly ['.', Node, DjsTokenWithMetadata]
    | readonly ['=>', DjsTokenWithMetadata, Node]
    | Container

/**
 * An array of its items, an object of its members, or a Stage A operator
 * over its operands, each in the order written. The three share one round-
 * by-round resolution in `../module.f.mjs`'s `round`/`close`/`itemAt`: an
 * operator's operand list closes to the EDAG's own flat `[tag, ...operands]`
 * shape (`op1`/`op12`/`op2` in `fjs/edag/module.f.mjs`), the array wrapper
 * here existing only so an operator node has an item list to walk like a
 * container's, never appearing past resolution — {@link AstConst} in
 * `../ast/types.ts` has the flat tags directly.
 */
export type Container =
    | readonly ['array', readonly Node[]]
    | readonly ['object', readonly Entry[]]
    | readonly [Op1Tag, readonly [Node]]
    | readonly [Op12Tag, readonly [Node]]
    | readonly [Op12Tag, readonly [Node, Node]]
    | readonly [Op2Tag, readonly [Node, Node]]

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

/** A whole module as matched: its statements in order, the export's value last. */
export type Module = {
    readonly imports: readonly Import[]
    readonly consts: readonly Const[]
    readonly exported: Node
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
    | { readonly id: 'export', readonly node: Node }
    | { readonly id: 'module', readonly module: Module }
