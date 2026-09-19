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
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { ParseContext } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { drop, map as listMap, toArray, includes } from '../../types/list/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { codePointListToString, stringToCodePointList, stringToList } from '../../text/utf16/module.f.mjs'
import { isValidCodePoint } from '../../text/code_point/module.f.mjs'
import { percentDecode } from '../../text/percent/module.f.mjs'
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

/** A literal URL string replaces lone surrogates; percent-encoded bytes stay strict UTF-8. @type {(c: number) => number} */
const scalarValue = c => isValidCodePoint(c) ? c : 0xfffd

/**
 * One URL-path segment as a portable filesystem segment, or a refusal.
 * Decoded separators and NUL cannot name a segment. Colons are also refused:
 * the current portable path layer would reinterpret drive/stream syntax
 * after joining or normalization. Host-specific colon names need the full
 * resolver; they must not silently become another root here.
 *
 * @type {(segment: string) => string | null}
 */
const importSegment = segment => {
    const literal = codePointListToString(listMap(scalarValue)(stringToCodePointList(segment)))
    const decoded = percentDecode(literal)
    return decoded === null || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0') || decoded.includes(':')
        ? null
        : decoded
}

/**
 * Reduce URL dot segments while the other components are still encoded.
 * Only the URL grammar's exact dot spellings are structural; canceled
 * components need not be valid UTF-8 or valid filesystem names. Keep empty
 * components here: in `bad%//../dep`, `..` removes the empty one, not `bad%`.
 *
 * @type {(rooted: boolean) => (segments: readonly string[], segment: string) => readonly string[]}
 */
const importDotSegments = rooted => (segments, segment) => {
    switch (segment.toLowerCase()) {
        case '.': case '%2e': return segments
        case '..': case '.%2e': case '%2e.': case '%2e%2e':
            return segments.length !== 0 && segments[segments.length - 1] !== '..'
                ? segments.slice(0, -1)
                : rooted ? segments : [...segments, '..']
        default: return [...segments, segment]
    }
}

/**
 * Resolve an import's URL-path spelling against its importing file, or return
 * null for unsupported syntax or a surviving unsupported segment. URL dot
 * processing precedes decoding and filesystem validation, so `bad%/../dep`
 * names `dep`. Decode only the surviving specifier components, once; the
 * importing path is already a filesystem path and is never decoded again.
 *
 * Literal colons, backslashes, query and fragment delimiters remain outside
 * this path-only subset. Reject them before dot processing: suffix text is
 * not a filesystem component and must neither be decoded nor canceled as one.
 * Do not strip suffixes, which would merge distinct module identities.
 * Percent-encoded `?` and `#` are filename data, not URL delimiters.
 * Package resolution and distinct URL identities remain in
 * `../todo/module-resolution-compatibility.md`.
 *
 * @type {(path: string) => (specifier: string) => string | null}
 */
export const _importPath = path => specifier => {
    if (specifier.includes(':') || specifier.includes('\\')
        || specifier.includes('?') || specifier.includes('#')) { return null }
    const rooted = specifier.startsWith('/')
    const raw = specifier.split('/')
    const components = (rooted ? raw.slice(1) : raw).reduce(importDotSegments(rooted), [])
    const segments = components.map(importSegment)
    return segments.every(segment => segment !== null)
        ? pathConcat(pathConcat(path)('..'))(`${rooted ? '/' : ''}${segments.join('/')}`)
        : null
}

/**
 * Resolve all source import records before reading dependencies. Both compiler
 * paths use this boundary, so invalid source becomes a normal ParseError, not
 * an assertion escaping the effect. Import order and JSON attributes survive.
 * Classify the original spelling before decoding or normalizing it: bare
 * names, package subpaths and other non-path forms need host resolution,
 * not a sibling-file fallback. Literal ? and # introduce unsupported URL
 * components; stripping them would merge distinct module identities. Check
 * before percent decoding so %3F and %23 remain filename characters.
 * CLI input paths are not import specifiers.
 *
 * @type {(path: string) => (imports: readonly AstImport[]) => Result<readonly _Source[], ParseError>}
 */
export const _importSources = path => imports => {
    const unsupported = imports.find(({ specifier }) =>
        !specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/'))
    if (unsupported !== undefined) {
        return error({ message: `unsupported import specifier "${unsupported.specifier}": expected ./, ../ or /`, metadata: null, path })
    }
    const components = imports.find(({ specifier }) => specifier.includes('?') || specifier.includes('#'))
    if (components !== undefined) {
        return error({ message: `unsupported import specifier "${components.specifier}": query and fragment components are not supported`, metadata: null, path })
    }
    const paths = imports.map(imported => _importPath(path)(imported.specifier))
    if (paths.every(resolved => resolved !== null)) {
        return ok(paths.map((resolved, i) => ({ path: resolved, json: imports[i].json })))
    }
    const specifier = imports[paths.indexOf(null)].specifier
    return error({ message: `invalid module specifier: ${specifier}`, metadata: null, path })
}

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
const pathOf = ({ path }) => path

/** @type {(path: string) => (module: AstModule) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>} */
const transpileWithImports = path => module => context => {
    const resolved = _importSources(path)(module[0])
    if (resolved[0] === 'error') { return pure(resolved) }
    const sources = resolved[1]
    const contextWithStack = { ...context, stack: { first: path, tail: context.stack } }
    const x0 = foldStep(pureOk(sources), contextWithStack, foldNextModuleOp)
    return step(
        x0,
        contextWithImports => {
            const imports = sources.map(pathOf).map(importAt(contextWithImports))
            // a body fails on a property read of `null` or `undefined`, as
            // JavaScript throws; the failure has no token, since the value
            // is the module's, not one statement's, and names the module
            const [tag, consts] = values(module[1])(imports.map(valueOf))
            return tag === 'error'
                ? pureError({ message: consts, metadata: null, path })
                : pureOk(done(path, module, imports, contextWithImports)(consts))
        })
}

/** A JSON module's denotation recorded under its path. @type {(path: string, context: ParseContext) => (value: JsonUnknown) => ParseContext} */
const jsonDone = (path, context) => value => ({ ...context, complete: setReplace(path)(jsonDenotation(value))(context.complete) })

/**
 * The next import of a module, or the root: a file met again while it is
 * being entered is a cycle, one already done is done, a JSON module — its
 * import says so with `with { type: "json" }` — is read as a document, a
 * `.json` file imported without the attribute, or another file imported
 * with it, is refused as JavaScript refuses it, and anything else is parsed
 * as a module and its own imports followed.
 *
 * @type {(source: _Source) => (context: ParseContext) => Effect<ReadFile, ParseContext, ParseError>}
 */
const foldNextModuleOp = ({ path, json }) => context => {
    // the import's own contract, checked before the file's state: a file
    // met before is refused all the same when this import misspells it
    const mismatch = _attributeError({ path, json })
    if (mismatch !== null) { return pureError(mismatch) }

    if (includes(path)(context.stack)) {
        return pureError({ message: 'circular dependency', metadata: null, path })
    }

    if (at(path)(context.complete) !== null) {
        return pureOk(context)
    }

    if (json) { return mapStep(_parseJson(path), jsonDone(path, context)) }

    return step(
        _parseModule(path),
        module => transpileWithImports(path)(module)(context))
}

/** @type {(path: string) => Effect<ReadFile, Denotation, ParseError>} */
const transpileModule = path => mapStep(
    foldNextModuleOp({ path, json: false })({ stack: null, complete: null }),
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

/** @type {(path: string) => Effect<ReadFile, Denotation, ParseError>} */
const transpileJson = path => mapStep(_parseJson(path), jsonDenotation)

/**
 * Transpiles the file at `path` into what it denotes: one value, and whether
 * that value's graph has a node two references reach.
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
