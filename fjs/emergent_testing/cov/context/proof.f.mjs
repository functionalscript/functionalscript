/**
 * @import { NodeOp, NodeProgramOptions, Child } from '../../../effects/node/types.ts'
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Command } from '../cached/types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError, runPure } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { nodeCommands } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { asNominal } from '../../../types/nominal/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { openCoverageCache } from './module.f.mjs'

/** @type {NodeProgramOptions} */
const options = {
    ...defaultNodeProgramOptions,
    home: '/home', packageRoot: '/tool',
    env: { GIT_AUTHOR_NAME: 'Coverage Writer', GIT_AUTHOR_EMAIL: 'coverage@example.com' },
}

const runtime = /** @type {const} */ ({
    node: '26.13.0', versions: { node: '26.13.0', v8: 'actual-v8' }, platform: 'linux', arch: 'x64',
    env: { NODE_OPTIONS: null, NODE_PATH: null, LANG: 'C', LC_ALL: null, TZ: null },
    files: { 'fjs/framework.mjs': 'framework-hash' },
})

/** @type {Command} */
const command = { directory: 'unit', files: ['module.f.js', 'demo.f.mjs'], args: ['--test'] }

/** @type {Dir} */
const files = {
    repo: {
        '.git': { config: [utf8('[core]\nrepositoryformatversion = 0\n')], objects: { pack: {} } },
        'package.json': [utf8('{"type":"module"}\n')],
        unit: {
            'module.f.js': [utf8('export default 1;')],
            'demo.f.mjs': [utf8('import value from "./module.f.js"; export default value;')],
            'proof.f.mjs': [utf8('import value from "./module.f.js"; export const proof = () => value;')],
        },
    },
}

/** Real filesystem/CAS operations with only subprocesses and absolute cwd mocked.
 * @param {string} [runtimeOutput]
 * @param {boolean} [runtimeFails]
 * @param {boolean} [syncFails]
 */
const operations = (runtimeOutput = JSON.stringify(runtime), runtimeFails = false, syncFails = false) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const result = {
        ...virtualOperationMap,
        execFile: (executable, args) => state => {
            const next = { ...state, stdout: state.stdout + JSON.stringify([executable, args]) + '\n' }
            if (executable === 'node') {
                assertStructurallySame(args, ['/tool/fjs/emergent_testing/cov/runtime.mjs'])
                return [next, runtimeFails
                    ? error(ioError({ message: 'runtime unavailable' }))
                    : ok({ stdout: runtimeOutput, stderr: '' })]
            }
            assertEq(executable, 'git')
            if (args[0] === 'rev-parse') {
                return [next, ok({ stdout: args[2] === '--show-toplevel' ? '/repo\n' : '/repo/.git\n', stderr: '' })]
            }
            assertStructurallySame(args, ['-C', '/repo', 'ls-remote', 'origin', 'refs/heads/build-cache'])
            return [next, syncFails
                ? error(ioError({ message: 'remote unavailable' }))
                : ok({ stdout: '', stderr: '' })]
        },
        resolveFileModule: (name, parent) => virtualOperationMap.resolveFileModule(
            parent === null && name === 'unit' ? '/repo/unit' : name, parent),
        spawn: (executable, args, opts) => state => {
            assertEq(executable, 'git')
            assertEq(opts.stdio, 'inherit')
            /** @type {Child} */
            const child = asNominal('git')
            return [{ ...state, stdout: state.stdout + JSON.stringify([executable, args]) + '\n' }, ok(child)]
        },
        childWait: () => state => [state, ok(['exited', state.stdout.split('\n').at(-2)?.includes('show-ref') ? 1 : 0])],
    }
    return result
}

export const proof = {
    localPreparationAndStorage: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false))
        const cache = assertOk(opened)
        const [prepared, result] = run(state)(cache.prepare(command))
        const manifests = assertOk(result)
        assertEq(manifests.length, 2)
        const [first, second] = manifests
        assert(first !== null && typeof first === 'object' && !(first instanceof Array))
        assert(second !== null && typeof second === 'object' && !(second instanceof Array))
        assertEq(first.module, 'unit/demo.f.mjs')
        assertEq(second.module, 'unit/module.f.js')
        assertStructurallySame(first.contract, {
            runtime,
            coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
        })
        assertStructurallySame(first.files, second.files)
        const [, miss] = virtual(prepared)(cache.has(first))
        assertEq(assertOk(miss), false)
        const [saved, stored] = virtual(prepared)(cache.saveMany(manifests))
        assertOk(stored)
        const [, hit] = virtual(saved)(cache.has(first))
        assertEq(assertOk(hit), true)
        assertEq(assertOk(virtual(saved)(cache.has(second))[1]), true)
        assertOk(virtual(saved)(cache.sync())[1])
        assert(!prepared.stdout.includes('ls-remote'))
    },
    synchronizedContext: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, result] = run({ ...emptyState, root: files })(openCoverageCache(options, true))
        const cache = assertOk(result)
        assert(state.stdout.includes('ls-remote'))
        const [synced, done] = run(state)(cache.sync())
        assertOk(done)
        assert(synced.stdout.includes('fetch'))
        assert(synced.stdout.includes('update-ref'))
    },
    failedSynchronizationRetainsLocalSuccesses: () => {
        const unavailable = partialRun(nodeCommands)(operations(undefined, false, true))
        const [state, result] = unavailable({ ...emptyState, root: files })(openCoverageCache(options, true))
        const cache = assertOk(result)
        assert(state.stderr.includes('CACHE /repo: initializing synchronization: remote unavailable'))
        const [prepared, manifests] = unavailable(state)(cache.prepare(command))
        const [first] = assertOk(manifests)
        const [saved, recorded] = virtual(prepared)(cache.saveMany([first]))
        assertOk(recorded)
        assertEq(assertOk(virtual(saved)(cache.has(first))[1]), true)
        assertError(unavailable(saved)(cache.sync())[1])
        const recovered = partialRun(nodeCommands)(operations())
        const [synchronized, retried] = recovered(saved)(cache.sync())
        assertOk(retried)
        assert(synchronized.stdout.includes('fetch'))
        assertEq(assertOk(virtual(synchronized)(cache.has(first))[1]), true)
    },
    failedBatchEntryDoesNotDiscardLaterSuccess: () => {
        const run = partialRun(nodeCommands)({
            ...operations(),
            now: () => state => [{ ...state, epochNs: state.epochNs + 1 }, state.epochNs === 0
                ? error(/** @type {const} */ (['notImplemented', 'now'])) : ok(1)],
        })
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false))
        const cache = assertOk(opened)
        const [prepared, result] = run(state)(cache.prepare(command))
        const manifests = assertOk(result)
        const [first, second] = manifests
        const [saved, stored] = run(prepared)(cache.saveMany(manifests))
        assertOk(stored)
        assert(saved.stderr.includes('now'))
        assertEq(assertOk(virtual(saved)(cache.has(first))[1]), false)
        assertEq(assertOk(virtual(saved)(cache.has(second))[1]), true)
        assert(!saved.stdout.includes('push'))
    },
    runtimeFailures: () => {
        for (const [output, fails] of /** @type {const} */ ([['not JSON', false], ['', true]])) {
            const run = partialRun(nodeCommands)(operations(output, fails))
            const [state, result] = run({ ...emptyState, root: files })(openCoverageCache(options, false))
            const cache = assertOk(result)
            assertError(run(state)(cache.prepare(command))[1])
        }
    },
    preloadOptionsAreUncached: () => {
        const result = runPure(openCoverageCache({ ...options, env: { NODE_OPTIONS: '--require external-loader' } }, false))
        const e = assertError(assertNotNullish(result[0]))
        assert(e[0] === 'ioError' && e[1].code === 'ERR_COVERAGE_CACHE')
        const run = partialRun(nodeCommands)(operations())
        assertOk(run({ ...emptyState, root: files })(openCoverageCache({ ...options, env: { ...options.env, NODE_OPTIONS: '' } }, false))[1])
    },
}
