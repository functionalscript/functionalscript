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
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsTokenWithMetadata } from '../tokenizer/types.ts'
 * @import { ParseContext } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { drop, map as listMap, toArray, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { concat as pathConcat } from '../../path/module.f.mjs'
import { parseFromTokens, parseJsonFromTokens } from '../parser/module.f.mjs'
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

/** @typedef {(tokens: List<DjsTokenWithMetadata>) => Result<AstModule, ParseError>} _Parse */

/**
 * The reader for the file named on the command line, chosen by its extension
 * the same way `fjs/djs` chooses the writer: a `.json` file is a JSON
 * document, anything else a FunctionalScript module. The two disagree about
 * the `__proto__` key and nothing else
 * ([spec/2480-proto-property-key](../../../spec/2480-proto-property-key.md)).
 *
 * The root is the only file this applies to. What declares an *imported*
 * file's language is the import statement — `with { type: "json" }` — which
 * the language does not have yet
 * ([spec/todo/2140-import-attributes](../../../spec/todo/2140-import-attributes.md)),
 * so an import reads a FunctionalScript module whatever the file is called.
 * Reading it as JSON on the strength of its name would mean a module could
 * pull in a value no JavaScript engine would give it.
 *
 * @type {(path: string) => _Parse}
 */
const parserFor = path => path.endsWith('.json') ? parseJsonFromTokens : parseFromTokens

/** @type {(parse: _Parse) => (path: string) => Effect<ReadFile, Result<AstModule, ParseError>>} */
const parseModule = parse => path => step(
    readUtf8File(path),
    result => {
        if (result[0] === 'error') {
            return pure(error({ message: 'file not found', metadata: null }))
        }
        return pure(parse(tokenize(stringToList(result[1]))(path)))
    })

/** @type {(path: string) => (parseModuleResult: Result<AstModule, ParseError>) => (context: ParseContext) => Effect<ReadFile, ParseContext>} */
const transpileWithImports = path => parseModuleResult => context => {
    if (parseModuleResult[0] === 'ok') {
        const dir = pathConcat(path)('..')
        const pathsCombine = listMap(pathConcat(dir))(parseModuleResult[1][0])
        const pathsArray = toArray(pathsCombine)
        const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
        // Every import is a FunctionalScript module — see `parserFor`.
        const x0 = foldStep(pure(pathsArray), contextWithStack, foldNextModuleOp(parseFromTokens))
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

/** @type {(parse: _Parse) => (path: string) => (context: ParseContext) => Effect<ReadFile, ParseContext>} */
const foldNextModuleOp = parse => path => context => {
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
        parseModule(parse)(path),
        parseModuleResult => transpileWithImports(path)(parseModuleResult)(context))
}

/**
 * Transpiles a DJS module graph rooted at `path` into a single `Unknown` value.
 *
 * Reads each file via the `ReadFile` effect, resolves imports recursively, and
 * evaluates the AST. Returns `['ok', value]` on success, or `['error', ParseError]`
 * on a parse failure or circular dependency.
 *
 * `path` is read in the language its extension names; every file it imports is
 * read as FunctionalScript (`parserFor`).
 *
 * @type {(path: string) => Effect<ReadFile, Result<Unknown, ParseError>>}
 */
export const transpile = path => step(
    foldNextModuleOp(parserFor(path))(path)({ stack: null, complete: null, error: null }),
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
