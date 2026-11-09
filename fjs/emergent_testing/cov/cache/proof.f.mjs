/**
 * @import { NodeOp, NodeProgramOptions, ExecResult, IoResult } from '../../../effects/node/types.ts'
 * @import { Dir, State } from '../../../effects/node/virtual/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { IoChannel } from '../../../effects/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Cache } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { nodeCommands, readUtf8File } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualOperationMap } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { open } from './module.f.mjs'

/** @type {NodeProgramOptions} */
const options = { ...defaultNodeProgramOptions, home: '/home' }

/** @type {NodeProgramOptions} */
const explicit = {
    ...options,
    env: { GIT_AUTHOR_NAME: 'Coverage Writer', GIT_AUTHOR_EMAIL: 'coverage@example.com' },
}

/** @type {Unknown} */
const manifest = { module: 'src/module.f.js', files: { 'src/module.f.js': 'hash', 'src/proof.f.mjs': 'proof' } }

const baseConfig = '[core]\nrepositoryformatversion = 0\n'
const authorConfig = `${baseConfig}[user]\nname = Local Writer\nemail = local@example.com\n`

/** @type {(config?: string, global?: string) => Dir} */
const repository = (config = authorConfig, global = '') => ({
    repo: {
        '.git': {
            config: [utf8(config)],
            objects: { pack: {} },
            HEAD: [utf8('ref: refs/heads/main\n')],
            index: [utf8('source index')],
        },
        'module.f.js': [utf8('export const value = 1\n')],
    },
    home: { '.gitconfig': [utf8(global)] },
})

/** Open through real Git CAS operations, mocking only repository discovery. @type {(root?: Dir, opts?: NodeProgramOptions, rootOutput?: string, gitOutput?: string, failure?: boolean) => readonly [State, import('../../../types/result/types.ts').Result<Cache, IoChannel>]} */
const opened = (root = repository(), opts = options, rootOutput = '/repo\n', gitOutput = '/repo/.git\n', failure = false) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        ...virtualOperationMap,
        execFile: (command, args) => state => {
            assertEq(command, 'git')
            const selected = args[2]
            assert(selected === '--show-toplevel' || selected === '--git-common-dir')
            assertStructurallySame(args, ['rev-parse', '--path-format=absolute', selected])
            /** @type {IoResult<ExecResult>} */
            const result = failure
                ? error(ioError({ code: 'ENOENT', message: 'git unavailable' }))
                : ok({ stdout: selected === '--show-toplevel' ? rootOutput : gitOutput, stderr: '' })
            return [state, result]
        },
    }
    return partialRun(nodeCommands)(operations)({ ...emptyState, root })(open(opts))
}

/** @type {(root?: Dir, opts?: NodeProgramOptions) => readonly [State, Cache]} */
const cacheAt = (root = repository(), opts = options) => {
    const [state, result] = opened(root, opts)
    return [state, assertOk(result)]
}

/** @type {(state: State, path: string) => string} */
const read = (state, path) => assertOk(virtual(state)(readUtf8File(path))[1])

export const proof = {
    coldAndWarm: () => {
        const [state, cache] = cacheAt()
        assertEq(cache.root, '/repo')
        const [missed, missing] = virtual(state)(cache.has(manifest))
        assertEq(assertOk(missing), false)
        assertStructurallySame(missed.root, state.root)
        const [saved, result] = virtual(missed)(cache.save(manifest))
        assertOk(result)
        const [, hit] = virtual(saved)(cache.has(manifest))
        assertEq(assertOk(hit), true)
        const [, changed] = virtual(saved)(cache.has({ ...manifest, revision: 2 }))
        assertEq(assertOk(changed), false)
        const [again, duplicate] = virtual(saved)(cache.save(manifest))
        assertOk(duplicate)
        assertStructurallySame(again.root, saved.root)
        assertEq(read(saved, '/repo/.git/HEAD'), 'ref: refs/heads/main\n')
        assertEq(read(saved, '/repo/.git/index'), 'source index')
        assertEq(read(saved, '/repo/module.f.js'), 'export const value = 1\n')
        assert(read(saved, '/repo/.git/refs/heads/build-cache').length > 1)
    },
    canonical: () => {
        const [state, cache] = cacheAt()
        const [saved, result] = virtual(state)(cache.save({ z: 2, a: 1 }))
        assertOk(result)
        const [, hit] = virtual(saved)(cache.has({ a: 1, z: 2 }))
        assertEq(assertOk(hit), true)
    },
    explicitAuthor: () => {
        // The configured author is deliberately unreadable: explicit CI identity
        // must avoid configuration includes and reads entirely.
        const [state, cache] = cacheAt(repository(`${baseConfig}[include]\npath = other\n`), explicit)
        const [, result] = virtual(state)(cache.save(manifest))
        assertOk(result)
    },
    configuredAuthor: () => {
        const [state, cache] = cacheAt(repository(baseConfig, '[user]\nname = Global Writer\nemail = global@example.com\n'))
        const [, result] = virtual(state)(cache.save(manifest))
        assertOk(result)
    },
    missingAuthor: () => {
        const [state, cache] = cacheAt(repository(baseConfig))
        const [, absent] = virtual(state)(cache.has(manifest))
        assertEq(assertOk(absent), false)
        const [, result] = virtual(state)(cache.save(manifest))
        const e = assertError(result)
        assert(e[0] === 'ioError' && e[1].code === 'ERR_COV_AUTHOR')
        for (const env of [{ GIT_AUTHOR_NAME: 'Writer' }, { GIT_AUTHOR_EMAIL: 'writer@example.com' }]) {
            const [s, c] = cacheAt(repository(), { ...options, env })
            const [, incomplete] = virtual(s)(c.save(manifest))
            const e = assertError(incomplete)
            assert(e[0] === 'ioError' && e[1].code === 'ERR_COV_AUTHOR')
        }
    },
    invalidIdentity: () => {
        const [state, cache] = cacheAt(repository(), { ...explicit, env: { ...explicit.env, GIT_AUTHOR_NAME: '' } })
        const [after, result] = virtual(state)(cache.save(manifest))
        assertError(result)
        assertStructurallySame(after.root, state.root)
    },
    discovery: () => {
        const [, path] = opened(repository(), options, '/repo with \n a trailing space \n')
        assertEq(assertOk(path).root, '/repo with \n a trailing space ')
        for (const output of ['', '\n', '/repo']) {
            assertError(opened(repository(), options, output)[1])
        }
        assertError(opened(repository(), options, '/repo\n', '')[1])
        assertError(opened(repository(), options, '/repo\n', '/repo/.git\n', true)[1])
    },
    corruptRepository: () => {
        const [state, cache] = cacheAt(repository('[broken\n'))
        const [, result] = virtual(state)(cache.has(manifest))
        assertError(result)
    },
    readErrors: () => {
        const [state, cache] = cacheAt()
        const [saved, result] = virtual(state)(cache.save(manifest))
        assertOk(result)
        /** @type {PartialMemOperationMap<NodeOp, State>} */
        const denied = {
            ...virtualOperationMap,
            readWhole: () => state => [state, error(ioError({ code: 'EACCES', message: 'permission denied' }))],
        }
        const [, failed] = partialRun(nodeCommands)(denied)(saved)(cache.has(manifest))
        assertError(failed)
    },
}
