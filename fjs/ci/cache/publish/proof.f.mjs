/**
 * @import { IoResult } from '../../../effects/types.ts'
 * @import { Child, Env, ExitStatus, NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { PartialMemOperationMap } from '../../../effects/mock/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.js'
import { ioError } from '../../../effects/module.f.mjs'
import { partialRun } from '../../../effects/mock/module.f.mjs'
import { exitCode, nodeCommands } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions } from '../../../effects/node/virtual/module.f.mjs'
import { asNominal } from '../../../types/nominal/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { main } from './module.f.mjs'

/** @type {Child} */
const child = asNominal('git')
/** @type {IoResult<ExitStatus>} */
const done = ok(['exited', 0])
/** @type {IoResult<ExitStatus>} */
const rejected = ok(['exited', 1])
/** @type {Env} */
const env = { RUNNER_TEMP: 'tmp', GITHUB_JOB: 'node' }

/**
 * Script child outcomes while retaining an immutable transcript of Git argv.
 * @type {(outcomes: readonly IoResult<ExitStatus>[], environment?: Env, failSpawn?: boolean) => readonly [readonly (readonly string[])[], Result<0, number>]}
 */
const execute = (outcomes, environment = env, failSpawn = false) => {
    /** @type {PartialMemOperationMap<NodeOp, readonly (readonly string[])[]>} */
    const operations = {
        spawn: (command, args, options) => calls => {
            assertEq(command, 'git')
            assertEq(options.stdio, 'inherit')
            return [[...calls, args], failSpawn ? error(ioError({ message: 'git unavailable' })) : ok(child)]
        },
        childWait: () => calls => [calls, assertNotNullish(outcomes[calls.length - 1])],
        write: () => calls => [calls, ok(undefined)],
    }
    /** @type {NodeProgramOptions} */
    const options = { ...defaultNodeProgramOptions, env: environment }
    return partialRun(nodeCommands)(operations)([])(main(options))
}

export const proof = /** @type {const} */ ({
    uncontended: () => {
        const [calls, result] = execute([done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [['push', 'origin', 'build-cache']])
    },
    repeatedRaces: () => {
        const [calls, result] = execute([rejected, done, done, done, rejected, done, done, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [
            ['push', 'origin', 'build-cache'],
            ['worktree', 'add', 'tmp/fjs-ci-node/publish', 'build-cache'],
            ['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'],
            ['-C', 'tmp/fjs-ci-node/publish', 'merge', '--no-edit', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache'],
            ['push', 'origin', 'build-cache'],
            ['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'],
            ['-C', 'tmp/fjs-ci-node/publish', 'merge', '--no-edit', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache'],
            ['push', 'origin', 'build-cache'],
            ['worktree', 'remove', '--force', 'tmp/fjs-ci-node/publish'],
        ])
    },
    bounded: () => {
        /** @type {readonly IoResult<ExitStatus>[]} */
        const outcomes = [rejected, done, ...Array.from({ length: 9 }, () => [done, done, rejected]).flat(), done]
        const [calls, result] = execute(outcomes)
        assertEq(exitCode(result), 1)
        assertEq(calls.filter(args => args[0] === 'push').length, 10)
        assertEq(calls.filter(args => args[0] === 'fetch').length, 9)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    creationFailure: () => {
        const [calls, result] = execute([rejected, rejected])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 2)
    },
    fetchFailure: () => {
        const [calls, result] = execute([rejected, done, rejected, done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 4)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    mergeFailure: () => {
        const [calls, result] = execute([rejected, done, done, rejected, done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 5)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    cleanupDoesNotReplaceSuccess: () => {
        const [, result] = execute([rejected, done, done, done, done, rejected])
        assertEq(exitCode(result), 0)
    },
    cannotStart: () => {
        const [calls, result] = execute([], env, true)
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 2)
    },
    cannotWait: () => {
        const [calls, result] = execute([rejected, done, error(ioError({ message: 'cannot wait' })), done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 4)
    },
    signaled: () => {
        const [calls, result] = execute([rejected, done, done, ok(['signaled', 'SIGTERM']), done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 5)
    },
    defaultDirectory: () => {
        const [calls, result] = execute([rejected, done, done, done, done, done], {})
        assertEq(exitCode(result), 0)
        assertEq(calls[1]?.[2], '/fjs-ci-/publish')
    },
})
