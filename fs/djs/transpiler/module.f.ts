/**
 * DJS transpiler for transforming parsed trees into JavaScript output.
 *
 * @module
 */
import { type Unknown } from '../module.f.ts'
import { type Result, error, ok } from '../../types/result/module.f.ts'
import { drop, map as listMap, type List, toArray, includes } from '../../types/list/module.f.ts'
import { tokenize } from '../tokenizer/module.f.ts'
import { setReplace, at, type OrderedMap } from '../../types/ordered_map/module.f.ts'
import { stringToList } from '../../text/utf16/module.f.ts'
import { concat as pathConcat } from '../../path/module.f.ts'
import { type ParseError, parseFromTokens } from '../parser/module.f.ts'
import { run, type AstModule } from '../ast/module.f.ts'
import { type Effect, pure } from '../../types/effects/module.f.ts'
import { readFile, type ReadFile } from '../../types/effects/node/module.f.ts'
import { utf8ToString } from '../../text/module.f.ts'

/**
 * State threaded through the recursive transpilation of a DJS module graph.
 *
 * - `complete`: modules that have been fully parsed and evaluated, keyed by path.
 * - `stack`: import chain currently being resolved (used to detect circular dependencies).
 * - `error`: the first parse error encountered, or `null` while everything is clean.
 */
export type ParseContext = {
    readonly complete: OrderedMap<djsResult>
    readonly stack: List<string>
    readonly error: ParseError | null
}

/** The evaluated DJS value produced for one successfully transpiled module. */
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

const parseModule
    : (path: string) => Effect<ReadFile, Result<AstModule, ParseError>>
    = path => readFile(path).step(result => {
        if (result[0] === 'error') {
            return pure(error({ message: 'file not found', metadata: null }))
        }
        const tokens = tokenize(stringToList(utf8ToString(result[1])))(path)
        return pure(parseFromTokens(tokens))
    })

const transpileWithImports
    : (path: string) => (parseModuleResult: Result<AstModule, ParseError>) => (context: ParseContext) => Effect<ReadFile, ParseContext>
    = path => parseModuleResult => context => {
        if (parseModuleResult[0] === 'ok') {
            const dir = pathConcat(path)('..')
            const pathsCombine = listMap(pathConcat(dir))(parseModuleResult[1][0])
            const pathsArray = toArray(pathsCombine)
            const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
            return pathsArray.reduce<Effect<ReadFile, ParseContext>>(
                (acc, p) => acc.step(ctx => foldNextModuleOp(p)(ctx)),
                pure(contextWithStack),
            ).step(contextWithImports => {
                if (contextWithImports.error !== null) {
                    return pure(contextWithImports)
                }
                const args = toArray(listMap(mapDjs(contextWithImports))(pathsCombine))
                const djs = { djs: run(parseModuleResult[1][1])(args) }
                return pure({
                    ...contextWithImports,
                    stack: drop(1)(contextWithImports.stack),
                    complete: setReplace(path)(djs)(contextWithImports.complete),
                })
            })
        }
        return pure({ ...context, error: parseModuleResult[1] })
    }

const foldNextModuleOp
    : (path: string) => (context: ParseContext) => Effect<ReadFile, ParseContext>
    = path => context => {
        if (context.error !== null) {
            return pure(context)
        }

        if (includes(path)(context.stack)) {
            return pure({ ...context, error: { message: 'circular dependency', metadata: null } })
        }

        if (at(path)(context.complete) !== null) {
            return pure(context)
        }

        return parseModule(path).step(parseModuleResult =>
            transpileWithImports(path)(parseModuleResult)(context)
        )
    }

/**
 * Transpiles a DJS module graph rooted at `path` into a single `Unknown` value.
 *
 * Reads each file via the `ReadFile` effect, resolves imports recursively, and
 * evaluates the AST. Returns `['ok', value]` on success, or `['error', ParseError]`
 * on a parse failure or circular dependency.
 */
export const transpile
    : (path: string) => Effect<ReadFile, Result<Unknown, ParseError>>
    = path =>
        foldNextModuleOp(path)({ stack: null, complete: null, error: null }).step(
            (context): Effect<ReadFile, Result<Unknown, ParseError>> => {
                if (context.error !== null) {
                    return pure(error(context.error))
                }
                const result = at(path)(context.complete)?.djs
                return pure(ok(result))
            }
        )
