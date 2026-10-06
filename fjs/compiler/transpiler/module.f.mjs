/**
 * Interpret source modules into represented export objects. Loading establishes
 * each dependency once, in import order, before interpreting its importer.
 * Runtime materialization happens only at the public value-output boundaries.
 *
 * @module
 * @import { Denotation, AstModule } from '../ast/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { EdagValue, Object as ValueObject } from '../../edag/value/types.ts'
 * @import { _ImportSource, _Source } from '../source/types.ts'
 * @import { SourceError, ParseContext } from './types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 */

import { assertOk } from '../../asserts/module.f.mjs'
import { mapOk, ok } from '../../types/result/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { findProperty, read } from '../../edag/value/property/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { unresolved, jsonValue } from '../edag/module.f.mjs'
import { _attributeError, _importSources, _missingExport, _rootSource, _parseJson, _parseModule } from '../source/module.f.mjs'
import { foldStep, history, historyStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'

export { parse } from '../source/module.f.mjs'

/** Read only a dependency already established by the loading walk. @type {(context: ParseContext) => (id: string) => ValueObject} */
const moduleAt = context => id => /** @type {ValueObject} */ (at(id)(context.complete))

/** @type {(id: string, value: ValueObject, context: ParseContext) => ParseContext} */
const completed = (id, value, context) => ({
    complete: setReplace(id)(value)(context.complete),
    stack: drop(1)(context.stack),
})

/** Check a selected export before loading the next dependency. @type {(source: _ImportSource) => (context: ParseContext) => Effect<ReadFile | ResolveFileModule, ParseContext, SourceError>} */
const foldImport = source => context => step(foldModule(source)(context), next =>
    source.name !== null && findProperty(moduleAt(next)(source.id), source.name) === undefined
        ? pureError(_missingExport(source))
        : pureOk(next))

/** @type {(source: _Source, module: AstModule, context: ParseContext) => Effect<ReadFile | ResolveFileModule, ParseContext, SourceError>} */
const interpretModule = (source, module, context) => {
    const { id, path } = source
    const sources = _importSources(source)(module[0])
    const loaded = historyStep(history(sources), imports => foldStep(pureOk(imports), context, foldImport))
    return step(loaded, ([next, imports]) => {
        // An unresolved module selects its imports from complete export
        // objects. Shared imported values keep their established identities.
        const graph = unresolved(module).edag
        const result = memo(assertOk(analysis(graph)))({ args: imports.map(({ id }) => moduleAt(next)(id)) })
        const [kind, value] = result
        return kind === 'error'
            ? pureError({ message: 'module initialization failed', metadata: null, path, thrown: value })
            : pureOk(completed(id, /** @type {ValueObject} */ (value), next))
    })
}

/** Initialize the next source unless this identity is already complete. @type {(source: _Source) => (context: ParseContext) => Effect<ReadFile | ResolveFileModule, ParseContext, SourceError>} */
const foldModule = source => context => {
    const { id, path, json } = source
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return pureError(mismatch) }
    if (includes(id)(context.stack)) { return pureError({ message: 'circular dependency', metadata: null, path }) }
    if (at(id)(context.complete) !== null) { return pureOk(context) }
    const entered = { ...context, stack: { first: id, tail: context.stack } }
    return json
        ? mapStep(_parseJson(path), value => completed(id, ['{}', [[':', 'default', jsonValue(value)]]], entered))
        : step(_parseModule(path), module => interpretModule(source, module, entered))
}

/** Direct JSON is a document; modules yield their complete export object. @type {(source: _Source) => Effect<ReadFile | ResolveFileModule, EdagValue, SourceError>} */
const interpretSource = source => source.json
    ? mapStep(_parseJson(source.path), jsonValue)
    : mapStep(foldModule(source)({ stack: null, complete: null }), context => moduleAt(context)(source.id))

/** Interpret a source without erasing represented functions or thrown values. @type {(path: string) => Effect<ReadFile | ResolveFileModule, EdagValue, SourceError>} */
export const interpret = path => step(_rootSource(path), interpretSource)

/** Materialization refusal is an output diagnostic, separate from initialization. @type {(value: EdagValue) => Result<Denotation, string>} */
const materialize = value => mapOk(value => ({ value }))(toData(value))

/**
 * Materialize the complete module export object, or a direct JSON document.
 * Callable values currently require an unavailable target compile/load boundary
 * and return an output refusal in the inner Result.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Result<Denotation, string>, SourceError>}
 */
export const transpile = path => mapStep(interpret(path), materialize)

/**
 * Select a represented default only after initializing the complete module.
 * Named callable exports therefore do not block function-free data outputs.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Result<Denotation, string>, SourceError>}
 */
export const _transpileDefault = path => step(_rootSource(path), source =>
    mapStep(interpretSource(source), value => materialize(source.json ? value : assertOk(read(ok(value), 'default')))))
