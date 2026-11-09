/**
 * Reuse exact successes and publish new manifests after isolated coverage passes.
 * Cache failures are visible but cannot turn successful coverage into failure.
 *
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Command, CoverageCache, Outcome } from './types.ts'
 */

import { foldStep, history, historyStep, mapStep, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { error, errorMessage, log } from '../../../effects/node/module.f.mjs'
import { stringifySorted } from '../../../media/json/module.f.mjs'

/** A failed cache operation is reported while coverage's result is retained.
 * @type {(directory: string, action: string, effect: Effect<NodeOp, unknown, IoChannel>) => Effect<NodeOp, void, IoChannel>}
 */
const bestEffort = (directory, action, effect) => resultStep(effect, ([tag, value]) =>
    tag === 'error' ? error(`CACHE ${directory}: ${action}: ${errorMessage(value)}`) : pureOk(undefined))

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

/** Each target is recorded and synchronized before moving to the next target.
 * @type {(command: Command, cache: CoverageCache, manifests: readonly Unknown[]) => Effect<NodeOp, void, IoChannel>}
 */
const save = (command, cache, manifests) => foldStep(pureOk(manifests), undefined, manifest => () => {
    const recorded = bestEffort(command.directory, 'saving manifest', cache.save(manifest))
    return step(recorded, () => bestEffort(command.directory, 'synchronizing cache', cache.sync()))
})

/** A passing child cannot certify inputs that changed while it ran.
 * @type {(command: Command, cache: CoverageCache, before: readonly Unknown[]) => Effect<NodeOp, void, IoChannel>}
 */
const saveStable = (command, cache, before) => {
    const after = prepare(command, cache)
    return step(after, after => after === null ? pureOk(undefined)
        : stringifySorted(before) !== stringifySorted(after)
            ? error(`UNCACHED ${command.directory}: coverage inputs changed during the run`)
            : save(command, cache, after))
}

/**
 * Run uncached when preparation or lookup is unavailable; save only unchanged
 * manifests after a successful child. A hit also retries pending publication.
 *
 * @type {(command: Command, run: () => Effect<NodeOp, boolean, IoChannel>, cache: CoverageCache | null) => Effect<NodeOp, Outcome, IoChannel>}
 */
export const runCached = (command, run, cache) => {
    if (cache === null) { return mapStep(run(), passed => passed ? 'passed' : 'failed') }
    const prepared = history(prepare(command, cache))
    const found = historyStep(prepared, before => before === null ? pureOk(null) : lookup(command, cache, before))
    /** @type {(hit: boolean | null) => Effect<NodeOp, boolean | 'cached', IoChannel>} */
    const execute = hit => hit === true
        ? mapStep(log(`CACHED ${command.directory}`), () => /** @type {const} */ ('cached'))
        : run()
    const executed = historyStep(found, execute)
    const recorded = historyStep(executed, (outcome, hit, before) => {
        if (outcome === 'cached') { return bestEffort(command.directory, 'synchronizing cache', cache.sync()) }
        return outcome && hit !== null && before !== null ? saveStable(command, cache, before) : pureOk(undefined)
    })
    return mapStep(recorded, ([, outcome]) => outcome === 'cached' ? 'cached' : outcome ? 'passed' : 'failed')
}
