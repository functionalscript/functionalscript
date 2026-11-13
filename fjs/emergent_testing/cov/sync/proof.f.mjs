/**
 * @import { IoResult } from '../../../effects/types.ts'
 * @import { Child, ExitStatus, NodeOp } from '../../../effects/node/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError, mapStep, pureOk, step } from '../../../effects/module.f.js'
import { partialRun } from '../../../effects/mock/module.f.js'
import { nodeCommands } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions } from '../../../effects/node/virtual/module.f.mjs'
import { asNominal } from '../../../types/nominal/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { openSync } from './module.f.mjs'

const root = /** @type {const} */ ('/checkout')
const local = /** @type {const} */ ('refs/heads/build-cache')
const remote = /** @type {const} */ ('refs/remotes/origin/build-cache')
/** @type {Child} */
const child = asNominal('git')
/** @type {IoResult<ExitStatus>} */
const done = ok(['exited', 0])
/** @type {IoResult<ExitStatus>} */
const absent = ok(['exited', 1])
/** @type {IoResult<ExitStatus>} */
const invalid = ok(['exited', 128])

/**
 * The transcript includes captured commands as well as inherited-terminal
 * commands, so first-publication and rejection paths cannot silently skip IO.
 * @param {readonly IoResult<ExitStatus>[]} outcomes
 * @param {string} [listed]
 * @param {boolean} [synchronize]
 * @param {boolean} [spawnFails]
 * @returns {readonly [readonly (readonly string[])[], IoResult<boolean>]}
 */
const execute = (outcomes, listed = 'abc\trefs/heads/build-cache\n', synchronize = false, spawnFails = false) => {
    /** @type {PartialMemOperationMap<NodeOp, readonly (readonly string[])[]>} */
    const operations = {
        execFile: (command, args) => calls => {
            assertEq(command, 'git')
            const outcome = assertNotNullish(outcomes[calls.length])
            return [[...calls, args], outcome[0] === 'ok' && outcome[1][0] === 'exited' && outcome[1][1] === 0
                ? ok({ stdout: args.includes('ls-remote') ? listed : 'abc\n', stderr: '' })
                : error(ioError({ message: 'captured git failed' }))]
        },
        spawn: (command, args, options) => calls => {
            assertEq(command, 'git')
            assertEq(options.stdio, 'inherit')
            return [[...calls, args], spawnFails ? error(ioError({ message: 'git unavailable' })) : ok(child)]
        },
        childWait: () => calls => [calls, assertNotNullish(outcomes[calls.length - 1])],
    }
    const opened = openSync({ ...defaultNodeProgramOptions, env: { RUNNER_TEMP: '/tmp', GITHUB_JOB: 'cov' } }, root)
    const program = step(opened, sync => synchronize ? mapStep(sync(), () => true) : pureOk(true))
    return partialRun(nodeCommands)(operations)([])(program)
}

/** @type {readonly string[]} */
const list = ['-C', root, 'ls-remote', 'origin', local]
/** @type {readonly string[]} */
const fetch = ['-C', root, 'fetch', 'origin', `${local}:${remote}`]
/** @type {readonly string[]} */
const update = ['-C', root, 'update-ref', local, remote]
/** @type {readonly string[]} */
const exists = ['-C', root, 'show-ref', '--verify', '--quiet', local]
/** @type {readonly string[]} */
const drop = ['-C', root, 'update-ref', '-d', remote]
/** @type {readonly (readonly string[])[]} */
const inspect = [
    exists,
    ['-C', root, 'show-ref', '--verify', '--quiet', remote],
    ['-C', root, 'diff', '--quiet', remote, local, '--'],
]

export const proof = /** @type {const} */ ({
    empty: () => {
        const [calls, result] = execute([done, done, absent], '')
        assertEq(result[0], 'ok')
        assertStructurallySame(calls, [list, drop, exists])
    },
    seedsFromRemote: () => {
        const [calls, result] = execute([done, done, absent, done])
        assertEq(result[0], 'ok')
        assertStructurallySame(calls, [list, fetch, exists, update])
    },
    existingBranchDefersPublication: () => {
        const [calls, result] = execute([done, done, done])
        assertEq(result[0], 'ok')
        assertStructurallySame(calls, [list, fetch, exists])
    },
    firstSuccessPublishes: () => {
        const [calls, result] = execute([
            done, done, absent,
            done, absent, done, done, done, done, done,
        ], '', true)
        assertEq(result[0], 'ok')
        assertStructurallySame(calls, [
            list, drop, exists,
            ...inspect.slice(0, 2),
            ['-C', root, 'worktree', 'add', '/tmp/fjs-ci-cov/publish', 'build-cache'],
            ['-C', root, 'push', 'origin', 'build-cache'],
            ['-C', root, 'worktree', 'remove', '--force', '/tmp/fjs-ci-cov/publish'],
            fetch, update,
        ])
    },
    finalPublicationRefreshesLocalView: () => {
        const [calls, result] = execute([
            done, done, absent, done,
            done, done, absent, done, absent,
            done, done, done, done,
            done, done,
        ], undefined, true)
        assertEq(result[0], 'ok')
        assertStructurallySame(calls.slice(-2), [fetch, update])
        assertEq(calls.filter(args => args.includes('push')).length, 1)
        assert(calls.some(args => args.includes('--squash')))
    },
    initializationErrors: () => {
        for (const outcomes of /** @type {const} */ ([
            [invalid],
            [done, invalid],
            [done, done, invalid],
            [done, done, absent, invalid],
        ])) {
            const [, result] = execute(outcomes)
            assertEq(result[0], 'error')
        }
        const [, dropped] = execute([done, invalid], '')
        assertEq(dropped[0], 'error')
        const [, spawned] = execute([done], '', false, true)
        assertEq(spawned[0], 'error')
        for (const outcome of /** @type {const} */ ([ok(['signaled', 'SIGTERM']), error(ioError({ message: 'wait failed' }))])) {
            const [, result] = execute([done, outcome])
            assertEq(result[0], 'error')
        }
    },
    synchronizationErrors: () => {
        for (const outcomes of /** @type {const} */ ([
            [done, done, done, invalid],
            [done, done, absent, done, invalid],
            [done, done, absent, done, done, done, done, invalid],
            [done, done, absent, done, done, done, done, done, invalid],
        ])) {
            const [, result] = execute(outcomes, undefined, true)
            assertEq(result[0], 'error')
        }
    },
})
