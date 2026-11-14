/**
 * Export syntax-AST module dependencies without executing or compiling source.
 * @module
 * @import { Effect, IoChannel } from '../effects/types.ts'
 * @import { NodeProgram, ReadWhole, ResolveFileModule, Write } from '../effects/node/types.ts'
 * @import { AstImport } from '../compiler/ast/types.ts'
 * @import { ParseError } from '../compiler/parser/types.ts'
 * @import { _Source } from '../compiler/source/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 * @import { _Checked } from './private.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { allFiles, isAuthored, sourceRoot } from '../dev/module.f.js'
import { join, normalize, parse as pathParts, root as pathRoot } from '../path/module.f.js'
import { readSource, _rootSource, _importSources, _attributeError } from '../compiler/source/module.f.mjs'
import { tokenize } from '../compiler/tokenizer/module.f.mjs'
import { errorLocation, _readImport } from '../compiler/parser/module.f.mjs'
import { parseSyntax } from '../compiler/parser/syntax/module.f.mjs'
import { error as errorLine, errorExit, errorMessage, log, resolveFileModule, writeUtf8File } from '../effects/node/module.f.js'
import { foldStep, history, historyStep, mapStep, pure, pureError, pureOk, resultStep, step } from '../effects/module.f.js'
import { definedEntries } from '../types/object/module.f.js'
import { stringToList } from '../text/utf16/module.f.js'
import { error, mapOk, ok, okList } from '../types/result/module.f.js'

/**
 * Unresolved syntax imports from UTF-8 text already read by the caller.
 * Original specifiers and import attributes are retained for later host
 * resolution. JSON sources have no imports and need neither parsing nor
 * syntax validation.
 *
 * @type {(source: _Source, text: string) => Result<readonly AstImport[], ParseError>}
 */
export const dependencyImports = (source, text) => {
    const { path, json } = source
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return error(mismatch) }
    if (json) { return ok([]) }
    const [tag, module] = parseSyntax(tokenize(stringToList(text))(path))
    if (tag === 'error') { return error(module) }
    return mapOk((/** @type {readonly Omit<AstImport, 'name'>[]} */ records) =>
        records.map(record => ({ ...record, name: null })))(okList(module.imports.map(_readImport)))
}

/** Resolve checked import records through the compiler's host resolver. @type {(source: _Source, imports: readonly AstImport[]) => Effect<ResolveFileModule, readonly _Source[], ParseError>} */
export const resolveDependencies = (source, imports) => _importSources(source)(imports)

/** Derive and resolve imports from already-read UTF-8 source text. @type {(source: _Source, text: string) => Effect<ResolveFileModule, readonly _Source[], ParseError>} */
export const dependenciesFromSource = (source, text) =>
    step(pure(dependencyImports(source, text)), imports => resolveDependencies(source, imports))

/** Read source text once before deriving its syntax dependencies. @type {(source: _Source) => Effect<ReadWhole | ResolveFileModule, readonly _Source[], ParseError>} */
export const dependencies = source => {
    // Data sources and mismatched attributes are answered before any read.
    if (source.json || _attributeError(source) !== null) { return dependenciesFromSource(source, '') }
    return step(readSource(source.path), text => dependenciesFromSource(source, text))
}

/** Visit a module once, recording it before descent so cycles remain graph edges. @type {(source: _Source) => (state: _Checked) => Effect<ReadWhole | ResolveFileModule | Write, _Checked, IoChannel>} */
const visit = source => state => {
    const { id, path } = source
    if (state.seen.includes(id) && _attributeError(source) === null) { return pureOk(state) }
    const entered = { ...state, seen: [...state.seen, id], checked: state.checked + 1 }
    const recorded = resultStep(dependencies(source), ([tag, value]) => {
        if (tag === 'error') {
            return mapStep(errorLine(`${errorLocation(path)(value)} - error: ${value.message}`), () => ({
                state: { ...entered, refused: entered.refused + 1 }, sources: [],
            }))
        }
        return pureOk({
            state: { ...entered, graph: { ...entered.graph, [normalize(path)]: value.map(({ path }) => normalize(path)).filter((path, i, paths) => paths.indexOf(path) === i) } },
            sources: value,
        })
    })
    return step(recorded, ({ state, sources }) => foldStep(pureOk(sources), state, visit))
}

/** Resolve a discovered entry point through the compiler's host resolver. @type {(path: string) => (state: _Checked) => Effect<ReadWhole | ResolveFileModule | Write, _Checked, IoChannel>} */
const checkOne = path => state => {
    return resultStep(_rootSource(path), ([tag, value]) => tag === 'ok'
        ? visit(value)(state)
        : mapStep(errorLine(`${errorLocation(path)(value)} - error: ${value.message}`), () => ({ ...state, checked: state.checked + 1, refused: state.refused + 1 })))
}

/** Express graph paths relative to the output directory; other filesystem roots stay absolute. @type {(base: string, graph: StringMap<readonly string[]>) => StringMap<readonly string[]>} */
export const _relativeGraph = (base, graph) => {
    const baseParts = pathParts(base)
    const baseRoot = pathRoot(base)
    /** @type {(path: string) => string} */
    const relative = path => {
        if (pathRoot(path) !== baseRoot) { return normalize(path) }
        const parts = pathParts(path)
        let common = 0
        while (common < baseParts.length && common < parts.length && baseParts[common] === parts[common]) {
            common += 1
        }
        return [...baseParts.slice(common).map(() => '..'), ...parts.slice(common)].join('/') || '.'
    }
    return Object.fromEntries(definedEntries(graph).map(([path, dependencies]) => [relative(path), dependencies.map(relative)]))
}

/** Scan entry points and write a complete JSON graph only after a successful scan. @type {NodeProgram} */
export const main = ({ args, env }) => {
    if (args.length !== 0) { return errorExit('Usage: fjs deps') }
    const root = sourceRoot(env)
    const files = allFiles(root, isAuthored)
    const results = foldStep(files, { checked: 0, refused: 0, seen: [], graph: {} }, checkOne)
    const reported = historyStep(history(results), ({ checked, refused }) =>
        log(`AST: ${checked - refused} parsed, ${refused} failed, ${checked} total`))
    return resultStep(reported, ([tag, value]) => {
        if (tag === 'error') { return errorExit(errorMessage(value)) }
        const [, { refused, graph }] = value
        if (refused !== 0) { return pureError(1) }
        const written = step(resolveFileModule(root, null), ({ path }) =>
            writeUtf8File(join(root, '_deps.json'), `${JSON.stringify(_relativeGraph(path, graph), null, 2)}\n`))
        return resultStep(written,
            ([tag, value]) => tag === 'error' ? errorExit(errorMessage(value)) : pureOk(0))
    })
}
