import * as result from '../../types/result/module.f'
import { fold, drop, map as listMap, type List } from '../../types/list/module.f'
import type * as Operator from '../../types/function/operator/module.f'
import { tokenize } from '../tokenizer/module.f'
import { setReplace, at, type Map } from '../../types/map/module.f'
import { type Fs } from '../io/module.f'
import { stringToList } from '../../text/utf16/module.f'
import { concat as pathConcat } from '../../path/module.f'
import { parseFromTokens, type DjsModule } from '../parser/module.f'

export type ParseContext = {    
    readonly fs: Fs
    readonly complete: Map<result.Result<DjsModule, string>>
    readonly stack: List<string>
}

const parseImports
    : (path: string) => (parseModuleResult: result.Result<DjsModule, string>) => (context: ParseContext) => ParseContext
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const pathsCombine = listMap(pathConcat(path))(parseModuleResult[1][0])
            const contextAfterImports = fold(foldNextModuleOp)({ ... context, stack: { first: path, tail: context.stack } })(pathsCombine)
            return { ... contextAfterImports, stack: drop(1)(contextAfterImports.stack) }            
        }
        return context
}

const foldNextModuleOp
    : Operator.Fold<string, ParseContext>
    = path => context => {
        if (at(path)(context.complete) !== null) {
            return context
        }

        //todo: check for cycles
        const s = context.fs.readFileSync(path)
        const tokens = tokenize(stringToList(s))
        const parseModuleResult: result.Result<DjsModule, string> = parseFromTokens(tokens)
        const contextWithImports = parseImports(path)(parseModuleResult)(context)

        const c = setReplace(path)(parseModuleResult)(contextWithImports.complete) 
        return { ... contextWithImports, complete: setReplace(path)(parseModuleResult)(contextWithImports.complete) }
}

export const parse: (fs: Fs) => (path: string) => Map<result.Result<DjsModule, string>>
 = fs => path => {
    const context = foldNextModuleOp(path)({fs, stack: null, complete: null})
    return context.complete
 }
