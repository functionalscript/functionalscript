import type { Primitive } from '../types.ts'

/**
 * A parsed DJS module: its imported module specifiers, in source order, and
 * its body.
 *
 * The specifier list indexes `['aref', i]`.
 */
export type AstModule = [readonly string[], AstBody]

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
export type AstModuleRef = ['aref' | 'cref', number]

/** An array value; its elements are evaluated in order. */
export type AstArray = ['array', readonly AstConst[]]

/** An object value, keyed by property name. */
export type AstObject = { readonly[k in string]?: AstConst }

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
