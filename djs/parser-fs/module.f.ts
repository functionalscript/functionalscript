import { type Result, error } from '../../types/result/module.f.ts'
import { fold, drop, map as listMap, type List } from '../../types/list/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'
import { type Fs } from '../io/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { concat as pathConcat } from '../../path/module.f.ts'
import { parseFromTokens } from '../parser/module.f.ts'
import type { DjsModule } from '../shared/module.f'

export type ParseContext = {    
    readonly fs: Fs
    readonly complete: Map<Result<DjsModule, string>>
    readonly stack: List<string>
}

const parseImports
    : (path: string) => (parseModuleResult: Result<DjsModule, string>) => (context: ParseContext) => ParseContext
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const pathsCombine = listMap(pathConcat(path))(parseModuleResult[1][0])
            const contextAfterImports = fold(foldNextModuleOp)({ ... context, stack: { first: path, tail: context.stack } })(pathsCombine)
            return { ... contextAfterImports, stack: drop(1)(contextAfterImports.stack) }            
        }
        return context
}

const parseModule
    : (content: string | null) => Result<DjsModule, string>
    = content => {
        if (content === null) {
            return error('file not found')  
        }
        const tokens = tokenize(stringToList(content))
        return parseFromTokens(tokens)
}

const foldNextModuleOp
    : Operator.Fold<string, ParseContext>
    = path => context => {
        if (at(path)(context.complete) !== null) {
            return context
        }

        //todo: check for cycles
        const s = context.fs.readFileSync(path)
        const parseModuleResult = parseModule(s)
        const contextWithImports = parseImports(path)(parseModuleResult)(context)
        return { ... contextWithImports, complete: setReplace(path)(parseModuleResult)(contextWithImports.complete) }
}

export const parse: (fs: Fs) => (path: string) => Map<Result<DjsModule, string>>
 = fs => path => {
    const context = foldNextModuleOp(path)({fs, stack: null, complete: null})
    return context.complete
 }
