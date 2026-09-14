/**
 * Type-level API for `fjs/fsc/ast/module.f.mjs`: the AST shape `run`
 * evaluates — `AstModule`, `AstConst`, `AstModuleRef`, `AstArray`,
 * `AstMember`, `AstObject`, and `AstBody`.
 *
 * @module
 */

import type { Primitive, Unknown } from '../../media/datajs/types.ts'

/**
 * A parsed DJS module: its imported module specifiers, in source order, and
 * its body.
 *
 * The specifier list indexes `['aref', i]`.
 */
export type AstModule = readonly [readonly string[], AstBody]

/** A value in a module body: a primitive, a reference, an array, or an object. */
export type AstConst = Primitive|AstModuleRef|AstArray|AstObject

/**
 * A reference to a value defined outside this `AstConst`.
 *
 * - `['aref', i]` — the `i`-th argument of the body, i.e. the `i`-th imported
 *   module of the enclosing `AstModule`.
 * - `['cref', i]` — the `i`-th entry of the enclosing `AstBody`.
 *
 * Both indices are absolute and zero-based, **not** offsets from the
 * referencing entry: in the body `[a, b, ['cref', 0]]` the reference resolves
 * to `a`, not to the nearest preceding entry `b`.
 *
 * A `cref` index must be smaller than the index of the entry holding it —
 * `run` evaluates a body left to right, so a reference to the current or a
 * later entry is unsatisfiable. It is not rejected: it resolves to the most
 * recently evaluated entry instead.
 */
export type AstModuleRef = readonly ['aref' | 'cref', number]

/** An array value; its elements are evaluated in order. */
export type AstArray = readonly ['array', readonly AstConst[]]

/** One member of an object: the key it is written under — spelled bare, quoted or computed — and its value. */
export type AstMember = readonly [string, AstConst]

/**
 * An object value: its members in the order they are written, a repeated
 * key written twice. The syntax keeps what the value cannot: `run` builds
 * the object JavaScript builds from the same literal — a repeated key at its
 * first position with its last value, integer-like keys first in numeric
 * order — and EDAG's object constructor, `['{}', …]`, takes the members as
 * written, duplicates and all, which only the syntax still has.
 */
export type AstObject = readonly ['object', readonly AstMember[]]

/**
 * The constants of a module body, in declaration order. The **last** entry is
 * the value the module yields; the preceding entries exist to be named by
 * `['cref', i]`.
 *
 * A body describes the function
 *
 * ```js
 * (...args) => { const c0 = ...; const c1 = ...; return <last> }
 * ```
 *
 * where `args` are the imported modules.
 */
export type AstBody = readonly AstConst[]

/**
 * What the sweep over a module's syntax says about the graph its value
 * denotes: whether a node is reached by two references, and — when none is —
 * which container modules the value reaches, each named once by its id, so
 * that an importer can see a module reached along two import edges as one
 * node reached twice. A shared module reaches nothing worth listing: every
 * importer of it is shared already.
 */
export type Sharing = {
    readonly shared: boolean
    readonly reaches: readonly string[]
}

/**
 * What a module denotes: the value the front end built for it, and what the
 * sweep says of its graph. The sweep's answer is known from the module's
 * syntax — a `const` or a module referenced twice — and is carried beside
 * the value because nothing about a plain object says it afterwards without
 * walking the graph by identity.
 */
export type Denotation = Sharing & { readonly value: Unknown }

/** An imported module as the sweep sees it: what it denotes, under the id an importer names it by — its resolved path. */
export type Import = Denotation & { readonly id: string }
