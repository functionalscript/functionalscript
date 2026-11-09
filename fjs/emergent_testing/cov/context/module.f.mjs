/**
 * The local success store, optional remote synchronization and complete inputs
 * for each target in an isolated coverage process.
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { Command, CoverageCache } from '../plan/types.ts'
 * @import { Entry } from '../cache/types.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { encodeScalar } from '../../../basen/base16/module.f.js'
import { cBase32ToVec } from '../../../basen/cbase32/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, pureOk, refuse, resultStep, step } from '../../../effects/module.f.mjs'
import { error, errorMessage, execFile, isNotFound, readWholeBytes, resolveFileModule } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/json/module.f.mjs'
import { join, normalize } from '../../../path/module.f.js'
import { uint } from '../../../types/bit_vec/module.f.mjs'
import { sameItems } from '../../../types/list/module.f.js'
import { open } from '../cache/module.f.mjs'
import { buildGraph, graphManifest, validateGraph } from '../manifest/module.f.mjs'
import { openSync } from '../sync/module.f.mjs'

const hex = encodeScalar(64)

/** Missing native package scopes must still be absent, including after a job.
 * @type {(paths: readonly string[]) => Effect<NodeOp, boolean, IoChannel>}
 */
const scopesAbsent = paths => foldStep(pureOk(paths), true, path => valid => resultStep(
    readWholeBytes(path), result => pureOk(valid && result[0] === 'error' && isNotFound(result[1]))))

/** @type {(options: NodeProgramOptions, synchronize: boolean, commands: readonly Command[]) => Effect<NodeOp, CoverageCache, IoChannel>} */
export const openCoverageCache = (options, synchronize, commands) => {
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
    const runtimePath = join(options.packageRoot, 'fjs/emergent_testing/cov/runtime.mjs')
    const resolved = historyStep(synchronized, () => resolveFileModule(runtimePath, null))
    const read = historyStep(resolved, source => readWholeBytes(source.path))
    const pinned = mapStep(read, ([bytes, source, sync, local]) => ({ bytes, source, sync, local }))
    const probed = historyStep(history(pinned), () => execFile('node', [runtimePath]))
    const runtime = historyStep(probed, ({ stdout }) => {
        const [kind, value] = parse(stdout)
        if (kind !== 'ok' || value === null || typeof value !== 'object' || value instanceof Array) {
            return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime JSON')
        }
        const { files, fingerprints, resolutions, absentScopes, ...facts } = value
        if (!(files instanceof Array) || !files.every(file => typeof file === 'string')) {
            return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime file inventory')
        }
        if (fingerprints === null || typeof fingerprints !== 'object' || fingerprints instanceof Array ||
            !Object.values(fingerprints).every(hash => typeof hash === 'string')) {
            return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime fingerprints')
        }
        if (!(resolutions instanceof Array)) { return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime resolutions') }
        if (!(absentScopes instanceof Array) || !absentScopes.every(path => typeof path === 'string')) {
            return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime package scopes')
        }
        /** @type {readonly { readonly name: string, readonly id: string, readonly path: string }[]} */
        let receipts = []
        for (const resolution of resolutions) {
            if (resolution === null || typeof resolution !== 'object' || resolution instanceof Array ||
                typeof resolution.name !== 'string' || typeof resolution.id !== 'string' || typeof resolution.path !== 'string') {
                return refuse('ERR_COVERAGE_CACHE')('invalid coverage runtime resolution')
            }
            receipts = [...receipts, { name: resolution.name, id: resolution.id, path: resolution.path }]
        }
        return pureOk({ facts, files, fingerprints, resolutions: receipts, absentScopes })
    })
    const graphed = historyStep(runtime, (runtime, _probe, { local }) => buildGraph(
        local.root, commands.map(command => command.directory),
        Object.fromEntries(runtime.files.map(file => [file, join(options.packageRoot, file)]))))
    const certified = step(graphed, inputs => {
        const [graph, runtime, _probe, pinned] = inputs
        const matches = Object.keys(runtime.fingerprints).length === runtime.files.length && runtime.files.every(file => {
            const hash = assertNotNullish(cBase32ToVec(assertNotNullish(graph.opaqueFiles[file])))
            return runtime.fingerprints[file] === hex(uint(hash))
        })
        const probe = graph.files[normalize(pinned.source.path)]
        const sameProbe = probe !== undefined && probe[0] === 'ok' && sameItems(probe[1].bytes)(pinned.bytes)
        return matches && sameProbe ? pureOk(inputs) : refuse('ERR_COVERAGE_CACHE')('coverage runtime inputs changed during preparation')
    })
    const scoped = historyStep(certified, (_graph, runtime) => scopesAbsent(runtime.absentScopes))
    return step(scoped, ([absent, graph, runtime, _probe, { sync, local }]) => {
        if (!absent) { return refuse('ERR_COVERAGE_CACHE')('coverage runtime package scopes changed during preparation') }
        const contract = { ...runtime.facts, files: graph.opaqueFiles }
        /** @type {CoverageCache} */
        const cache = {
            root: local.root,
            lookup: local.lookup,
            saveMany: local.saveMany,
            sync,
            prepare: command => {
                const manifests = mapStep(graphManifest(graph, command.directory, command.files, {
                    runtime: contract,
                    coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
                }), base => base.targets.map(file => ({ ...base, module: join(base.directory, file) })))
                return foldStep(manifests, /** @type {readonly Entry[]} */ ([]), manifest => entries =>
                    mapStep(local.prepare(manifest), entry => [...entries, entry]))
            },
            validate: command => {
                const aliases = foldStep(pureOk(runtime.resolutions), true, resolution => valid => catchStep(
                    mapStep(resolveFileModule(resolution.name, null), found => valid && found.id === resolution.id && found.path === resolution.path),
                    () => pureOk(false)))
                const scopes = historyStep(history(validateGraph(graph, command.directory)), () => scopesAbsent(runtime.absentScopes))
                return step(scopes, ([absent, valid]) => absent && valid ? aliases : pureOk(false))
            },
        }
        return pureOk(cache)
    })
}
