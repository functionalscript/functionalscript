/**
 * @import { NodeOp, NodeProgramOptions, Child } from '../../../effects/node/types.ts'
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Command } from '../plan/types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { encodeScalar } from '../../../basen/base16/module.f.js'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
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

const framework = 'export default 1;'
const runtimePath = '/tool/fjs/emergent_testing/cov/runtime.mjs'
const runtimeLabel = 'fjs/emergent_testing/cov/runtime.mjs'
const runtimeSource = 'export default "runtime";'
const digest = computeSync(sha256)
const frameworkHash = vecToCBase32(digest(u8ListToMaxVecChunksMsb(stringToU8List(framework))))
const runtimeHash = vecToCBase32(digest(u8ListToMaxVecChunksMsb(stringToU8List(runtimeSource))))
const hex = encodeScalar(64)
/** @type {(text: string) => string} */
const fingerprint = text => hex(uint(digest(u8ListToMaxVecChunksMsb(stringToU8List(text)))))
/** @type {(path: string) => string} */
const objectId = path => fingerprint(path).slice(0, 40)
const facts = /** @type {const} */ ({
    node: '26.13.0', versions: { node: '26.13.0', v8: 'actual-v8' }, platform: 'linux', arch: 'x64',
    env: { NODE_OPTIONS: null, NODE_PATH: null, LANG: 'C', LC_ALL: null, TZ: null },
})
const runtime = /** @type {const} */ ({
    ...facts,
    files: ['fjs/framework.mjs', runtimeLabel],
    fingerprints: { 'fjs/framework.mjs': fingerprint(framework), [runtimeLabel]: fingerprint(runtimeSource) },
    resolutions: [
        { name: '/tool/fjs/framework-alias.mjs', id: 'file:///tool/fjs/framework.mjs', path: '/tool/fjs/framework.mjs' },
        { name: runtimePath, id: `file://${runtimePath}`, path: runtimePath },
    ],
    absentScopes: ['/tool/fjs/package.json', '/tool/package.json'],
})

/** @type {Command} */
const command = { directory: '/repo/unit', files: ['module.f.js', 'demo.f.mjs'], args: ['--test'] }
/** @type {Command} */
const other = { directory: '/repo/other', files: ['module.f.js'], args: ['--test'] }

/** @satisfies {Dir} */
const files = {
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
}

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
            const resolve = virtualOperationMap.resolveFileModule(name === '/tool/fjs/framework-alias.mjs' ? '/tool/fjs/framework.mjs' : name, parent)
            return state => {
                const [next, result] = resolve(state)
                const found = assertOk(result)
                return [next, ok(name === runtimePath || name === '/tool/fjs/framework-alias.mjs'
                    ? { ...found, id: `file://${found.path}` } : found)]
            }
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

export const proof = {
    localPreparationAndStorage: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command, other]))
        const cache = assertOk(opened)
        /** @type {readonly string[]} */
        const lines = state.stdout.split('\n')
        assertEq(lines.filter(line => line.startsWith('["node"')).length, 1)
        assertEq(lines.filter(line => line === 'read /repo/unit/module.f.js').length, 1)
        assertEq(lines.filter(line => line === 'read /tool/fjs/framework.mjs').length, 1)
        assertEq(lines.filter(line => line === `read ${runtimePath}`).length, 2)
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
        const [first, second] = [firstEntry.manifest, secondEntry.manifest]
        assert(first !== null && typeof first === 'object' && !(first instanceof Array))
        assert(second !== null && typeof second === 'object' && !(second instanceof Array))
        assertEq(first.module, 'unit/demo.f.mjs')
        assertEq(second.module, 'unit/module.f.js')
        assertStructurallySame(first.contract, {
            runtime: { ...facts, files: { 'fjs/framework.mjs': frameworkHash, [runtimeLabel]: runtimeHash } },
            coverage: { engine: 'node', targets: command.files, lines: 100, branches: 100, functions: 100 },
        })
        assertStructurallySame(first.files, second.files)
        const all = [...entries, ...otherEntries]
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
            ['{}', false], ['{"files":null}', false], ['{"files":[1]}', false],
        ])) {
            const run = partialRun(nodeCommands)(operations(output, fails))
            assertError(run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        }
    },
    malformedRuntimeReceipts: () => {
        for (const value of [
            { ...runtime, fingerprints: null },
            { ...runtime, fingerprints: 1 },
            { ...runtime, fingerprints: [] },
            { ...runtime, fingerprints: { file: 1 } },
            { ...runtime, resolutions: null },
            { ...runtime, absentScopes: null },
            { ...runtime, absentScopes: [1] },
            ...[null, 1, [], {}, { name: 1 }, { name: 'entry', id: 1 }, { name: 'entry', id: 'identity', path: 1 }]
                .map(resolution => ({ ...runtime, resolutions: [resolution] })),
        ]) {
            const run = partialRun(nodeCommands)(operations(JSON.stringify(value)))
            assertError(run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        }
    },
    fingerprintsMustMatchLoadedBytes: () => {
        for (const fingerprints of [
            {},
            { ...runtime.fingerprints, 'fjs/framework.mjs': '0'.repeat(64) },
            { ...runtime.fingerprints, unexpected: fingerprint(framework) },
            { [runtimeLabel]: fingerprint(runtimeSource), wrong: fingerprint(framework) },
        ]) {
            const run = partialRun(nodeCommands)(operations(JSON.stringify({ ...runtime, fingerprints })))
            assertError(run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        }
        const run = partialRun(nodeCommands)(operations())
        const changed = { ...files, tool: { fjs: { ...files.tool.fjs, 'framework.mjs': [utf8('export default 2;')] } } }
        assertError(run({ ...emptyState, root: changed })(openCoverageCache(options, false, [command]))[1])
    },
    initialProbeBytesArePinned: () => {
        const changed = 'export default "changed runtime";'
        const base = operations(JSON.stringify({ ...runtime, fingerprints: { ...runtime.fingerprints, [runtimeLabel]: fingerprint(changed) } }))
        const exec = assertNotNullish(base.execFile)
        const run = partialRun(nodeCommands)({
            ...base,
            execFile: (executable, args) => state => {
                const [next, result] = exec(executable, args)(state)
                return [executable === 'node' ? { ...next, root: { ...files, tool: { fjs: {
                    ...files.tool.fjs, emergent_testing: { cov: { 'runtime.mjs': [utf8(changed)] } },
                } } } } : next, result]
            },
        })
        assertError(run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        const omitted = partialRun(nodeCommands)(operations(JSON.stringify({
            ...runtime, files: ['fjs/framework.mjs'], fingerprints: { 'fjs/framework.mjs': fingerprint(framework) },
        })))
        assertError(omitted({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        const original = operations(JSON.stringify({
            ...runtime, files: ['fjs/framework.mjs'], fingerprints: { 'fjs/framework.mjs': fingerprint(framework) },
        }))
        const resolve = assertNotNullish(original.resolveFileModule)
        const read = assertNotNullish(original.readWhole)
        const unreadable = partialRun(nodeCommands)({
            ...original,
            resolveFileModule: (name, parent) => resolve(name === runtimePath ? '/repo/unit/module.f.js' : name, parent),
            readWhole: path => state => path === '/repo/unit/module.f.js' && state.stdout.includes('["node"')
                ? [state, error(ioError({ code: 'EACCES', message: 'probe target became unreadable' }))]
                : read(path)(state),
        })
        assertError(unreadable({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
    },
    nativeRuntimePathSeparators: () => {
        const nativePath = runtimePath.replaceAll('/', '\\')
        const base = operations(JSON.stringify({ ...runtime, resolutions: runtime.resolutions.map(resolution =>
            resolution.name === runtimePath ? { ...resolution, path: nativePath } : resolution) }))
        const resolve = assertNotNullish(base.resolveFileModule)
        const run = partialRun(nodeCommands)({
            ...base,
            resolveFileModule: (name, parent) => state => {
                const [next, result] = resolve(name, parent)(state)
                const found = assertOk(result)
                return [next, ok(name === runtimePath ? { ...found, path: nativePath } : found)]
            },
        })
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        assertEq(assertOk(run(state)(cache.validate(command))[1]), true)
    },
    runtimeScopesMustRemainAbsent: () => {
        const run = partialRun(nodeCommands)(operations())
        const appeared = { ...files, tool: { ...files.tool, fjs: { ...files.tool.fjs, 'package.json': [utf8('{"type":"module"}')] } } }
        assertError(run({ ...emptyState, root: appeared })(openCoverageCache(options, false, [command]))[1])
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        assertEq(assertOk(run({ ...state, root: appeared })(cache.validate(command))[1]), false)
        const base = operations()
        const read = assertNotNullish(base.readWhole)
        const denied = partialRun(nodeCommands)({
            ...base,
            readWhole: path => path === '/tool/fjs/package.json'
                ? state => [state, error(ioError({ code: 'EACCES', message: 'cannot inspect runtime scope' }))]
                : read(path),
        })
        assertError(denied({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))[1])
        assertEq(assertOk(denied(state)(cache.validate(command))[1]), false)
    },
    runtimeAliasesAreValidatedWithoutAnotherProbe: () => {
        const base = operations()
        const run = partialRun(nodeCommands)(base)
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        const resolve = assertNotNullish(base.resolveFileModule)
        for (const replacement of [
            ok({ id: 'file:///tool/fjs/other.mjs', path: '/tool/fjs/other.mjs' }),
            ok({ id: 'file:///tool/fjs/framework.mjs', path: '/tool/fjs/other.mjs' }),
            error(ioError({ code: 'ENOENT', message: 'runtime alias disappeared' })),
        ]) {
            const retargeted = partialRun(nodeCommands)({
                ...base,
                resolveFileModule: (name, parent) => name === '/tool/fjs/framework-alias.mjs'
                    ? state => [state, replacement] : resolve(name, parent),
            })
            const [next, result] = retargeted(state)(cache.validate(command))
            assertEq(assertOk(result), false)
            /** @type {readonly string[]} */
            const lines = next.stdout.split('\n')
            assertEq(lines.filter(line => line.startsWith('["node"')).length, 1)
        }
    },
    validationDetectsChangedInputs: () => {
        const run = partialRun(nodeCommands)(operations())
        const [state, opened] = run({ ...emptyState, root: files })(openCoverageCache(options, false, [command]))
        const cache = assertOk(opened)
        assertEq(assertOk(run(state)(cache.validate(command))[1]), true)
        const changedRuntime = { ...state, root: { ...files, tool: { ...files.tool, fjs: {
            ...files.tool.fjs, 'framework.mjs': [utf8('export default 2;')],
        } } } }
        assertEq(assertOk(run(changedRuntime)(cache.validate(command))[1]), false)
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
}
