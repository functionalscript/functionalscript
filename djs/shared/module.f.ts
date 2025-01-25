import type * as djs from '../module.f.ts'
import { todo } from "../../dev/module.f.ts"

export type AstModule = [readonly string[], AstBody]

export type AstConst = djs.Primitive|AstModuleRef|AstArray|AstObject

export type AstModuleRef = ['aref' | 'cref', number]

export type AstArray = ['array', readonly AstConst[]]

export type AstObject = {
    readonly [k in string]: AstConst
}

export type AstBody = readonly AstConst[]

export const run
    :(body: AstBody) => (args: djs.Array) => djs.Unknown
    = body => args => todo()

// for functions
// export const astBodyToAstConst
//     :(body: AstBody) => (args: AstArray) => AstConst
//     = body => args => todo()