/**
 * @import { NodeOp, NodeProgramOptions, Child } from '../../../effects/node/types.ts'
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Command } from '../plan/types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { encodeScalar } from '../../../basen/base16/module.f.js'
import { computeSync, sha256 } from '../../../crypto/sha2/module.f.mjs'
import { ioError, runPure } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { nodeCommands } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListToMaxVecChunksMsb, uint } from '../../../types/bit_vec/module.f.mjs'
import { asNominal } from '../../../types/nominal/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { openCoverageCache } from './module.f.mjs'

/** @type {NodeProgramOptions} */
const options = {
    ...defaultNodeProgramOptions,
    home: '/home', packageRoot: '/tool',
    env: { GIT_AUTHOR_NAME: 'Coverage Writer', GIT_AUTHOR_EMAIL: 'coverage@example.com' },
}

const framework = /** @type {const} */ ('export default 1;')
const runtimePath = /** @type {const} */ ('/tool/fjs/emergent_testing/cov/runtime.mjs')
const runtimeSource = /** @type {const} */ ('export default "runtime";')
const digest = computeSync(sha256)
const hex = encodeScalar(64)
/** @type {(text: string) => string} */
const fingerprint = text => hex(uint(digest(u8ListToMaxVecChunksMsb(stringToU8List(text)))))
/** @type {(path: string) => string} */
const objectId = path => fingerprint(path).slice(0, 40)
const facts = /** @type {const} */ ({
    node: '26.13.0', versions: { node: '26.13.0', v8: 'actual-v8' }, platform: 'linux', arch: 'x64',
    env: { NODE_OPTIONS: null, NODE_PATH: null, LANG: 'C', LC_ALL: null, TZ: null },
})
const runtime = /** @type {const} */ ({ ...facts, functionalscript: '0.58.0' })

/** @type {Command} */
const command = { directory: '/repo/unit', files: ['module.f.js', 'demo.f.mjs'], args: ['--test'] }
/** @type {Command} */
const other = { directory: '/repo/other', files: ['module.f.js'], args: ['--test'] }

/** @satisfies {Dir} */
const files = /** @type {const} */ ({
    repo: {
        '.git': { config: [utf8('[core]\nrepositoryformatversion = 0\n')], objects: { pack: {} } },
        'package.json': [utf8('{"type":"module"}\n')],
        unit: {
            'module.f.js': [utf8('export default 1;')],
            'demo.f.mjs': [utf8('import value from "./module.f.js"; export default value;')],
            'proof.f.mjs': [utf8('import value from "./module.f.js"; export const proof = () => value;')],
        },
        other: { 'module.f.js': [utf8('import value from "../unit/module.f.js"; export default value;')] },
    },
    tool: { fjs: {
        'framework.mjs': [utf8(framework)],
        emergent_testing: { cov: { 'runtime.mjs': [utf8(runtimeSource)] } },
    } },
})

/** Real source snapshots with the Git subprocess protocol held in memory.
 * @param {string} [runtimeOutput]
 * @param {boolean} [runtimeFails]
 * @param {boolean} [syncFails]
 * @param {boolean} [saveFails]
 */
const operations = (runtimeOutput = JSON.stringify(runtime), runtimeFails = false, syncFails = false, saveFails = false) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const result = {
        ...virtualOperationMap,
        execFile: (executable, args, options) => state => {
            /** @type {State} */
            const next = { ...state, stdout: state.stdout + JSON.stringify([executable, args]) + '\n' }
            if (executable === 'node') {
                assertStructurallySame(args, [runtimePath])
                return [next, runtimeFails
                    ? error(ioError({ message: 'runtime unavailable' }))
                    : ok({ stdout: runtimeOutput, stderr: '' })]
            }
            assertEq(executable, 'git')
            if (args[0] === 'rev-parse') {
                return [next, ok({ stdout: args[2] === '--show-toplevel' ? '/repo\n' : '/repo/.git\n', stderr: '' })]
            }
            const stored = state.stdout.split('\n').filter(line => line.startsWith('stored ')).map(line => line.slice(7))
            if (args.includes('for-each-ref')) {
                return [next, ok({ stdout: stored.length === 0 ? '' : `refs/heads/build-cache\u0000${'a'.repeat(40)}\n`, stderr: '' })]
            }
            if (args.includes('ls-tree')) {
                return [next, ok({ stdout: stored.filter((path, index) => stored.indexOf(path) === index).toSorted()
                    .map(path => `100644 blob ${objectId(path)}\t${path}\u0000`).join(''), stderr: '' })]
            }
            if (args.includes('cat-file')) {
                const frames = (options?.stdin ?? '').split('\n').filter(oid => oid !== '').map(oid => {
                    /** @type {string} */
                    const prefix = `blob ${oid} `
                    const line = assertNotNullish(state.stdout.split('\n').findLast(line => line.startsWith(prefix)))
                    const body = line.slice(prefix.length)
                    const separator = body.indexOf(' ')
                    return `${oid} blob ${body.slice(0, separator)}\n${body.slice(separator + 1)}\n`
                }).join('')
                return [next, ok({ stdout: frames, stderr: '' })]
            }
            if (args.includes('GIT_COMMITTER_IDENT')) {
                return [next, ok({ stdout: 'Coverage Writer <coverage@example.com> 0 +0000\n', stderr: '' })]
            }
            if (args.includes('fast-import')) {
                if (saveFails) { return [next, error(ioError({ message: 'batch write unavailable' }))] }
                const lines = (options?.stdin ?? '').split('\n')
                const imported = lines.flatMap((line, index) => {
                    if (!line.startsWith('M ')) { return [] }
                    const path = assertNotNullish(line.split(' ').at(-1))
                    const size = assertNotNullish(lines[index + 1]).slice(5)
                    const payload = assertNotNullish(lines[index + 2])
                    return [`stored ${path}\nblob ${objectId(path)} ${size} ${payload}\n`]
                }).join('')
                return [{ ...next, stdout: next.stdout + imported }, ok({ stdout: '', stderr: '' })]
            }
            assertStructurallySame(args, ['-C', '/repo', 'ls-remote', 'origin', 'refs/heads/build-cache'])
            return [next, syncFails
                ? error(ioError({ message: 'remote unavailable' }))
                : ok({ stdout: '', stderr: '' })]
        },
        readWhole: path => state => {
            const [next, result] = virtualOperationMap.readWhole(path)(state)
            return [{ ...next, stdout: `${next.stdout}read ${path}\n` }, result]
        },
        readdir: (path, options) => state => {
            const [next, result] = virtualOperationMap.readdir(path, options)(state)
            return [{ ...next, stdout: `${next.stdout}directory ${path}\n` }, result]
        },
        resolveFileModule: (name, parent) => {
            assert(!(parent === null && (name === command.directory || name === other.directory)))
            return virtualOperationMap.resolveFileModule(name, parent)
        },
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

export const proof = /** @type {const} */ ({
    localPreparationAndStorage: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command, other]))
        const cache = assertOk(opened)
        /** @type {readonly string[]} */
        const lines = state.stdout.split('\n')
        assertEq(lines.filter(line => line.startsWith('["node"')).length, 1)
        assertEq(lines.filter(line => line === 'read /repo/unit/module.f.js').length, 1)
        assert(!lines.some(line => line.startsWith('read /tool/')))
        assertEq(lines.filter(line => line === 'directory /repo/unit').length, 1)
        const [prepared, result] = run(state)(cache.prepare(command))
        const entries = assertOk(result)
        assertStructurallySame(prepared, state)
        assertStructurallySame(assertOk(assertNotNullish(runPure(cache.prepare(command))[0])), entries)
        const otherEntries = assertOk(assertNotNullish(runPure(cache.prepare(other))[0]))
        assertEq(otherEntries.length, 1)
        assertEq(entries.length, 2)
        const [firstEntry, secondEntry] = entries
        assert(firstEntry.key !== secondEntry.key)
        const [first, second] = /** @type {const} */ ([firstEntry.manifest, secondEntry.manifest])
        assert(first !== null && typeof first === 'object' && !(first instanceof Array))
        assert(second !== null && typeof second === 'object' && !(second instanceof Array))
        assertEq(first.module, 'unit/demo.f.mjs')
        assertEq(second.module, 'unit/module.f.js')
        assertStructurallySame(first.contract, {
            runtime,
            coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
        })
        assertStructurallySame(first.files, second.files)
        const all = /** @type {const} */ ([...entries, ...otherEntries])
        const [looked, miss] = run(prepared)(cache.lookup(all))
        assertStructurallySame(assertOk(miss), [false, false, false])
        const [saved, stored] = run(looked)(cache.saveMany(all))
        assertOk(stored)
        const [checked, hit] = run(saved)(cache.lookup(all))
        assertStructurallySame(assertOk(hit), [true, true, true])
        /** @type {readonly string[]} */
        const commands = checked.stdout.split('\n')
        /** @type {readonly string[]} */
        const previous = saved.stdout.split('\n')
        assertEq(commands.filter(line => line.includes('"ls-tree"')).length - previous.filter(line => line.includes('"ls-tree"')).length, 1)
        assertEq(commands.filter(line => line.includes('"cat-file"')).length - previous.filter(line => line.includes('"cat-file"')).length, 1)
        assertEq(commands.filter(line => line.includes('"fast-import"')).length, 1)
        assertOk(run(checked)(cache.sync())[1])
        assert(!prepared.stdout.includes('ls-remote'))
    },
    synchronizedContext: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, result] = run({ ...emptyState, root: files })(openCoverageCache(options, true, [command]))
        const cache = assertOk(result)
        assert(state.stdout.includes('ls-remote'))
        const [synced, done] = run(state)(cache.sync())
        assertOk(done)
        assert(synced.stdout.includes('fetch'))
        assert(synced.stdout.includes('update-ref'))
    },
    failedSynchronizationRetainsLocalSuccesses: () => {
        const unavailable = partialRun(nodeCommands)(operations(undefined, false, true))
        const [state, result] = unavailable({ ...emptyState, root: files })(openCoverageCache(options, true, [command]))
        const cache = assertOk(result)
        assert(state.stderr.includes('CACHE /repo: initializing synchronization: remote unavailable'))
        const [prepared, entries] = unavailable(state)(cache.prepare(command))
        const [first] = assertOk(entries)
        const [saved, recorded] = unavailable(prepared)(cache.saveMany([first]))
        assertOk(recorded)
        assertStructurallySame(assertOk(unavailable(saved)(cache.lookup([first]))[1]), [true])
        assertError(unavailable(saved)(cache.sync())[1])
        const recovered = partialRun(nodeCommands)(operations())
        const [synchronized, retried] = recovered(saved)(cache.sync())
        assertOk(retried)
        assert(synchronized.stdout.includes('fetch'))
        assertStructurallySame(assertOk(recovered(synchronized)(cache.lookup([first]))[1]), [true])
    },
    failedBatchDoesNotPublishEntries: () => {
        const run = partialRun(nodeCommands)(operations(undefined, false, false, true))
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        const [prepared, result] = run(state)(cache.prepare(command))
        const entries = assertOk(result)
        const [saved, stored] = run(prepared)(cache.saveMany(entries))
        assertError(stored)
        assertStructurallySame(assertOk(run(saved)(cache.lookup(entries))[1]), [false, false])
        assert(!saved.stdout.includes('push'))
    },
    runtimeFailures: () => {
        for (const [output, fails] of /** @type {const} */ ([
            ['not JSON', false], ['', true], ['null', false], ['[]', false], ['1', false],
            ['{}', false], ['{"functionalscript":null}', false],
            ['{"functionalscript":1}', false], ['{"functionalscript":""}', false],
        ])) {
            const run = partialRun(nodeCommands)(operations(output, fails))
            assertError(run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        }
    },
    toolVersionControlsSharedIdentity: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        const entries = assertOk(run(state)(cache.prepare(command))[1])
        const [saved, stored] = run(state)(cache.saveMany(entries))
        assertOk(stored)
        /** @type {State} */
        const changedTool = { ...saved, root: { ...files, tool: { fjs: {
            'framework.mjs': [utf8('export default 2;')],
            emergent_testing: { cov: { 'runtime.mjs': [utf8('changed tool source')] } },
        } } } }
        const [reopened, result] = run(changedTool)(openCoverageCache(options, false, [command]))
        const reused = assertOk(result)
        const unchanged = assertOk(run(reopened)(reused.prepare(command))[1])
        assertStructurallySame(unchanged, entries)
        assertStructurallySame(assertOk(run(reopened)(reused.lookup(unchanged))[1]), [true, true])
        assertEq(assertOk(run(changedTool)(cache.validate(command))[1]), true)
        for (const runtimeChange of /** @type {const} */ ([
            { ...runtime, functionalscript: '0.59.0' },
            { ...runtime, node: 'different-node' },
            { ...runtime, versions: { ...runtime.versions, v8: 'different-v8' } },
            { ...runtime, platform: 'win32' },
            { ...runtime, arch: 'arm64' },
            { ...runtime, env: { ...runtime.env, TZ: 'different-zone' } },
        ])) {
            const changed = partialRun(nodeCommands)(operations(JSON.stringify(runtimeChange)))
            const [next, opened] = changed(saved)(openCoverageCache(options, false, [command]))
            const updated = assertOk(opened)
            const missed = assertOk(changed(next)(updated.prepare(command))[1])
            assert(missed.every((entry, index) => entry.key !== entries[index].key))
            assertStructurallySame(assertOk(changed(next)(updated.lookup(missed))[1]), [false, false])
        }
    },
    validationDetectsChangedInputs: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        assertEq(assertOk(run(state)(cache.validate(command))[1]), true)
        /** @type {State} */
        const changedSource = { ...state, root: { ...files, repo: { ...files.repo, unit: {
            ...files.repo.unit, 'module.f.js': [utf8('export default 2;')],
        } } } }
        assertEq(assertOk(run(changedSource)(cache.validate(command))[1]), false)
    },
    preloadOptionsAreUncached: () => {
        const result = runPure(openCoverageCache({ ...options, env: { NODE_OPTIONS: '--require external-loader' } }, false, [command]))
        const e = assertError(assertNotNullish(result[0]))
        assert(e[0] === 'ioError' && e[1].code === 'ERR_COVERAGE_CACHE')
        const run = partialRun(nodeCommands)(operations())
        assertOk(run({ ...emptyState, root: files })(openCoverageCache({ ...options, env: { ...options.env, NODE_OPTIONS: '' } }, false, [command]))[1])
    },
})
