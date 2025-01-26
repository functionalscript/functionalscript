import type * as djs from '../module.f.ts'
import { todo } from "../../dev/module.f.ts"
import { type List, concat, drop, first, fold, last, take } from '../../types/list/module.f.ts'

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

export const foldOp
    :(ast: AstConst) => (state: RunState) => RunState
    = ast => state => {
        const djs = toDjs(ast)(state)
        return { ... state, consts: concat(state.consts)([djs])}
    }

export const toDjs
    :(ast: AstConst) => (state: RunState) => djs.Unknown
    = ast => state => {
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
                        case 'array': { return todo() }
                    }
                }
                return todo()
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