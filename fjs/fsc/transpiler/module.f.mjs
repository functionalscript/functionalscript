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
 * @import { AstImport, AstModule } from '../ast/types.ts'
 * @import { _Source } from './types.ts'
 * @import { Operation } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { ParseContext } from './types.ts'
 */

import { error } from '../../types/result/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { decode as decodeImportPath } from '../../path/import/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { _own, sharing, values } from '../ast/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, pure, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { errorMessage, readUtf8File, resolveFileModule } from '../../effects/node/module.f.mjs'

/**
 * Reads a file, reporting any failure as the one `ParseError` a caller can act
 * on, naming the file. Both readers want this and neither wants the node
 * channel's vocabulary.
 *
 * @type {(path: string) => <O extends Operation>(e: Effect<O, string, IoChannel>) => Effect<O, string, ParseError>}
 */
const notFound = path => e =>
    catchStep(e, () => pureError({ message: 'file not found', metadata: null, path }))

/** @type {(context: ParseContext) => (id: string) => Denotation} */
const mapDjs = context => id => {
    const res = at(id)(context.complete)
    if (res === null)
    {
        throw 'unexpected behaviour'
    }
    return res
}

/** A default binding selected from the cached module result. @type {(context: ParseContext) => (id: string) => Import} */
const importAt = context => id => {
    const denotation = mapDjs(context)(id)
    return { ...denotation, value: _own(denotation.value, 'default'), id }
}

/** A JSON value is a tree, so it shares nothing and reaches no module. @type {(value: JsonUnknown) => Denotation} */
const jsonDenotation = value => ({ value, shared: false, reaches: [] })

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
 * Resolve a root filesystem name or an admitted source import through its host.
 * A null parent denotes a literal CLI path; imports use the parent's identity.
 *
 * @type {(name: string, parent: string | null, json: boolean, path: string) => Effect<ResolveFileModule, _Source, ParseError>}
 */
const sourceAt = (name, parent, json, path) => {
    const located = catchStep(resolveFileModule(name, parent), e =>
        pureError({ message: `module resolution failed: ${errorMessage(e)}`, metadata: null, path }))
    return mapStep(located, location => ({ ...location, json }))
}

/** Root names are filesystem paths, never import specifiers. @type {(path: string) => Effect<ResolveFileModule, _Source, ParseError>} */
export const _rootSource = path => sourceAt(path, null, path.endsWith('.json'), path)

/** @type {(source: _Source) => (imported: AstImport) => (sources: readonly _Source[]) => Effect<ResolveFileModule, readonly _Source[], ParseError>} */
const importSource = ({ id, path }) => ({ specifier, json }) => sources =>
    mapStep(sourceAt(specifier, id, json, path), source => [...sources, source])

/**
 * Admit original source spellings before host resolution or dependency loading.
 * Both compiler paths accept portable URL-path spellings. Encoded %3F/%23
 * remain filename characters.
 * The portable segment guard is admission only: the host receives the original
 * specifier and the importer identity, never a prejoined filesystem path.
 *
 * @type {(source: _Source) => (imports: readonly AstImport[]) => Effect<ResolveFileModule, readonly _Source[], ParseError>}
 */
export const _importSources = source => imports => {
    const { path } = source
    const unsupported = imports.find(({ specifier }) =>
        !specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/'))
    if (unsupported !== undefined) {
        return pureError({ message: `unsupported import specifier "${unsupported.specifier}": expected ./, ../, or /`, metadata: null, path })
    }
    const invalid = imports.find(({ specifier }) => decodeImportPath(specifier) === null)
    if (invalid !== undefined) {
        return pureError({ message: `invalid module specifier: ${invalid.specifier}`, metadata: null, path })
    }
    return foldStep(pureOk(imports), [], importSource(source))
}

/**
 * The context once a module's body has run: what it denotes recorded under
 * its identity — the last value, and what the sweep says of the graph given
 * every value — and the chain of imports left as it was before the module
 * was entered.
 *
 * @type {(id: string, module: AstModule, imports: readonly Import[], context: ParseContext) => (consts: readonly Unknown[]) => ParseContext}
 */
const done = (id, module, imports, context) => consts => ({
    ...context,
    stack: drop(1)(context.stack),
    complete: setReplace(id)({ value: consts[consts.length - 1], ...sharing(module[1])(imports)(consts) })(context.complete),
})

/**
 * The disagreement between an import's attribute and the file's extension,
 * or `null`. JavaScript refuses a `.json` file imported without
 * `with { type: "json" }`, so that data a program did not declare cannot
 * stand where it expects a module, and any other file imported with it,
 * since the attribute declares a file's type and never reinterprets the
 * file; so does this. Exported for the EDAG linker, which refuses the same
 * way; the `_` says linkage.
 *
 * @type {(source: _Source) => ParseError | null}
 */
export const _attributeError = ({ path, json }) => {
    const isJson = path.endsWith('.json')
    if (json === isJson) { return null }
    const message = isJson ? 'a JSON module needs the import attribute with { type: "json" }' : 'only a JSON module is imported with { type: "json" }'
    return { message, metadata: null, path }
}

/** @type {(source: _Source) => string} */
const idOf = ({ id }) => id

/** @type {(source: _Source) => (module: AstModule) => (context: ParseContext) => Effect<ReadFile | ResolveFileModule, ParseContext, ParseError>} */
const transpileWithImports = source => module => context => {
    const { id, path } = source
    const resolved = _importSources(source)(module[0])
    const contextWithStack = { ...context, stack: { first: id, tail: context.stack } }
    const x0 = historyStep(history(resolved), sources => foldStep(pureOk(sources), contextWithStack, foldNextModuleOp))
    return step(
        x0,
        ([contextWithImports, sources]) => {
            const imports = sources.map(idOf).map(importAt(contextWithImports))
            // a body fails on a property read of `null` or `undefined`, as
            // JavaScript throws; the failure has no token, since the value
            // is the module's, not one statement's, and names the module
            const [tag, consts] = values(module[1])(imports.map(valueOf))
            return tag === 'error'
                ? pureError({ message: consts, metadata: null, path })
                : pureOk(done(id, module, imports, contextWithImports)(consts))
        })
}

/** A JSON module's denotation recorded under its identity. @type {(id: string, context: ParseContext) => (value: JsonUnknown) => ParseContext} */
const jsonDone = (id, context) => value => ({ ...context, complete: setReplace(id)(jsonDenotation({ default: value }))(context.complete) })

/**
 * The next import of a module, or the root: an identity met again while it is
 * being entered is a cycle, one already done is done, a JSON module — its
 * import says so with `with { type: "json" }` — is read as a document, a
 * `.json` file imported without the attribute, or another file imported
 * with it, is refused as JavaScript refuses it, and anything else is parsed
 * as a module and its own imports followed.
 *
 * @type {(source: _Source) => (context: ParseContext) => Effect<ReadFile | ResolveFileModule, ParseContext, ParseError>}
 */
const foldNextModuleOp = source => context => {
    const { id, path, json } = source
    // the import's own contract, checked before the file's state: a file
    // met before is refused all the same when this import misspells it
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return pureError(mismatch) }

    if (includes(id)(context.stack)) {
        return pureError({ message: 'circular dependency', metadata: null, path })
    }

    if (at(id)(context.complete) !== null) {
        return pureOk(context)
    }

    if (json) { return mapStep(_parseJson(path), jsonDone(id, context)) }

    return step(
        _parseModule(path),
        module => transpileWithImports(source)(module)(context))
}

/** @type {(source: _Source) => Effect<ReadFile | ResolveFileModule, Denotation, ParseError>} */
const transpileModule = source => mapStep(
    foldNextModuleOp(source)({ stack: null, complete: null }),
    context => mapDjs(context)(source.id))

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

/** @type {(path: string) => Effect<ReadFile, Denotation, ParseError>} */
const transpileJson = path => mapStep(_parseJson(path), jsonDenotation)

/**
 * Transpiles the file at `path` into its module export object (currently
 * `{ default: value }`), or the document itself for a direct JSON input,
 * and whether that value's graph has a node two references reach.
 *
 * The extension names the root's language: a `.json` file is a JSON
 * document, read by `fjs/media/json`, and anything else is a FunctionalScript
 * module, whose imports are resolved recursively — each of them a module too,
 * whatever it is called, unless its import says `with { type: "json" }`, in
 * which case it is a JSON document, as JavaScript reads one; a `.json` file
 * imported without the attribute is refused, as JavaScript refuses it
 * ([spec: JSON input](../../../spec/README.md#json-input)).
 *
 * Returns `['ok', denotation]` on success, or `['error', ParseError]` on a
 * parse failure, a missing file, or a circular dependency.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Denotation, ParseError>}
 */
export const transpile = path => step(_rootSource(path), source => source.json
    ? transpileJson(source.path)
    : transpileModule(source))

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    throw: {
        // `mapDjs` is only ever called with an identity that `foldNextModuleOp`
        // has already resolved into `context.complete`, so the `res === null`
        // guard is an internal-invariant check unreachable through `transpile`'s
        // public API. Call it directly with an empty `complete` map to cover it.
        mapDjsUnresolvedImport: () => mapDjs({ complete: null, stack: null })('missing.djs'),
    },
}
