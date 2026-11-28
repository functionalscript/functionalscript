/**
 * Interpret source modules into represented export objects. Loading establishes
 * each dependency once, in import order, before interpreting its importer.
 * Runtime materialization happens only at the public value-output boundaries.
 *
 * Every module is precomputed as it completes
 * ([`edag/precompute`](../../edag/precompute/module.f.js)): its export
 * object is answered with what its functions compute the same way in every
 * call already computed, so an importer's initializer runs over them, and
 * the values answered are carried from one module to the next, so none is
 * walked twice.
 *
 * @module
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unknown } from '../../media/datajs/types.ts'
 * @import { EdagValue, Object as ValueObject, Runtime } from '../../edag/value/types.ts'
 * @import { CompileValue } from '../../edag/value/to_unknown/types.ts'
 * @import { _Load } from '../source/types.ts'
 * @import { RefMap } from '../../types/ref_map/types.ts'
 * @import { InitializationError, SourceError } from './types.ts'
 * @import { RuntimeLoad } from '../types.ts'
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 */

import { assertOk } from '../../asserts/module.f.js'
import { isArray } from '../../types/array/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { findProperty, read } from '../../edag/value/property/module.f.js'
import { toData, toUnknown } from '../../edag/value/to_unknown/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.js'
import { memo } from '../../edag/memo/module.f.js'
import { precomputeOver } from '../../edag/precompute/module.f.js'
import { empty as none } from '../../types/ref_map/module.f.js'
import { tryUnresolved } from '../edag/module.f.js'
import { _fileError, _jsonModule, _program, parse as sourceParse } from '../source/module.f.js'
import { mapStep, pureError, pureOk, resultStep, step } from '../../effects/module.f.js'

export const parse = sourceParse

/**
 * How many nodes the closed nodes of one function may take to evaluate
 * when a module is precomputed. A count and not a time, so that a module
 * precomputes to the same value on every machine.
 */
const steps = /** @type {number} */ (100_000)

/** The values precomputed up to a module, or none before the first. @type {(previous: readonly [ValueObject, RefMap] | null) => RefMap} */
const answered = previous => previous === null ? none : previous[1]

/**
 * What the interpreter makes of a module under `runtime`: its complete export
 * object, initialized over its imports' complete export objects and then
 * precomputed, with the values precomputed so far. A module's graph selects
 * each import's export itself; `select` only requires it.
 *
 * @type {(runtime: Runtime | undefined) => _Load<readonly [ValueObject, RefMap], ValueObject, SourceError>}
 */
const interpreting = runtime => ({
    json: (value, previous) => [_jsonModule(value), answered(previous)],
    select: ([module], name) => name === null || findProperty(module, name) !== undefined ? module : undefined,
    module: ({ path }, imports, module, previous) => {
        // An unresolved module selects its imports from complete export
        // objects. Shared imported values keep their established identities.
        const converted = tryUnresolved(module)
        if (converted[0] === 'error') { return error(_fileError(path)(converted[1])) }
        const graph = converted[1].edag
        const [kind, value] = memo(assertOk(identityAnalysis(graph)))({ args: imports, runtime })
        // What a module throws is as much its result as what it exports.
        const [done, result] = precomputeOver(runtime, steps)(answered(previous), value)
        if (kind === 'error') { return error({ message: 'module initialization failed', metadata: null, path, thrown: result }) }
        return ok([/** @type {ValueObject} */ (result), done])
    },
})

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
 * package's runtime, `packageRuntime` in [`compiler`](../module.f.js), a
 * runtime it holds as `pureOk(runtime)`, or {@link noRuntime}. A module
 * yields its complete export object; a `.json` root is a document and yields
 * its value, and never loads the runtime (`_program` in `../source`).
 *
 * @type {(load: RuntimeLoad) => (path: string) => Effect<ReadWhole | ResolveFileModule, EdagValue, SourceError>}
 */
export const interpret = load => _program(mapStep(load, interpreting), ([module]) => module)

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
export const _transpileDefault = load => path => mapStep(
    _program(mapStep(load, interpreting), ([module]) => assertOk(read(ok(module), 'default')))(path),
    toData)
