/**
 * Shared source loading, parsing and import admission for the EDAG linker and
 * represented module interpreter. Resolution and initialization policy belong
 * to their callers.
 *
 * @module
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { AstImport, AstModule } from '../ast/types.ts'
 * @import { _ImportSource, _Source } from './types.ts'
 * @import { Operation, Effect } from '../../effects/types.ts'
 * @import { IoChannel, ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 */

import { error } from '../../types/result/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { decode as decodeImportPath } from '../../path/import/module.f.mjs'
import { parseFromTokens } from '../parser/module.f.mjs'
import { parse as jsonParse } from '../../media/json/module.f.mjs'
import { catchStep, foldStep, mapStep, pure, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { errorMessage, readFile, resolveFileModule } from '../../effects/node/module.f.mjs'
import { fromVec } from '../../text/utf8/module.f.mjs'

/**
 * An error about a file rather than a token — not found, not UTF-8, a bad
 * import, a cycle: it names the file and has no position. Exported for both
 * linkers, which refuse files too; the `_` says linkage.
 *
 * @type {(path: string) => (message: string) => ParseError}
 */
export const _fileError = path => message => ({ message, metadata: null, path })

/**
 * Reads a file, reporting any failure as the one `ParseError` a caller can act
 * on, naming the file. Both readers want this and neither wants the node
 * channel's vocabulary.
 *
 * @type {(path: string) => <O extends Operation, T>(e: Effect<O, T, IoChannel>) => Effect<O, T, ParseError>}
 */
const notFound = path => e =>
    catchStep(e, () => pureError(_fileError(path)('file not found')))

/**
 * Reads a source — a module, a JSON import or a `.json` input — as UTF-8
 * text, refusing bytes that are not correct UTF-8 rather than decoding them:
 * a lenient decoder turns a raw `FF` in a string into U+00FF where a
 * JavaScript host reads U+FFFD, a different successful value (DESIGN.md §10).
 * `fromVec` is the checked decoder, answering `null` for a malformed,
 * overlong or surrogate sequence. The check lives here, not in
 * `readUtf8File`, whose other callers take any failed read as absence.
 *
 * @type {(path: string) => Effect<ReadFile, string, ParseError>}
 */
const readSource = path => step(
    notFound(path)(readFile(path)),
    bytes => {
        const text = fromVec(bytes)
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
 * failed — missing file, unreadable, a runner without `readFile` — the answer
 * a transpiler gives is the same `ParseError`, so the node channel is
 * translated once here rather than travelling any further. Exported for the
 * EDAG linker in `../edag`, which reads a module the same way; the `_` says
 * that export is linkage rather than API.
 *
 * @type {(path: string) => Effect<ReadFile, AstModule, ParseError>}
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
 * @type {(path: string) => Effect<ReadFile, JsonUnknown, ParseError>}
 */
export const _parseJson = path => step(
    readSource(path),
    text => {
        const json = jsonParse(text)
        return pure(json[0] === 'error' ? error(_fileError(path)(json[1])) : json)
    })
