/**
 * Interpret source modules into represented export objects. Loading establishes
 * each dependency once, in import order, before interpreting its importer.
 * Runtime materialization happens only at the public value-output boundaries.
 *
 * @module
 * @import { AstModule } from '../ast/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 * @import { EdagValue, Object as ValueObject, Runtime } from '../../edag/value/types.ts'
 * @import { CompileValue } from '../../edag/value/to_unknown/types.ts'
 * @import { _ImportSource, _Source } from '../source/types.ts'
 * @import { SourceError, ParseContext } from './types.ts'
 * @import { RuntimeLoad } from '../types.ts'
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 */

import { assertOk } from '../../asserts/module.f.mjs'
import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { drop, includes } from '../../types/list/module.f.mjs'
import { setReplace, at } from '../../types/ordered_map/module.f.mjs'
import { findProperty, read } from '../../edag/value/property/module.f.mjs'
import { toData, toUnknown } from '../../edag/value/to_unknown/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { unresolved, jsonValue } from '../edag/module.f.mjs'
import { _attributeError, _fileError, _importSources, _missingExport, _rootSource, _parseJson, _parseModule } from '../source/module.f.mjs'
import { foldStep, history, historyStep, mapStep, pureError, pureOk, resultStep, step } from '../../effects/module.f.mjs'

export { parse } from '../source/module.f.mjs'

/** Read only a dependency already established by the loading walk. @type {(context: ParseContext) => (id: string) => ValueObject} */
const moduleAt = context => id => /** @type {ValueObject} */ (at(id)(context.complete))

/** @type {(id: string, value: ValueObject, context: ParseContext) => ParseContext} */
const completed = (id, value, context) => ({
    complete: setReplace(id)(value)(context.complete),
    stack: drop(1)(context.stack),
    runtime: context.runtime,
})

/** Check a selected export before loading the next dependency. @type {(source: _ImportSource) => (context: ParseContext) => Effect<ReadWhole | ResolveFileModule, ParseContext, SourceError>} */
const foldImport = source => context => step(foldModule(source)(context), next =>
    source.name !== null && findProperty(moduleAt(next)(source.id), source.name) === undefined
        ? pureError(_missingExport(source))
        : pureOk(next))

/** @type {(source: _Source, module: AstModule, context: ParseContext) => Effect<ReadWhole | ResolveFileModule, ParseContext, SourceError>} */
const interpretModule = (source, module, context) => {
    const { id, path } = source
    const sources = _importSources(source)(module[0])
    const loaded = historyStep(history(sources), imports => foldStep(pureOk(imports), context, foldImport))
    return step(loaded, ([next, imports]) => {
        // An unresolved module selects its imports from complete export
        // objects. Shared imported values keep their established identities.
        const graph = unresolved(module).edag
        const result = memo(assertOk(analysis(graph)))({ args: imports.map(({ id }) => moduleAt(next)(id)), runtime: context.runtime })
        const [kind, value] = result
        return kind === 'error'
            ? pureError({ ..._fileError(path)('module initialization failed'), thrown: value })
            : pureOk(completed(id, /** @type {ValueObject} */ (value), next))
    })
}

/** Initialize the next source unless this identity is already complete. @type {(source: _Source) => (context: ParseContext) => Effect<ReadWhole | ResolveFileModule, ParseContext, SourceError>} */
const foldModule = source => context => {
    const { id, path, json } = source
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return pureError(mismatch) }
    if (includes(id)(context.stack)) { return pureError(_fileError(path)('circular dependency')) }
    if (at(id)(context.complete) !== null) { return pureOk(context) }
    const entered = { ...context, stack: { first: id, tail: context.stack } }
    return json
        ? mapStep(_parseJson(path), value => completed(id, ['{}', [[':', 'default', jsonValue(value)]]], entered))
        : step(_parseModule(path), module => interpretModule(source, module, entered))
}

/** Direct JSON is a document; modules yield their complete export object. @type {(runtime: Runtime | undefined) => (source: _Source) => Effect<ReadWhole | ResolveFileModule, EdagValue, SourceError>} */
const interpretSource = runtime => source => source.json
    ? mapStep(_parseJson(source.path), jsonValue)
    : mapStep(foldModule(source)({ stack: null, complete: null, runtime }), context => moduleAt(context)(source.id))

/**
 * A source under the runtime `load` answers, run once the source is known
 * to be a module, so a JSON document never loads one.
 *
 * @type {(load: RuntimeLoad) => (source: _Source) => Effect<ReadWhole | ResolveFileModule, EdagValue, SourceError>}
 */
const interpretLoaded = load => source => source.json
    ? interpretSource(undefined)(source)
    : step(load, runtime => interpretSource(runtime)(source))

/**
 * No runtime: for a caller that compiles code outputs alone, which
 * interpret nothing, as the generators do, or whose modules call no member
 * function only the runtime answers. Under it such a call fails the
 * module's initialization.
 *
 * @type {RuntimeLoad}
 */
export const noRuntime = pureOk(undefined)

/**
 * Interpret a source without erasing represented functions or thrown
 * values, every module's initialization under the runtime `load` answers:
 * the bodies of [`fjs/js/runtime`](../../js/runtime/module.f.js) answer
 * the member functions the interpreter has no native implementation of
 * ([`edag/memo/types.ts`](../../edag/memo/types.ts)). A caller passes the
 * package's runtime, `packageRuntime` in [`compiler`](../module.f.mjs), a
 * runtime it holds as `pureOk(runtime)`, or {@link noRuntime}.
 *
 * @type {(load: RuntimeLoad) => (path: string) => Effect<ReadWhole | ResolveFileModule, EdagValue, SourceError>}
 */
export const interpret = load => path => step(_rootSource(path), interpretLoaded(load))

/**
 * The runtime at `path`, `fjs/js/runtime`'s source or a stand-in for it:
 * its `runtime` export, as an executor takes it, interpreted under no
 * runtime, since the module's own initialization calls no member function.
 * A source the interpreter cannot load is that failure; one exporting no
 * `runtime` object is a failure naming the file.
 *
 * @type {(path: string) => Effect<ReadWhole | ResolveFileModule, Runtime, SourceError>}
 */
export const runtimeAt = path => resultStep(interpret(noRuntime)(path), result => {
    const [kind, value] = result
    if (kind === 'error') { return pureError(value) }
    const [exportKind, runtime] = read(ok(value), 'runtime')
    return exportKind === 'ok' && isArray(runtime) && runtime[0] === '{}'
        ? pureOk(runtime)
        : pureError(_fileError(path)('no runtime export'))
})

/**
 * Compile the complete module export object, or a direct JSON document, into
 * ordinary runtime values, under the runtime `load` answers as
 * {@link interpret} does. Callable graphs request the target's CompileValue
 * operation; its host failures stay separate from source initialization errors.
 *
 * @type {(load: RuntimeLoad) => (path: string) => Effect<ReadWhole | ResolveFileModule | CompileValue, unknown, SourceError | IoChannel>}
 */
export const transpile = load => path => step(interpret(load)(path), toUnknown)

/**
 * Select a represented default only after initializing the complete module
 * under the runtime `load` answers — run once the source is known to be a
 * module, so a JSON document never loads one — then decode data for
 * JSON/DataJS output. Named callable exports do not block data outputs; a
 * selected callable returns an output refusal in the Result.
 *
 * @type {(load: RuntimeLoad) => (path: string) => Effect<ReadWhole | ResolveFileModule, Result<Unknown, string>, SourceError>}
 */
export const _transpileDefault = load => path => step(_rootSource(path), source => mapStep(
    interpretLoaded(load)(source),
    value => toData(source.json ? value : assertOk(read(ok(value), 'default')))))
