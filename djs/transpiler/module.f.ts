import type * as djs from '../module.f.ts'
import { type Result, error } from '../../types/result/module.f.ts'
import { fold, drop, map as listMap, type List, find, last } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'
import type { Fs } from '../io/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { concat as pathConcat } from '../../path/module.f.ts'
import { parseFromTokens } from '../parser/module.f.ts'
import type { AstModule } from '../shared/module.f.ts'
import { todo } from '../../dev/module.f.ts'

export type ParseContext = {    
    readonly fs: Fs    
    readonly complete: Map<Result<djs.Unknown, string>>
    readonly stack: List<string>
}

const transpileWithImports
    : (path: string) => (parseModuleResult: Result<AstModule, string>) => (context: ParseContext) => ParseContext
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const pathsCombine = listMap(pathConcat(path))(parseModuleResult[1][0])
            const contextAfterImports = fold(foldNextModuleOp)({ ... context, stack: { first: path, tail: context.stack } })(pathsCombine)
            todo()
            return { ... contextAfterImports, stack: drop(1)(contextAfterImports.stack) }            
        }
        return context
}

const isInStack
    :(stack: List<string>) => (path: string) => boolean
    = stack => path => {
        return find(null)(x => x === path)(stack) !== null
}

const parseModule
    : (path: string) => (context: ParseContext) => Result<AstModule, string>
    = path => context => {
        const content = context.fs.readFileSync(path)
        if (content === null) {
            return error('file not found')  
        }

        const tokens = tokenize(stringToList(content))
        const result = parseFromTokens(tokens)
        if (result[0] === 'ok') {
            const pathsCombine = listMap(pathConcat(path))(result[1][0])
            const circular = find(null)(isInStack(context.stack))(pathsCombine)
            if (circular !== null) 
            {
                return error('circular dependency')
            }
        }
        
        return result
}

const foldNextModuleOp
    : Operator.Fold<string, ParseContext>
    = path => context => {
        if (at(path)(context.complete) !== null) {
            return context
        }

        const parseModuleResult = parseModule(path)(context)
        return transpileWithImports(path)(parseModuleResult)(context)
}

export const transpile: (fs: Fs) => (path: string) => Result<djs.Unknown, string>
 = fs => path => {
    const context = foldNextModuleOp(path)({fs, stack: null, complete: null})
    const result = at(path)(context.complete)
    if (result === null) {
        return error('error')
    }
    return result
 }
