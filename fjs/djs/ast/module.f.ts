/**
 * AST types and helpers for the DJS representation.
 *
 * @module
 */
import type { Primitive, Array, Unknown } from '../module.f.ts'
import type { List } from '../../types/list/types.ts'
import { concat, fold, last, map, take, toArray } from '../../types/list/module.f.mjs'
import type { Entry } from '../../types/ordered_map/types.ts'
import { fromEntries } from '../../types/object/module.f.mjs'

const { entries } = Object

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

type RunState = {
    readonly body: AstBody
    readonly args: Array
    readonly consts: List<Unknown>
}

type FoldObjectState = {
    readonly runState: RunState,
    readonly entries: List<Entry<Unknown>>
}

const foldOp
    :(ast: AstConst) => (state: RunState) => RunState
    = ast => state => {
        const djs = toDjs(state)(ast)
        return { ... state, consts: concat(state.consts)([djs])}
    }

const foldAstObjectOp
    :(entry: [string, AstConst]) => (state: FoldObjectState) => FoldObjectState
    = entry => state => {
        const e = concat(state.entries)([[entry[0], (toDjs(state.runState)(entry[1]))]])
        return { ... state, entries: e }
    }

const toDjs
    : (state: RunState) => (ast: AstConst) => Unknown
    = state => ast => {
        switch (typeof ast) {
            case 'boolean':
            case 'number':
            case 'string':
            case 'bigint': { return ast }
            default: {
                if (ast === null) { return ast }
                if (ast === undefined) { return ast }
                if (ast instanceof Array) {
                    switch (ast[0]) {
                        case 'aref': { return state.args[ast[1]] }
                        case 'cref': { return last(null)(take(ast[1] + 1)(state.consts)) }
                        case 'array': { return toArray(map(toDjs(state))(ast[1])) }
                    }
                }
                const e = fold(foldAstObjectOp)({ runState: state, entries: null})(entries(ast)).entries
                return fromEntries(e)
            }
        }
    }

/**
 * Evaluates a module body against its imported modules and returns the value
 * the module yields — the last entry of the body.
 *
 * Entries are evaluated left to right, so a `cref` resolves to an already
 * evaluated entry. A reference is shared, not copied: two properties holding
 * the same `['cref', i]` deserialize to the same object, which is what lets a
 * DJS module denote a graph rather than a tree.
 */
export const run
    :(body: AstBody) => (args: Array) => Unknown
    = body => args => {
        const state = fold(foldOp)({ body, args, consts: null})(body)
        return last(null)(state.consts)
    }

// for functions
// export const astBodyToAstConst
//     :(body: AstBody) => (args: AstArray) => AstConst
//     = body => args => todo()
