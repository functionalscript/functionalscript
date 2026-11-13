/**
 * Native Git plumbing is a literal-argv boundary here. These proofs model its
 * responses and inspect the complete batch; host proofs exercise real Git.
 * @import { NodeOp, NodeProgramOptions, ExecResult, ExecFileOptions, IoResult } from '../../../effects/node/types.ts'
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Cache, Entry } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError } from '../../../effects/module.f.js'
import { partialRun } from '../../../effects/mock/module.f.js'
import { nodeCommands, readUtf8File } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { open } from './module.f.mjs'

/** @type {NodeProgramOptions} */
const options = { ...defaultNodeProgramOptions, home: '/home' }
/** @type {NodeProgramOptions} */
const explicit = { ...options, env: { GIT_AUTHOR_NAME: 'Coverage Writer', GIT_AUTHOR_EMAIL: 'coverage@example.com' } }
/** @type {Unknown} */
const manifest = { module: 'src/module.f.js', files: { 'src/module.f.js': 'hash', 'src/proof.f.mjs': 'proof' } }
const tip = 'a'.repeat(40)
const other = 'b'.repeat(40)
const baseConfig = /** @type {const} */ ('[core]\nrepositoryformatversion = 0\n')
/** @type {string} */
const authorConfig = `${baseConfig}[user]\nname = Local Writer\nemail = local@example.com\n`
const ident = /** @type {const} */ ('Coverage Writer <coverage@example.com> 0 +0000\n')

/** @type {(stdout?: string, stderr?: string) => IoResult<ExecResult>} */
const reply = (stdout = '', stderr = '') => ok({ stdout, stderr })
const denied = error(ioError({ code: 'EACCES', message: 'permission denied' }))

/** @type {(config?: string, globalConfig?: string) => Dir} */
const repository = (config = authorConfig, globalConfig = '') => ({
    repo: { '.git': { config: [utf8(config)], HEAD: [utf8('ref: refs/heads/main\n')], index: [utf8('source index')] }, 'module.f.js': [utf8('export const value = 1\n')] },
    home: { '.gitconfig': [utf8(globalConfig)] },
})

/** @type {<T>(effect: Effect<NodeOp, T, IoChannel>, replies: readonly IoResult<ExecResult>[], state?: State) => readonly [State, import('../../../types/result/types.ts').Result<T, IoChannel>]} */
const run = (effect, replies, state = { ...emptyState, root: repository() }) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        ...virtualOperationMap,
        execFile: (command, args, options) => state => {
            assertEq(command, 'git')
            const calls = JSON.parse(state.stdout)
            const result = replies[calls.length]
            assert(result !== undefined, args)
            return [{ ...state, stdout: JSON.stringify([...calls, { args, options }]) }, result]
        },
    }
    return partialRun(nodeCommands)(operations)({ ...state, stdout: '[]' })(effect)
}

/** @type {(opts?: NodeProgramOptions, root?: Dir) => readonly [State, Cache]} */
const cacheAt = (opts = options, root = repository()) => {
    const [state, result] = run(open(opts), [reply('/repo\n'), reply('/repo/.git\n')], { ...emptyState, root })
    return [state, assertOk(result)]
}
/** @type {(cache: Cache, value?: Unknown) => Entry} */
const entryOf = (cache, value = manifest) => assertOk(run(cache.prepare(value), [])[1])
/** @type {(entry: Entry, oid?: string) => string} */
const row = (entry, oid = tip) => `100644 blob ${oid}\t${entry.path}\u0000`
/** @type {(entry: Entry, oid?: string) => string} */
const blob = (entry, oid = tip) => `${oid} blob ${entry.byteLength}\n${entry.payload}\n`
/** @type {(id?: string) => IoResult<ExecResult>} */
const ref = (id = tip) => reply(`refs/heads/build-cache\u0000${id}\n`)
/** @type {(state: State, path: string) => string} */
const read = (state, path) => assertOk(virtual(state)(readUtf8File(path))[1])
/** @type {(state: State) => readonly {readonly args: readonly string[], readonly options?: ExecFileOptions}[]} */
const calls = state => JSON.parse(state.stdout)

export const proof = /** @type {const} */ ({
    preparationIsCanonicalAndUnicodeBytesAreCounted: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache, { z: '雪\n😀', a: 1 })
        const b = entryOf(cache, { a: 1, z: '雪\n😀' })
        assertEq(a.key, b.key)
        assertEq(a.path, b.path)
        assertEq(a.payload, '{"a":1,"z":"雪\\n😀"}')
        assertEq(a.byteLength, 23)
        assertEq(a.path, `.cas/${a.key.slice(0, 2)}/${a.key.slice(2, 4)}/${a.key.slice(4)}`)
        assertStructurallySame(a.manifest, { z: '雪\n😀', a: 1 })
    },
    lookupBatchesAllEntriesWithoutAuthor: () => {
        const [state, cache] = cacheAt(options, repository('[broken\n'))
        const a = entryOf(cache)
        const b = entryOf(cache, { revision: 2 })
        const [after, result] = run(cache.lookup([a, b, a]), [ref(), reply(row(a)), reply(blob(a))], state)
        assertStructurallySame(assertOk(result), [true, false, true])
        assertEq(calls(after).length, 3)
        assertStructurallySame(calls(after)[1].args, ['--git-dir', '/repo/.git', 'ls-tree', '-r', '-z', '--full-tree', tip, '--', '.cas'])
        assertEq(calls(after)[1].options?.maxBuffer, 64 * 1024 * 1024)
        assertStructurallySame(calls(after)[2].args, ['--git-dir', '/repo/.git', 'cat-file', '--batch'])
        assertEq(calls(after)[2].options?.stdin, `${tip}\n`)
        assertStructurallySame(after.root, state.root)
        assertEq(read(after, '/repo/.git/HEAD'), 'ref: refs/heads/main\n')
        assertEq(read(after, '/repo/.git/index'), 'source index')
        assertEq(read(after, '/repo/module.f.js'), 'export const value = 1\n')
    },
    emptyAndMissingCaches: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache)
        const [none, empty] = run(cache.lookup([]), [])
        assertStructurallySame(assertOk(empty), [])
        assertEq(calls(none).length, 0)
        const [missing, result] = run(cache.lookup([a]), [reply()])
        assertStructurallySame(assertOk(result), [false])
        assertEq(calls(missing).length, 1)
        const [, sibling] = run(cache.lookup([a]), [reply(`refs/heads/build-cache-extra\u0000${tip}\n`)])
        assertStructurallySame(assertOk(sibling), [false])
        const [, tree] = run(cache.lookup([a]), [ref(), reply()])
        assertStructurallySame(assertOk(tree), [false])
    },
    sha256Repository: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache)
        assertStructurallySame(assertOk(run(cache.lookup([a]), [ref('c'.repeat(64)), reply(row(a, 'd'.repeat(64))), reply(blob(a, 'd'.repeat(64)))])[1]), [true])
        // build-cache is shared with other CAS users; canonical keys of other
        // widths are valid even though coverage's own keys use SHA-256.
        assertStructurallySame(assertOk(run(cache.lookup([a]), [ref(), reply(`100644 blob ${tip}\t.cas/ab/cd/ef\u0000`)])[1]), [false])
    },
    verifiedUnicodeReceiptsAndInvalidBlobs: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache, { message: '雪\n😀' })
        assertStructurallySame(assertOk(run(cache.lookup([a]), [ref(), reply(row(a)), reply(blob(a))])[1]), [true])
        for (const response of /** @type {const} */ ([
            reply(`${tip} missing\n`),
            reply(blob(a).replace(' blob ', ' tree ')),
            reply(blob(a).replace(tip, other)),
            reply(blob(a).replace(`blob ${a.byteLength}`, `blob ${a.byteLength + 1}`)),
            reply(blob(a).replace('雪', '雨')),
            reply(blob(a).slice(0, -1)),
            reply(`${blob(a)}extra`),
            reply(blob(a), 'warning: corrupt object'),
            denied,
        ])) { assertError(run(cache.lookup([a]), [ref(), reply(row(a)), response])[1]) }
    },
    malformedRefs: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache)
        for (const response of /** @type {const} */ ([
            reply('', 'warning: broken ref'),
            reply(`refs/heads/build-cache\u0000${tip}`),
            reply(`refs/heads/build-cache\u0000${tip}\nrefs/heads/build-cache\u0000${other}\n`),
            reply('refs/heads/build-cache\u0000bad\n'),
            reply(`refs/heads/build-cache\u0000${'g'.repeat(40)}\n`),
            reply(`refs/heads/build-cache\u0000${tip}\u0000extra\n`),
            denied,
        ])) { assertError(run(cache.lookup([a]), [response])[1]) }
    },
    malformedTrees: () => {
        const [, cache] = cacheAt()
        const a = entryOf(cache)
        for (const response of /** @type {const} */ ([
            reply('', 'warning'), reply(row(a).slice(0, -1)), denied,
            .../** @type {const} */ ([
                `100644 blob ${tip} ${a.path}\u0000`,
                `100644 blob ${tip} extra\t${a.path}\u0000`,
                `100755 blob ${tip}\t${a.path}\u0000`,
                `100644 tree ${tip}\t${a.path}\u0000`,
                `100644 blob bad\t${a.path}\u0000`,
                '100644 blob\t.cas/ab/cd/ef\u0000',
                `100644 blob ${tip}\tnot-cas\u0000`,
                `100644 blob ${tip}\t.cas/!!/cd/ef\u0000`,
                `100644 blob ${tip}\t.cas/${a.key}\u0000`,
                `${row(a)}\u0000`,
                `100644 blob ${tip}\t${a.path}\textra\u0000`,
            ]).map(text => reply(text)),
        ])) { assertError(run(cache.lookup([a]), [ref(), response])[1]) }
    },
    oneCommitOfAllNewSuccesses: () => {
        const [state, cache] = cacheAt(explicit)
        const a = entryOf(cache)
        const b = entryOf(cache, { message: '雪\n😀' })
        const [after, result] = run(cache.saveMany([a, b, a]), [ref(), reply(), reply(ident), reply()], state)
        assertOk(result)
        const imported = calls(after).at(-1)
        assertStructurallySame(imported?.args, ['--git-dir', '/repo/.git', 'fast-import', '--quiet', '--date-format=raw', '--done'])
        const input = imported?.options?.stdin ?? ''
        assert(input.startsWith('commit refs/heads/build-cache\n'))
        assert(input.includes(`from ${tip}\n`))
        assert(input.includes(`M 100644 inline ${a.path}\ndata ${a.byteLength}\n${a.payload}\n`))
        assert(input.includes(`M 100644 inline ${b.path}\ndata ${b.byteLength}\n${b.payload}\n`))
        assertEq(input.split('M 100644 inline ').length - 1, 2)
        assertEq(input.split('commit refs/heads/build-cache\n').length - 1, 1)
        assert(!input.includes('--force'))
        assertStructurallySame(after.root, state.root)
    },
    coldSaveAndNoOpSaves: () => {
        const [, cache] = cacheAt(explicit)
        const a = entryOf(cache)
        const [cold, result] = run(cache.saveMany([a]), [reply(), reply(ident), reply()])
        assertOk(result)
        assert(!(calls(cold).at(-1)?.options?.stdin ?? '').includes('from '))
        const [empty, nothing] = run(cache.saveMany([]), [])
        assertOk(nothing)
        assertEq(calls(empty).length, 0)
        const [existing, already] = run(cache.saveMany([a, a]), [ref(), reply(row(a))])
        assertOk(already)
        assertEq(calls(existing).length, 2)
    },
    authors: () => {
        const [state, local] = cacheAt()
        const a = entryOf(local)
        const [written, result] = run(local.saveMany([a]), [reply(), reply(ident), reply()], state)
        assertOk(result)
        assert(calls(written)[1].args.includes('user.name=Local Writer'))
        const [globalState, globalCache] = cacheAt(options, repository(baseConfig, '[user]\nname = Global Writer\nemail = global@example.com\n'))
        const [globalWritten, globalResult] = run(globalCache.saveMany([a]), [reply(), reply(ident), reply()], globalState)
        assertOk(globalResult)
        assert(calls(globalWritten)[1].args.includes('user.name=Global Writer'))
        const [explicitState, fromEnv] = cacheAt(explicit, repository(`${baseConfig}[include]\npath = other\n`))
        assertOk(run(fromEnv.saveMany([a]), [reply(), reply(ident), reply()], explicitState)[1])
        const [missingState, missing] = cacheAt(options, repository(baseConfig))
        assertError(run(missing.saveMany([a]), [reply()], missingState)[1])
        for (const env of /** @type {const} */ ([
            { GIT_AUTHOR_NAME: 'Writer' }, { GIT_AUTHOR_EMAIL: 'writer@example.com' },
            { GIT_AUTHOR_NAME: '', GIT_AUTHOR_EMAIL: 'writer@example.com' },
            { GIT_AUTHOR_NAME: 'bad\nname', GIT_AUTHOR_EMAIL: 'writer@example.com' },
        ])) {
            const [s, c] = cacheAt({ ...options, env })
            const failure = assertError(run(c.saveMany([a]), [reply()], s)[1])
            assert(failure[0] === 'ioError' && failure[1].code === 'ERR_COV_AUTHOR')
        }
        for (const response of /** @type {const} */ ([reply(), reply('\n'), reply('unterminated'), reply('bad\nidentity\n'), denied])) {
            assertError(run(fromEnv.saveMany([a]), [reply(), response], explicitState)[1])
        }
    },
    concurrentWriterIsUnioned: () => {
        const [, cache] = cacheAt(explicit)
        const a = entryOf(cache)
        const b = entryOf(cache, { concurrent: true })
        const [after, result] = run(cache.saveMany([a, b]), [ref(), reply(), reply(ident), denied, ref(other), reply(row(b)), reply()])
        assertOk(result)
        const imports = calls(after).filter(call => call.args.includes('fast-import'))
        assertEq(imports.length, 2)
        assert(imports[0].options?.stdin?.includes(`from ${tip}\n`) === true)
        assert(imports[1].options?.stdin?.includes(`from ${other}\n`) === true)
        assert(imports[1].options?.stdin?.includes(a.path) === true)
        assert(!imports[1].options?.stdin?.includes(b.path))
        const [complete, done] = run(cache.saveMany([a]), [ref(), reply(), reply(ident), denied, ref(other), reply(row(a))])
        assertOk(done)
        assertEq(calls(complete).filter(call => call.args.includes('fast-import')).length, 1)
    },
    failedAndBoundedWrites: () => {
        const [, cache] = cacheAt(explicit)
        const a = entryOf(cache)
        assertError(run(cache.saveMany([a]), [ref(), reply(), reply(ident), denied, ref(), reply()])[1])
        assertError(run(cache.saveMany([a]), [ref(), reply(), reply(ident), denied, denied])[1])
        const races = Array.from({ length: 9 }, (_, i) => [ref(String(i + 1).repeat(40)), reply(), denied]).flat()
        const [after, failed] = run(cache.saveMany([a]), [ref(), reply(), reply(ident), denied, ...races])
        assertError(failed)
        assertEq(calls(after).filter(call => call.args.includes('fast-import')).length, 10)
    },
    discovery: () => {
        const [, result] = run(open(options), [reply('/repo with \n a trailing space \n'), reply('/repo/.git\n')])
        assertEq(assertOk(result).root, '/repo with \n a trailing space ')
        for (const output of /** @type {const} */ (['', '\n', '/repo'])) { assertError(run(open(options), [reply(output)])[1]) }
        assertError(run(open(options), [reply('/repo\n'), reply()])[1])
        assertError(run(open(options), [denied])[1])
    },
})
