import type * as djs from '../module.f.ts'
import { type List, concat, fold, last, map, take, toArray } from '../../types/list/module.f.ts'
import type { Entry } from '../../types/ordered_map/module.f.ts'
import { fromEntries } from '../../types/object/module.f.ts'
const { entries } = Object

export type AstModule = [readonly string[], AstBody]

export type AstConst = djs.Primitive|AstModuleRef|AstArray|AstObject

export type AstModuleRef = ['aref' | 'cref', number]

export type AstArray = ['array', readonly AstConst[]]

export type AstObject = {
    readonly [k in string]: AstConst
}

export type AstBody = readonly AstConst[]

type RunState = {
    readonly body: AstBody
    readonly args: djs.Array
    readonly consts: List<djs.Unknown>
}

type FoldObjectState = {
    readonly runState: RunState,
    readonly entries: List<Entry<djs.Unknown>>
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
    : (state: RunState) => (ast: AstConst) => djs.Unknown
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

export const run
    :(body: AstBody) => (args: djs.Array) => djs.Unknown
    = body => args => {
        const state = fold(foldOp)({ body, args, consts: null})(body)
        return last(null)(state.consts)
    }

// for functions
// export const astBodyToAstConst
//     :(body: AstBody) => (args: AstArray) => AstConst
//     = body => args => todo()
