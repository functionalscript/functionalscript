import type * as djs from '../module.f.ts'
import { type Result, error, ok } from '../../types/result/module.f.ts'
import { fold, drop, map as listMap, type List, toArray, includes } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'
import type { Fs } from '../io/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { concat as pathConcat } from '../../path/module.f.ts'
import { parseFromTokens } from '../parser/module.f.ts'
import { run, type AstModule } from '../shared/module.f.ts'

export type ParseContext = {    
    readonly fs: Fs    
    readonly complete: Map<djsResult>
    readonly stack: List<string>
    readonly error: string | null
}

export type djsResult = {
    djs: djs.Unknown
}

const mapDjs
    : (context: ParseContext) => (path: string) => djs.Unknown
    = context => path => {
        const res = at(path)(context.complete)
        if (res === null)
        {
            throw 'unexpected behaviour'
        }
        return res.djs
    }

const transpileWithImports
    : (path: string) => (parseModuleResult: Result<AstModule, string>) => (context: ParseContext) => ParseContext
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const pathsCombine = listMap(pathConcat(path))(parseModuleResult[1][0])
            const contextWithImports = fold(foldNextModuleOp)({ ... context, stack: { first: path, tail: context.stack } })(pathsCombine)
            if (contextWithImports.error !== null) {
                return contextWithImports
            }
            const args = toArray(listMap(mapDjs(contextWithImports))(pathsCombine))
            const djs = { djs: run(parseModuleResult[1][1])(args) }
            return { ... contextWithImports, stack: drop(1)(contextWithImports.stack), complete: setReplace(path)(djs)(contextWithImports.complete) }
        }
        return context
}

const parseModule
    : (path: string) => (context: ParseContext) => Result<AstModule, string>
    = path => context => {
        const content = context.fs.readFileSync(path)
        if (content === null) {
            return error('file not found')  
        }

        const tokens = tokenize(stringToList(content))        
        return parseFromTokens(tokens)
}

const foldNextModuleOp
    : Operator.Fold<string, ParseContext>
    = path => context => {
        if (context.error !== null) {
            return context
        }

        if (includes(path)(context.stack)) {
            return { ... context, error: 'circular dependency' }
        }

        if (at(path)(context.complete) !== null) {
            return context
        }

        const parseModuleResult = parseModule(path)(context)
        return transpileWithImports(path)(parseModuleResult)(context)
}

export const transpile: (fs: Fs) => (path: string) => Result<djs.Unknown, string>
 = fs => path => {
    const context = foldNextModuleOp(path)({fs, stack: null, complete: null, error: null})
    if (context.error !== null) {
        return error(context.error)
    }
    const result = at(path)(context.complete)?.djs
    return ok(result)
 }