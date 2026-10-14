/**
 * Shared source loading, parsing, import admission and the import walk for the
 * EDAG linker and represented module interpreter. What a module becomes —
 * lowering or initialization — belongs to their callers.
 *
 * @module
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstImport, AstModule } from '../ast/types.ts'
 * @import { _Context, _ImportSource, _Load, _Source } from './types.ts'
 * @import { Operation, Effect } from '../../effects/types.ts'
 * @import { IoChannel, ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 */

import { error } from '../../types/result/module.f.js'
import { tokenize } from '../tokenizer/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { decode as decodeImportPath } from '../../path/import/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, pure, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { errorMessage, isNotFound, readWholeBytes, resolveFileModule } from '../../effects/node/module.f.mjs'
import { fromU8List } from '../../text/utf8/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'

/**
 * An error about a file rather than a token — not found, not UTF-8, a bad
 * import, a cycle: it names the file and has no position. Exported for both
 * linkers, which refuse files too; the `_` says linkage.
 *
 * @type {(path: string) => (message: string) => ParseError}
 */
export const _fileError = path => message => ({ message, metadata: null, path })

/**
 * Reports a read's failure as a `ParseError` naming the file. Both readers
 * want this and neither wants the node channel's vocabulary.
 *
 * Only a missing file is `file not found`; any other failure — a directory, a
 * permission, a runner without the operation — keeps the host's own words, so
 * the error does not send the reader looking for a file that is there.
 *
 * @type {(path: string) => <O extends Operation, T>(e: Effect<O, T, IoChannel>) => Effect<O, T, ParseError>}
 */
const readError = path => e =>
    catchStep(e, err => pureError(_fileError(path)(isNotFound(err) ? 'file not found' : errorMessage(err))))

/**
 * Reads a source — a module, a JSON import or a `.json` input — as UTF-8
 * text, refusing bytes that are not correct UTF-8 rather than decoding them:
 * a lenient decoder turns a raw `FF` in a string into U+00FF where a
 * JavaScript host reads U+FFFD, a different successful value (DESIGN.md §10).
 * `fromU8List` is the checked decoder, answering `null` for a malformed,
 * overlong or surrogate sequence. The check lives here, not in
 * `readUtf8File`, whose other callers take any failed read as absence.
 *
 * The bytes come from `readWholeBytes` rather than `readFile`, whose one `Vec`
 * caps a file at 128 KiB: a generated data module passes that easily.
 *
 * @type {(path: string) => Effect<ReadWhole, string, ParseError>}
 */
const readSource = path => step(
    readError(path)(readWholeBytes(path)),
    bytes => {
        const text = fromU8List(bytes)
        return text === null
            ? pureError(_fileError(path)('not UTF-8 text'))
            : pureOk(text)
    })

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
 * failed — missing file, unreadable, a runner without `readWhole` — the answer
 * a transpiler gives is a `ParseError`, so the node channel is
 * translated once here rather than travelling any further. Exported for the
 * EDAG linker in `../edag`, which reads a module the same way; the `_` says
 * that export is linkage rather than API.
 *
 * @type {(path: string) => Effect<ReadWhole, AstModule, ParseError>}
 */
export const _parseModule = path => step(readSource(path), text => pure(parse(path)(text)))

/**
 * Resolve a root filesystem name or an admitted source import through its host.
 * A null parent denotes a literal CLI path; imports use the parent's identity.
 *
 * @type {(name: string, parent: string | null, json: boolean, path: string) => Effect<ResolveFileModule, _Source, ParseError>}
 */
const sourceAt = (name, parent, json, path) => {
    const located = catchStep(resolveFileModule(name, parent), e =>
        pureError(_fileError(path)(`module resolution failed: ${errorMessage(e)}`)))
    return mapStep(located, location => ({ ...location, json }))
}

/** Root names are filesystem paths, never import specifiers. @type {(path: string) => Effect<ResolveFileModule, _Source, ParseError>} */
export const _rootSource = path => sourceAt(path, null, path.endsWith('.json'), path)

/** @type {(source: _Source) => (imported: AstImport) => (sources: readonly _ImportSource[]) => Effect<ResolveFileModule, readonly _ImportSource[], ParseError>} */
const importSource = ({ id, path }) => ({ specifier, json, name }) => sources =>
    mapStep(sourceAt(specifier, id, json, path), source => [...sources, { ...source, name }])

/**
 * Admit original source spellings before host resolution or dependency loading.
 * Both compiler paths accept portable URL-path spellings. Encoded %3F/%23
 * remain filename characters.
 * The portable segment guard is admission only: the host receives the original
 * specifier and the importer identity, never a prejoined filesystem path.
 *
 * @type {(source: _Source) => (imports: readonly AstImport[]) => Effect<ResolveFileModule, readonly _ImportSource[], ParseError>}
 */
export const _importSources = source => imports => {
    const { path } = source
    const unsupported = imports.find(({ specifier }) =>
        !specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/'))
    if (unsupported !== undefined) {
        return pureError(_fileError(path)(`unsupported import specifier "${unsupported.specifier}": expected ./, ../, or /`))
    }
    const invalid = imports.find(({ specifier }) => decodeImportPath(specifier) === null)
    if (invalid !== undefined) {
        return pureError(_fileError(path)(`invalid module specifier: ${invalid.specifier}`))
    }
    return foldStep(pureOk(imports), [], importSource(source))
}


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
    return _fileError(path)(isJson ? 'a JSON module needs the import attribute with { type: "json" }' : 'only a JSON module is imported with { type: "json" }')
}

/** A missing selected export, shared by the value and EDAG linkers. @type {(source: _ImportSource) => ParseError} */
export const _missingExport = ({ path, name }) => _fileError(path)(`module has no ${name} export`)


/**
 * A JSON document is a value, not a module: it imports nothing and names
 * nothing, so it needs no AST and no evaluation — `fjs/media/json` reads it
 * and the value is the result.
 *
 * That reader reports where it failed as an offset in its message rather
 * than as metadata, so the `ParseError` has none and `fjs/compiler`'s `compile`
 * names the file instead of a line and column. Exported for the EDAG
 * linker, as `_parseModule` is.
 *
 * @type {(path: string) => Effect<ReadWhole, JsonUnknown, ParseError>}
 */
export const _parseJson = path => step(
    readSource(path),
    text => {
        const json = jsonParse(text)
        return pure(json[0] === 'error' ? error(_fileError(path)(json[1])) : json)
    })

/**
 * A module recorded complete under its identity, and the import chain left as
 * it was before the module was entered.
 *
 * @template T
 * @param {string} id
 * @param {_Context<T>} context
 * @returns {(module: T) => readonly [_Context<T>, T]}
 */
const completed = (id, context) => module => [{
    complete: setReplace(id)(module)(context.complete),
    stack: drop(1)(context.stack),
}, module]

/**
 * The walk both compiler paths load a program by, `load` deciding what a
 * module becomes. A source's import attribute is checked before its file's
 * state: a file met before is refused all the same when this import misspells
 * it. A module met again while it is still being entered is a cycle; one
 * already complete is reused as it was, so a diamond of imports joins at one
 * module. Each import's selected export is required, even where nothing uses
 * it, before the next import is loaded, and its absence is reported against
 * the imported file.
 *
 * Exported for the represented interpreter in `../transpiler` and the EDAG
 * linker in `../edag`; the `_` says linkage.
 *
 * @template T
 * @template S
 * @template E
 * @param {_Load<T, S, E>} load
 * @returns {(source: _Source) => (context: _Context<T>) => Effect<ReadWhole | ResolveFileModule, readonly [_Context<T>, T], ParseError | E>}
 */
export const _walk = load => {
    /** @typedef {{ readonly context: _Context<T>, readonly imports: readonly S[] }} Imports the walk so far, and the bindings of the imports loaded so far, in their order */
    /** @type {(source: _ImportSource) => (state: Imports) => Effect<ReadWhole | ResolveFileModule, Imports, ParseError | E>} */
    const walkImport = source => ({ context, imports }) => step(walk(source)(context), ([next, module]) => {
        const selected = load.select(module, source.name)
        return selected === undefined
            ? pureError(_missingExport(source))
            : pureOk({ context: next, imports: [...imports, selected] })
    })
    /** @type {(source: _Source) => (context: _Context<T>) => Effect<ReadWhole | ResolveFileModule, readonly [_Context<T>, T], ParseError | E>} */
    const walk = source => context => {
        const { id, path, json } = source
        const mismatch = _attributeError(source)
        if (mismatch !== null) { return pureError(mismatch) }
        if (includes(id)(context.stack)) { return pureError(_fileError(path)('circular dependency')) }
        const done = at(id)(context.complete)
        if (done !== null) { return pureOk([context, done]) }
        const entered = { ...context, stack: { first: id, tail: context.stack } }
        if (json) { return mapStep(_parseJson(path), value => completed(id, entered)(load.json(value))) }
        const parsed = history(_parseModule(path))
        const loaded = historyStep(parsed, module => foldStep(_importSources(source)(module[0]), { context: entered, imports: [] }, walkImport))
        const initialized = historyStep(loaded, ({ imports }, module) => pure(load.module(source, imports, module)))
        return mapStep(initialized, ([value, { context: next }]) => completed(id, next)(value))
    }
    return walk
}
