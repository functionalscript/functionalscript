/**
 * Type-level API for `fjs/djs/parser/module.f.mjs`: the `ParseError` shape
 * `parseFromTokens` reports, the nodes its rewrite set builds and the
 * alphabet it returns them in — the input alphabet is the grammar's, in
 * `./grammar/types.ts`.
 *
 * @module
 */

import type { TokenMetadata, TokenPosition } from '../../js/tokenizer/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Primitive } from '../types.ts'
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
 * not recorded — see `ErrorToken` in `fjs/js/tokenizer/types.ts`, and
 * `../parser/README.md` for the widening that would give every token one.
 */
export type ParseError = {
    readonly message: string,
    readonly metadata: TokenMetadata | null
    readonly end?: TokenPosition | undefined
}

/**
 * A value as the mappings build it, before names are resolved: a primitive
 * converted from its token, a reference by the identifier token that spells
 * it — its name, and the position an error is anchored at — or a container
 * of its items in the order written.
 */
export type Node =
    | readonly ['primitive', Primitive]
    | readonly ['ref', DjsTokenWithMetadata]
    | Container

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

/** An `import`: the token naming what it binds, and the module specifier. */
export type Import = {
    readonly name: DjsTokenWithMetadata
    readonly module: string
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
