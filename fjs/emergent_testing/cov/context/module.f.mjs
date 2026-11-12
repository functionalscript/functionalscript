/**
 * The local success store, optional remote synchronization, versioned tool
 * identity and dependency inputs for each isolated coverage process.
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { Command, CoverageCache } from '../plan/types.ts'
 * @import { Entry } from '../cache/types.ts'
 */

import { catchStep, foldStep, history, historyStep, mapStep, pureOk, refuse, step } from '../../../effects/module.f.js'
import { error, errorMessage, execFile } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/json/module.f.mjs'
import { join } from '../../../path/module.f.js'
import { open } from '../cache/module.f.mjs'
import { buildGraph, graphManifest, validateGraph } from '../manifest/module.f.mjs'
import { openSync } from '../sync/module.f.mjs'

/** @type {(options: NodeProgramOptions, synchronize: boolean, commands: readonly Command[]) => Effect<NodeOp, CoverageCache, IoChannel>} */
export const openCoverageCache = (options, synchronize, commands) => {
    if ((options.env.NODE_OPTIONS ?? '') !== '') {
        return refuse('ERR_COVERAGE_CACHE')('NODE_OPTIONS can load untracked inputs; running uncached')
    }
    const local = history(open(options))
    const synchronized = historyStep(local, cache => {
        if (!synchronize) { return pureOk(() => pureOk(undefined)) }
        const retry = () => step(openSync(options, cache.root), sync => sync())
        return catchStep(openSync(options, cache.root), problem => mapStep(
            error(`CACHE ${cache.root}: initializing synchronization: ${errorMessage(problem)}`),
            () => retry))
    })
    const runtimePath = join(options.packageRoot, 'fjs/emergent_testing/cov/runtime.mjs')
    const probed = historyStep(synchronized, () => execFile('node', [runtimePath]))
    const runtime = historyStep(probed, ({ stdout }) => {
        const [kind, value] = parse(stdout)
        if (kind !== 'ok' || value === null || typeof value !== 'object' || value instanceof Array) {
            return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime JSON')
        }
        if (typeof value.functionalscript !== 'string' || value.functionalscript.length === 0) {
            return refuse('ERR_COVERAGE_CACHE')('invalid FunctionalScript runtime version')
        }
        return pureOk(value)
    })
    const graphed = historyStep(runtime, (_runtime, _probe, _sync, local) => buildGraph(
        local.root, commands.map(command => command.directory)))
    return mapStep(graphed, ([graph, runtime, _probe, sync, local]) => {
        /** @type {CoverageCache} */
        const cache = {
            root: local.root,
            lookup: local.lookup,
            saveMany: local.saveMany,
            sync,
            prepare: command => {
                const manifests = mapStep(graphManifest(graph, command.directory, command.files, {
                    runtime,
                    coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
                }), base => base.targets.map(file => ({ ...base, module: join(base.directory, file) })))
                return foldStep(manifests, /** @type {readonly Entry[]} */ ([]), manifest => entries =>
                    mapStep(local.prepare(manifest), entry => [...entries, entry]))
            },
            validate: command => validateGraph(graph, command.directory),
        }
        return cache
    })
}
