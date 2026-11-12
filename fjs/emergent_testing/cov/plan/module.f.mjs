/**
 * Prepare every directory and look up all entries before running coverage.
 * Execution only validates captured inputs and returns successful entries for
 * the caller's final batch; it never prepares, looks up, saves or synchronizes.
 *
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp } from '../../../effects/node/types.ts'
 * @import { ChildResult, Command, CoverageCache, Planned, RunResult } from './types.ts'
 */

import { foldStep, history, historyStep, mapStep, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { error, errorMessage } from '../../../effects/node/module.f.mjs'

/** Failed admission fails only the directory whose inputs could not be named.
 * @type {(command: Command, cache: CoverageCache) => Effect<NodeOp, Planned, IoChannel>}
 */
const prepare = (command, cache) => resultStep(cache.prepare(command),
    /** @returns {Effect<NodeOp, Planned, IoChannel>} */
    ([tag, value]) =>
    tag === 'error'
        ? mapStep(error(`CACHE ADMISSION ${command.directory}: ${errorMessage(value)}`),
            () => ({ command, entries: null, cached: false, admissionFailed: true }))
        : pureOk({ command, entries: value, cached: false, admissionFailed: false }))

/** Align one lookup result with each directory's complete target entry set.
 * @type {(planned: readonly Planned[], hits: readonly boolean[]) => readonly Planned[]}
 */
const aligned = (planned, hits) => planned.reduce(({ offset, items }, item) => {
    const length = item.entries?.length ?? 0
    return {
        offset: offset + length,
        items: [...items, { ...item, cached: length !== 0 && hits.slice(offset, offset + length).every(hit => hit) }],
    }
}, /** @type {{ readonly offset: number, readonly items: readonly Planned[] }} */ ({ offset: 0, items: [] })).items

/** Refuse all certificates when the batch lookup cannot certify its results.
 * @type {(planned: readonly Planned[], message: string) => Effect<NodeOp, readonly Planned[], IoChannel>}
 */
const unavailable = (planned, message) => mapStep(error(`UNCACHED: ${message}`), () =>
    planned.map(item => ({ ...item, entries: null, cached: false })))

/**
 * Planning is a barrier: all manifests and keys exist before one batch lookup,
 * and its complete result exists before the caller starts the first child.
 * @type {(commands: readonly Command[], cache: CoverageCache | null) => Effect<NodeOp, readonly Planned[], IoChannel>}
 */
export const createPlan = (commands, cache) => {
    if (cache === null) { return pureOk(commands.map(command => ({ command, entries: null, cached: false, admissionFailed: false }))) }
    const prepared = foldStep(pureOk(commands), /** @type {readonly Planned[]} */ ([]), command => planned =>
        mapStep(prepare(command, cache), item => [...planned, item]))
    return step(prepared, planned => {
        const entries = planned.flatMap(item => item.entries ?? [])
        if (entries.length === 0) { return pureOk(planned) }
        return resultStep(cache.lookup(entries), ([tag, hits]) =>
            tag === 'error' ? unavailable(planned, errorMessage(hits))
                : hits.length !== entries.length ? unavailable(planned, 'coverage cache lookup returned an invalid result count')
                    : pureOk(aligned(planned, hits)))
    })
}

/** Recheck captured bytes and resolutions immediately before reuse or recording.
 * @type {(command: Command, cache: CoverageCache) => Effect<NodeOp, boolean, IoChannel>}
 */
const validate = (command, cache) => resultStep(cache.validate(command), ([tag, value]) =>
    tag === 'error'
        ? mapStep(error(`UNCACHED ${command.directory}: ${errorMessage(value)}`), () => false)
        : value ? pureOk(true)
            : mapStep(error(`UNCACHED ${command.directory}: coverage inputs changed since the cache snapshot`), () => false))

/** No certificate is returned for ordinary uncached execution.
 * @type {(run: () => Effect<NodeOp, ChildResult, IoChannel>) => Effect<NodeOp, RunResult, IoChannel>}
 */
const uncached = run => mapStep(run(), ({ passed, duration, start }) => ({ outcome: passed ? 'passed' : 'failed', entries: [], duration, start }))

/** Execute one planned directory without performing cache discovery or writes.
 * @type {(item: Planned, run: () => Effect<NodeOp, ChildResult, IoChannel>, cache: CoverageCache | null) => Effect<NodeOp, RunResult, IoChannel>}
 */
export const runPlanned = (item, run, cache) => {
    const { command, entries, cached, admissionFailed } = item
    if (admissionFailed) { return mapStep(run(), ({ duration, start }) => ({ outcome: 'failed', entries: [], duration, start })) }
    if (cache === null || entries === null || entries.length === 0) { return uncached(run) }
    const validated = history(validate(command, cache))
    const executed = historyStep(validated,
        /** @returns {Effect<NodeOp, ChildResult | 'cached', IoChannel>} */
        valid => valid && cached ? pureOk('cached') : run())
    const accepted = historyStep(executed, (outcome, valid) => outcome !== 'cached' && outcome.passed && valid
        ? mapStep(validate(command, cache), stable => stable ? entries : []) : pureOk([]))
    return mapStep(accepted, ([successful, outcome]) => ({
        outcome: outcome === 'cached' ? 'cached' : outcome.passed ? 'passed' : 'failed',
        entries: successful,
        duration: outcome === 'cached' ? 0 : outcome.duration,
        start: outcome === 'cached' ? null : outcome.start,
    }))
}
