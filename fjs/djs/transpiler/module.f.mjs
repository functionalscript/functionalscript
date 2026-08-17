/**
 * DJS transpiler for transforming parsed trees into JavaScript output.
 *
 * @module
 *
 * @import { Unknown } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstModule } from '../ast/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { ParseContext } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { drop, map as listMap, toArray, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { concat as pathConcat } from '../../path/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { run } from '../ast/module.f.mjs'
import { foldStep, pure, step } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'

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
        return pure(parseFromTokens(tokenize(stringToList(result[1]))(path)))
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

/** @type {(path: string) => Effect<ReadFile, Result<Unknown, ParseError>>} */
const transpileModule = path => step(
    foldNextModuleOp(path)({ stack: null, complete: null, error: null }),
    /** @type {(context: ParseContext) => Effect<ReadFile, Result<Unknown, ParseError>>} */
    (context) => {
        if (context.error !== null) {
            return pure(error(context.error))
        }
        const result = at(path)(context.complete)?.djs
        return pure(ok(result))
    })

/**
 * A JSON document is a value, not a module: it imports nothing and names
 * nothing, so it needs no AST and no evaluation — `fjs/media/json` reads it
 * and the value is the result.
 *
 * That reader reports its errors without a position, so the `ParseError` has
 * no metadata and `fjs/djs`'s `compile` names the file instead of a line and
 * column.
 *
 * @type {(path: string) => Effect<ReadFile, Result<Unknown, ParseError>>}
 */
const transpileJson = path => step(
    readUtf8File(path),
    result => {
        if (result[0] === 'error') {
            return pure(error({ message: 'file not found', metadata: null }))
        }
        const json = jsonParse(result[1])
        return pure(json[0] === 'error'
            ? error({ message: json[1], metadata: null })
            : ok(json[1]))
    })

/**
 * Transpiles the file at `path` into a single `Unknown` value.
 *
 * The extension names its language: a `.json` file is a JSON document, read by
 * `fjs/media/json`, and anything else is a FunctionalScript module, whose
 * imports are resolved recursively — each of them a module too, whatever it is
 * called ([spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)).
 *
 * Returns `['ok', value]` on success, or `['error', ParseError]` on a parse
 * failure, a missing file, or a circular dependency.
 *
 * @type {(path: string) => Effect<ReadFile, Result<Unknown, ParseError>>}
 */
export const transpile = path => path.endsWith('.json')
    ? transpileJson(path)
    : transpileModule(path)

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
