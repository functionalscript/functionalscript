import { type Unknown } from '../module.f.ts'
import { type Result, error, ok } from '../../types/result/module.f.ts'
import { fold, drop, map as listMap, type List, toArray, includes } from '../../types/list/module.f.ts'
import { type Fold } from '../../types/function/operator/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { setReplace, at, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import type { Fs } from '../../io/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { concat as pathConcat } from '../../path/module.f.ts'
import { type ParseError, parseFromTokens } from '../parser/module.f.ts'
import { run, type AstModule } from '../ast/module.f.ts'
import { decodeUtf8 } from '../../types/uint8array/module.f.ts'

export type ParseContext = {
    readonly fs: Fs
    readonly complete: OrderedMap<djsResult>
    readonly stack: List<string>
    readonly error: ParseError | null
}

export type djsResult = {
    djs: Unknown
}

const mapDjs
    : (context: ParseContext) => (path: string) => Unknown
    = context => path => {
        const res = at(path)(context.complete)
        if (res === null)
        {
            throw 'unexpected behaviour'
        }
        return res.djs
    }

const transpileWithImports
    : (path: string) => (parseModuleResult: Result<AstModule, ParseError>) => (context: ParseContext) => ParseContext
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const dir = pathConcat(path)('..')
            const pathsCombine = listMap(pathConcat(dir))(parseModuleResult[1][0])
            const contextWithImports = fold(foldNextModuleOp)({ ... context, stack: { first: path, tail: context.stack } })(pathsCombine)
            if (contextWithImports.error !== null) {
                return contextWithImports
            }
            const args = toArray(listMap(mapDjs(contextWithImports))(pathsCombine))
            const djs = { djs: run(parseModuleResult[1][1])(args) }
            return { ... contextWithImports, stack: drop(1)(contextWithImports.stack), complete: setReplace(path)(djs)(contextWithImports.complete) }
        }
        return { ...context, error: parseModuleResult[1] }
}

const parseModule
    : (path: string) => (context: ParseContext) => Result<AstModule, ParseError>
    = path => context => {
        const content = context.fs.readFileSync(path)
        if (content === null) {
            return error({message: 'file not found', metadata: null})
        }

        const tokens = tokenize(stringToList(decodeUtf8(content)))(path)
        return parseFromTokens(tokens)
}

const foldNextModuleOp
    : Fold<string, ParseContext>
    = path => context => {
        if (context.error !== null) {
            return context
        }

        if (includes(path)(context.stack)) {
            return { ... context, error: { message: 'circular dependency', metadata: null} }
        }

        if (at(path)(context.complete) !== null) {
            return context
        }

        const parseModuleResult = parseModule(path)(context)
        return transpileWithImports(path)(parseModuleResult)(context)
}

export const transpile: (fs: Fs) => (path: string) => Result<Unknown, ParseError>
 = fs => path => {
    const context = foldNextModuleOp(path)({fs, stack: null, complete: null, error: null})
    if (context.error !== null) {
        return error(context.error)
    }
    const result = at(path)(context.complete)?.djs
    return ok(result)
 }
