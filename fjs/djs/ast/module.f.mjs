/**
 * AST types and helpers for the DJS representation.
 *
 * @module
 *
 * @import { Array, Unknown } from '../types.ts'
 * @import { AstConst, AstBody } from './types.ts'
 * @import { _FoldObjectState, _RunState } from './private.ts'
 */

import { concat, fold, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'

const { entries } = Object

/** @type {(ast: AstConst) => (state: _RunState) => _RunState} */
const foldOp = ast => state => {
    const djs = toDjs(state)(ast)
    return { ...state, consts: concat(state.consts)([djs]) }
}

/** @type {(entry: [string, AstConst]) => (state: _FoldObjectState) => _FoldObjectState} */
const foldAstObjectOp = entry => state => {
    const e = concat(state.entries)([[entry[0], (toDjs(state.runState)(entry[1]))]])
    return { ...state, entries: e }
}

/** @type {(state: _RunState) => (ast: AstConst) => Unknown} */
const toDjs = state => ast => {
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
            const e = fold(foldAstObjectOp)({ runState: state, entries: null })(entries(ast)).entries
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
 *
 * @type {(body: AstBody) => (args: Array) => Unknown}
 */
export const run = body => args => {
    const state = fold(foldOp)({ body, args, consts: null })(body)
    return last(null)(state.consts)
}

// for functions
// export const astBodyToAstConst
//     :(body: AstBody) => (args: AstArray) => AstConst
//     = body => args => todo()
