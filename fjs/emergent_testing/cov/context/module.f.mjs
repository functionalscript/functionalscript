/**
 * The local success store, optional remote synchronization and complete inputs
 * for each target in an isolated coverage process.
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { CoverageCache } from '../cached/types.ts'
 */

import { catchStep, history, historyStep, mapStep, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { error, errorMessage, execFile, resolveFileModule } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/json/module.f.mjs'
import { join } from '../../../path/module.f.js'
import { open } from '../cache/module.f.mjs'
import { manifest } from '../manifest/module.f.mjs'
import { openSync } from '../sync/module.f.mjs'

/** @type {(options: NodeProgramOptions, synchronize: boolean) => Effect<NodeOp, CoverageCache, IoChannel>} */
export const openCoverageCache = (options, synchronize) => {
    if ((options.env.NODE_OPTIONS ?? '') !== '') {
        return refuse('ERR_COVERAGE_CACHE')('NODE_OPTIONS can load inputs before the coverage runtime probe; running uncached')
    }
    const local = history(open(options))
    const synchronized = historyStep(local, cache => {
        if (!synchronize) { return pureOk(() => pureOk(undefined)) }
        const retry = () => step(openSync(options, cache.root), sync => sync())
        return catchStep(openSync(options, cache.root), problem => mapStep(
            error(`CACHE ${cache.root}: initializing synchronization: ${errorMessage(problem)}`),
            () => retry))
    })
    return mapStep(synchronized, ([sync, local]) => {
        /** @type {CoverageCache} */
        const cache = {
            has: local.has,
            save: local.save,
            sync,
            prepare: command => {
                const probed = history(execFile('node', [join(options.packageRoot, 'fjs/emergent_testing/cov/runtime.mjs')]))
                const runtime = historyStep(probed, ({ stdout }) => {
                    const [kind, value] = parse(stdout)
                    return kind === 'ok' ? pureOk(value) : refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime JSON')
                })
                const resolved = historyStep(runtime, () => resolveFileModule(command.directory, null))
                return step(resolved, ([{ path }, runtime]) => mapStep(manifest(local.root, path, command.files, {
                    runtime,
                    coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
                }), base => base.targets.map(file => ({ ...base, module: join(base.directory, file) }))))
            },
        }
        return cache
    })
}
