/**
 * DJS transpiler for transforming parsed trees into JavaScript output.
 *
 * @module
 *
 * @import { Unknown } from '../../media/datajs/types.ts'
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Denotation, Import } from '../ast/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstModule } from '../ast/types.ts'
 * @import { Operation } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { ParseContext } from './types.ts'
 */

import { error } from '../../types/result/module.f.mjs'
import { drop, map as listMap, toArray, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { concat as pathConcat } from '../../path/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { sharing, values } from '../ast/module.f.mjs'
import { catchStep, foldStep, mapStep, pure, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'

/**
 * Reads a file, reporting any failure as the one `ParseError` a caller can act
 * on, naming the file. Both readers want this and neither wants the node
 * channel's vocabulary.
 *
 * @type {(path: string) => <O extends Operation>(e: Effect<O, string, IoChannel>) => Effect<O, string, ParseError>}
 */
const notFound = path => e =>
    catchStep(e, () => pureError({ message: 'file not found', metadata: null, path }))

/** @type {(context: ParseContext) => (path: string) => Denotation} */
const mapDjs = context => path => {
    const res = at(path)(context.complete)
    if (res === null)
    {
        throw 'unexpected behaviour'
    }
    return res
}

/** @type {(context: ParseContext) => (path: string) => Import} */
const importAt = context => path => ({ ...mapDjs(context)(path), id: path })

/** @type {(denotation: Denotation) => Unknown} */
const valueOf = ({ value }) => value

/**
 * The front end over a module's text: the tokenizer over its code units, then
 * the parser, the one composition every reader of a module goes through —
 * `transpile` behind the file system, and the subset-law proof over the
 * DataJS corpus directly — so that a proof of the front end exercises the
 * front end rather than a second assembly of its parts. `path` names the
 * text in the positions an error carries.
 *
 * @type {(path: string) => (text: string) => Result<AstModule, ParseError>}
 */
export const parse = path => text => parseFromTokens(tokenize(stringToList(text))(path))

/**
 * `catchStep` rather than a branch on the read's `Result`: however the read
 * failed — missing file, unreadable, a runner without `readFile` — the answer
 * a transpiler gives is the same `ParseError`, so the node channel is
 * translated once here rather than travelling any further. Exported for the
 * EDAG linker in `../edag`, which reads a module the same way; the `_` says
 * that export is linkage rather than API.
 *
 * @type {(path: string) => Effect<ReadFile, AstModule, ParseError>}
 */
export const _parseModule = path => step(notFound(path)(readUtf8File(path)), text => pure(parse(path)(text)))

/**
 * The path an import names, resolved against the importing module's:
 * `./b.f.js` from `dir/a.f.js` is `dir/b.f.js`. Exported for the EDAG
 * linker, as `_parseModule` is.
 *
 * @type {(path: string) => (specifier: string) => string}
 */
export const _importPath = path => pathConcat(pathConcat(path)('..'))

/**
 * The context once a module's body has run: what it denotes recorded under
 * its path — the last value, and what the sweep says of the graph given
 * every value — and the chain of imports left as it was before the module
 * was entered.
 *
 * @type {(path: string, module: AstModule, imports: readonly Import[], context: ParseContext) => (consts: readonly Unknown[]) => ParseContext}
 */
const done = (path, module, imports, context) => consts => ({
    ...context,
    stack: drop(1)(context.stack),
    complete: setReplace(path)({ value: consts[consts.length - 1], ...sharing(module[1])(imports)(consts) })(context.complete),
})

/** @type {(path: string) => (module: AstModule) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>} */
const transpileWithImports = path => module => context => {
    const pathsCombine = listMap(_importPath(path))(module[0])
    const pathsArray = toArray(pathsCombine)
    const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
    const x0 = foldStep(pureOk(pathsArray), contextWithStack, foldNextModuleOp)
    return step(
        x0,
        contextWithImports => {
            const imports = toArray(listMap(importAt(contextWithImports))(pathsCombine))
            // a body fails on a property read of `null` or `undefined`, as
            // JavaScript throws; the failure has no token, since the value
            // is the module's, not one statement's, and names the module
            const [tag, consts] = values(module[1])(imports.map(valueOf))
            return tag === 'error'
                ? pureError({ message: consts, metadata: null, path })
                : pureOk(done(path, module, imports, contextWithImports)(consts))
        })
}

/** @type {(path: string) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>} */
const foldNextModuleOp = path => context => {
    if (includes(path)(context.stack)) {
        return pureError({ message: 'circular dependency', metadata: null, path })
    }

    if (at(path)(context.complete) !== null) {
        return pureOk(context)
    }

    return step(
        _parseModule(path),
        module => transpileWithImports(path)(module)(context))
}

/** @type {(path: string) => Effect<ReadFile, Denotation, ParseError>} */
const transpileModule = path => mapStep(
    foldNextModuleOp(path)({ stack: null, complete: null }),
    context => mapDjs(context)(path))

/**
 * A JSON document is a value, not a module: it imports nothing and names
 * nothing, so it needs no AST and no evaluation — `fjs/media/json` reads it
 * and the value is the result.
 *
 * That reader reports where it failed as an offset in its message rather
 * than as metadata, so the `ParseError` has none and `fjs/fsc`'s `compile`
 * names the file instead of a line and column. Exported for the EDAG
 * linker, as `_parseModule` is.
 *
 * @type {(path: string) => Effect<ReadFile, JsonUnknown, ParseError>}
 */
export const _parseJson = path => step(
    notFound(path)(readUtf8File(path)),
    text => {
        const json = jsonParse(text)
        return pure(json[0] === 'error' ? error({ message: json[1], metadata: null, path }) : json)
    })

/** A JSON value is a tree, so it shares nothing and reaches no module. @type {(value: JsonUnknown) => Denotation} */
const jsonDenotation = value => ({ value, shared: false, reaches: [] })

/** @type {(path: string) => Effect<ReadFile, Denotation, ParseError>} */
const transpileJson = path => mapStep(_parseJson(path), jsonDenotation)

/**
 * Transpiles the file at `path` into what it denotes: one value, and whether
 * that value's graph has a node two references reach.
 *
 * The extension names its language: a `.json` file is a JSON document, read by
 * `fjs/media/json`, and anything else is a FunctionalScript module, whose
 * imports are resolved recursively — each of them a module too, whatever it is
 * called ([spec: the `__proto__` key](../../../spec/README.md#the-__proto__-key)).
 *
 * Returns `['ok', denotation]` on success, or `['error', ParseError]` on a
 * parse failure, a missing file, or a circular dependency.
 *
 * @type {(path: string) => Effect<ReadFile, Denotation, ParseError>}
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
