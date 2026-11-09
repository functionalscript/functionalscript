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
import { stringifySorted } from '../../../media/json/module.f.mjs'

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

/** A passing child cannot certify inputs that changed while it ran.
 * @type {(command: Command, cache: CoverageCache, before: readonly Unknown[]) => Effect<NodeOp, readonly Unknown[], IoChannel>}
 */
const stableManifests = (command, cache, before) => {
    const after = prepare(command, cache)
    return step(after, after => after === null ? pureOk([])
        : stringifySorted(before) !== stringifySorted(after)
            ? mapStep(error(`UNCACHED ${command.directory}: coverage inputs changed during the run`), () => [])
            : pureOk(after))
}

/**
 * Run uncached when preparation or lookup is unavailable. Return only unchanged
 * manifests after a successful child; the caller records all successes at end.
 *
 * @type {(command: Command, run: () => Effect<NodeOp, boolean, IoChannel>, cache: CoverageCache | null) => Effect<NodeOp, RunResult, IoChannel>}
 */
export const runCached = (command, run, cache) => {
    if (cache === null) { return mapStep(run(), passed => ({ outcome: passed ? 'passed' : 'failed', manifests: [] })) }
    const prepared = history(prepare(command, cache))
    const found = historyStep(prepared, before => before === null ? pureOk(null) : lookup(command, cache, before))
    /** @type {(hit: boolean | null) => Effect<NodeOp, boolean | 'cached', IoChannel>} */
    const execute = hit => hit === true
        ? pureOk('cached')
        : run()
    const executed = historyStep(found, execute)
    const accepted = historyStep(executed, (outcome, hit, before) =>
        outcome === true && hit !== null && before !== null ? stableManifests(command, cache, before) : pureOk([]))
    return mapStep(accepted, ([manifests, outcome]) => ({
        outcome: outcome === 'cached' ? 'cached' : outcome ? 'passed' : 'failed',
        manifests,
    }))
}
