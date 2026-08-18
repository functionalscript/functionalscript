/**
 * DJS transpiler for transforming parsed trees into JavaScript output.
 *
 * @module
 *
 * @import { Unknown } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstModule } from '../ast/types.ts'
 * @import { Operation } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/io/types.ts'
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
import { pure } from '../../effects/module.f.mjs'
import { catchStep, foldStep, mapStep, pureError, pureOk, step } from '../../effects/io/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'

/**
 * Reads a file, reporting any failure as the one `ParseError` a caller can act
 * on. Both readers want this and neither wants the node channel's vocabulary.
 *
 * @type {<O extends Operation>(e: Effect<O, string, IoChannel>) => Effect<O, string, ParseError>}
 */
const notFound = e =>
    catchStep(e, () => pureError({ message: 'file not found', metadata: null }))

/** @type {(context: ParseContext) => (path: string) => Unknown} */
const mapDjs = context => path => {
    const res = at(path)(context.complete)
    if (res === null)
    {
        throw 'unexpected behaviour'
    }
    return res.djs
}

/**
 * `catchStep` rather than a branch on the read's `Result`: however the read
 * failed — missing file, unreadable, a runner without `readFile` — the answer
 * a transpiler gives is the same `ParseError`, so the node channel is
 * translated once here rather than travelling any further.
 *
 * @type {(path: string) => Effect<ReadFile, AstModule, ParseError>}
 */
const parseModule = path => step(
    notFound(readUtf8File(path)),
    text => pure(parseFromTokens(tokenize(stringToList(text))(path))))

/** @type {(path: string) => (module: AstModule) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>} */
const transpileWithImports = path => module => context => {
    const dir = pathConcat(path)('..')
    const pathsCombine = listMap(pathConcat(dir))(module[0])
    const pathsArray = toArray(pathsCombine)
    const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
    const x0 = foldStep(pureOk(pathsArray), contextWithStack, foldNextModuleOp)
    return step(
        x0,
        contextWithImports => {
            const args = toArray(listMap(mapDjs(contextWithImports))(pathsCombine))
            const djs = { djs: run(module[1])(args) }
            return pureOk({
                ...contextWithImports,
                stack: drop(1)(contextWithImports.stack),
                complete: setReplace(path)(djs)(contextWithImports.complete),
            })
        })
}

/** @type {(path: string) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>} */
const foldNextModuleOp = path => context => {
    if (includes(path)(context.stack)) {
        return pureError({ message: 'circular dependency', metadata: null })
    }

    if (at(path)(context.complete) !== null) {
        return pureOk(context)
    }

    return step(
        parseModule(path),
        module => transpileWithImports(path)(module)(context))
}

/** @type {(path: string) => Effect<ReadFile, Unknown, ParseError>} */
const transpileModule = path => mapStep(
    foldNextModuleOp(path)({ stack: null, complete: null }),
    context => at(path)(context.complete)?.djs)

/**
 * A JSON document is a value, not a module: it imports nothing and names
 * nothing, so it needs no AST and no evaluation — `fjs/media/json` reads it
 * and the value is the result.
 *
 * That reader reports its errors without a position, so the `ParseError` has
 * no metadata and `fjs/djs`'s `compile` names the file instead of a line and
 * column.
 *
 * @type {(path: string) => Effect<ReadFile, Unknown, ParseError>}
 */
const transpileJson = path => step(
    notFound(readUtf8File(path)),
    text => {
        const json = jsonParse(text)
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
 * called ([spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key)).
 *
 * Returns `['ok', value]` on success, or `['error', ParseError]` on a parse
 * failure, a missing file, or a circular dependency.
 *
 * @type {(path: string) => Effect<ReadFile, Unknown, ParseError>}
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
        mapDjsUnresolvedImport: () => mapDjs({ complete: null, stack: null })('missing.djs'),
    },
}
