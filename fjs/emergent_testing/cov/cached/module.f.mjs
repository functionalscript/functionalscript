/**
 * Reuse exact successes and return unchanged successful inputs for a later batch.
 * No manifest is written or synchronized while module coverage is running.
 *
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Command, CoverageCache, RunResult } from './types.ts'
 */

import { foldStep, history, historyStep, mapStep, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { error, errorMessage } from '../../../effects/node/module.f.mjs'

/** A graph that cannot be completely fingerprinted never participates in reuse.
 * @type {(command: Command, cache: CoverageCache) => Effect<NodeOp, readonly Unknown[] | null, IoChannel>}
 */
const prepare = (command, cache) => resultStep(cache.prepare(command), ([tag, value]) =>
    tag === 'error'
        ? mapStep(error(`UNCACHED ${command.directory}: ${errorMessage(value)}`), () => null)
        : pureOk(value))

/** Every target needs an exact successful manifest before the child can be skipped.
 * @type {(command: Command, cache: CoverageCache, manifests: readonly Unknown[]) => Effect<NodeOp, boolean | null, IoChannel>}
 */
const lookup = (command, cache, manifests) => {
    const checked = foldStep(pureOk(manifests), true, manifest => all =>
        mapStep(cache.has(manifest), hit => all && hit))
    return resultStep(checked, ([tag, value]) => tag === 'error'
        ? mapStep(error(`UNCACHED ${command.directory}: ${errorMessage(value)}`), () => null)
        : pureOk(value))
}

/** Recheck the captured bytes and resolutions before trusting or recording a hit.
 * @type {(command: Command, cache: CoverageCache) => Effect<NodeOp, boolean, IoChannel>}
 */
const validate = (command, cache) => resultStep(cache.validate(command), ([tag, value]) =>
    tag === 'error'
        ? mapStep(error(`UNCACHED ${command.directory}: ${errorMessage(value)}`), () => false)
        : value ? pureOk(true)
            : mapStep(error(`UNCACHED ${command.directory}: coverage inputs changed since the cache snapshot`), () => false))

/**
 * Run uncached when preparation or lookup is unavailable. Return only unchanged
 * manifests after a successful child; the caller records all successes at end.
 *
 * @type {(command: Command, run: () => Effect<NodeOp, boolean, IoChannel>, cache: CoverageCache | null) => Effect<NodeOp, RunResult, IoChannel>}
 */
export const runCached = (command, run, cache) => {
    if (cache === null) { return mapStep(run(), passed => ({ outcome: passed ? 'passed' : 'failed', manifests: [] })) }
    const prepared = prepare(command, cache)
    const validated = step(prepared, before => before === null ? pureOk(null)
        : mapStep(validate(command, cache), valid => valid ? before : null))
    const found = historyStep(history(validated), before => before === null ? pureOk(null) : lookup(command, cache, before))
    /** @type {(hit: boolean | null) => Effect<NodeOp, boolean | 'cached', IoChannel>} */
    const execute = hit => hit === true
        ? pureOk('cached')
        : run()
    const executed = historyStep(found, execute)
    const accepted = historyStep(executed, (outcome, hit, before) =>
        outcome === true && hit !== null && before !== null
            ? mapStep(validate(command, cache), valid => valid ? before : []) : pureOk([]))
    return mapStep(accepted, ([manifests, outcome]) => ({
        outcome: outcome === 'cached' ? 'cached' : outcome ? 'passed' : 'failed',
        manifests,
    }))
}
