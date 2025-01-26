import type * as djs from '../module.f.ts'
import { todo } from "../../dev/module.f.ts"
import { type List, concat, fold, last } from '../../types/list/module.f.ts'

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
        switch (typeof ast) {
            case 'boolean':
            case 'number':
            case 'string':
            case 'bigint': { return { ... state, consts: concat(state.consts)([ast]) } }
            default: {
                if (ast === null || ast === undefined) { return { ... state, consts: concat(state.consts)([ast]) } }
                if (ast instanceof Array) {
                    switch (ast[0]) {
                        case 'aref': { return todo() }
                        case 'cref': { return todo() }
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