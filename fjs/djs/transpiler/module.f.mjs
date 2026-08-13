/**
 * DJS transpiler for transforming parsed trees into JavaScript output.
 *
 * @module
 *
 * @import { Unknown } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { OrderedMap } from '../../types/ordered_map/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstModule } from '../ast/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile } from '../../effects/node/types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { drop, map as listMap, toArray, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { concat as pathConcat } from '../../path/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { run } from '../ast/module.f.mjs'
import { foldStep, pure, step } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'

/**
 * State threaded through the recursive transpilation of a DJS module graph.
 *
 * - `complete`: modules that have been fully parsed and evaluated, keyed by path.
 * - `stack`: import chain currently being resolved (used to detect circular dependencies).
 * - `error`: the first parse error encountered, or `null` while everything is clean.
 * @typedef {{
 *   readonly complete: OrderedMap<djsResult>
 *   readonly stack: List<string>
 *   readonly error: ParseError | null
 * }} ParseContext
 */

/**
 * The evaluated DJS value produced for one successfully transpiled module.
 * @typedef {{ djs: Unknown }} djsResult
 */

/** @type {(context: ParseContext) => (path: string) => Unknown} */
const mapDjs = context => path => {
    const res = at(path)(context.complete)
    if (res === null)
    {
        throw 'unexpected behaviour'
    }
    return res.djs
}

/** @type {(path: string) => Effect<ReadFile, Result<AstModule, ParseError>>} */
const parseModule = path => step(
    readUtf8File(path),
    result => {
        if (result[0] === 'error') {
            return pure(error({ message: 'file not found', metadata: null }))
        }
        const tokens = tokenize(stringToList(result[1]))(path)
        return pure(parseFromTokens(tokens))
    })

/** @type {(path: string) => (parseModuleResult: Result<AstModule, ParseError>) => (context: ParseContext) => Effect<ReadFile, ParseContext>} */
const transpileWithImports = path => parseModuleResult => context => {
    if (parseModuleResult[0] === 'ok') {
        const dir = pathConcat(path)('..')
        const pathsCombine = listMap(pathConcat(dir))(parseModuleResult[1][0])
        const pathsArray = toArray(pathsCombine)
        const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
        const x0 = foldStep(pure(pathsArray), contextWithStack, foldNextModuleOp)
        return step(
            x0,
            contextWithImports => {
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

/** @type {(path: string) => (context: ParseContext) => Effect<ReadFile, ParseContext>} */
const foldNextModuleOp = path => context => {
    if (context.error !== null) {
        return pure(context)
    }

    if (includes(path)(context.stack)) {
        return pure({ ...context, error: { message: 'circular dependency', metadata: null } })
    }

    if (at(path)(context.complete) !== null) {
        return pure(context)
    }

    return step(
        parseModule(path),
        parseModuleResult => transpileWithImports(path)(parseModuleResult)(context))
}

/**
 * Transpiles a DJS module graph rooted at `path` into a single `Unknown` value.
 *
 * Reads each file via the `ReadFile` effect, resolves imports recursively, and
 * evaluates the AST. Returns `['ok', value]` on success, or `['error', ParseError]`
 * on a parse failure or circular dependency.
 *
 * @type {(path: string) => Effect<ReadFile, Result<Unknown, ParseError>>}
 */
export const transpile = path => step(
    foldNextModuleOp(path)({ stack: null, complete: null, error: null }),
    /** @type {(context: ParseContext) => Effect<ReadFile, Result<Unknown, ParseError>>} */
    (context) => {
        if (context.error !== null) {
            return pure(error(context.error))
        }
        const result = at(path)(context.complete)?.djs
        return pure(ok(result))
    })

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    throw: {
        // `mapDjs` is only ever called with an import path that `foldNextModuleOp`
        // has already resolved into `context.complete`, so the `res === null`
        // guard is an internal-invariant check unreachable through `transpile`'s
        // public API. Call it directly with an empty `complete` map to cover it.
        mapDjsUnresolvedImport: () => mapDjs({ complete: null, stack: null, error: null })('missing.djs'),
    },
}
