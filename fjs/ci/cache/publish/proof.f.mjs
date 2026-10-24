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
/** @type {IoResult<ExitStatus>} */
const invalid = ok(['exited', 128])
/** @type {Env} */
const env = { RUNNER_TEMP: 'tmp', GITHUB_JOB: 'node' }
/** A local branch and baseline whose committed trees differ. @type {readonly IoResult<ExitStatus>[]} */
const different = [done, done, rejected]
/** @type {readonly (readonly string[])[]} */
const comparison = [
    ['show-ref', '--verify', '--quiet', 'refs/heads/build-cache'],
    ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/build-cache'],
    ['diff', '--quiet', 'refs/remotes/origin/build-cache', 'refs/heads/build-cache', '--'],
]

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
        const [calls, result] = execute([...different, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [...comparison, ['push', 'origin', 'build-cache']])
    },
    unchanged: () => {
        const [calls, result] = execute([done, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, comparison)
    },
    noLocalCache: () => {
        const [calls, result] = execute([rejected])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [comparison[0]])
    },
    firstPublication: () => {
        const [calls, result] = execute([done, rejected, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [...comparison.slice(0, 2), ['push', 'origin', 'build-cache']])
    },
    repeatedRaces: () => {
        const [calls, result] = execute([...different, rejected, done, done, done, ...different, rejected, done, done, ...different, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [
            ...comparison,
            ['push', 'origin', 'build-cache'],
            ['worktree', 'add', 'tmp/fjs-ci-node/publish', 'build-cache'],
            ['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'],
            ['-C', 'tmp/fjs-ci-node/publish', 'merge', '--no-edit', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache'],
            ...comparison,
            ['push', 'origin', 'build-cache'],
            ['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'],
            ['-C', 'tmp/fjs-ci-node/publish', 'merge', '--no-edit', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache'],
            ...comparison,
            ['push', 'origin', 'build-cache'],
            ['worktree', 'remove', '--force', 'tmp/fjs-ci-node/publish'],
        ])
    },
    alreadyPublishedAfterMerge: () => {
        const [calls, result] = execute([...different, rejected, done, done, done, done, done, done, done])
        assertEq(exitCode(result), 0)
        assertEq(calls.filter(args => args[0] === 'push').length, 1)
        assertEq(calls.filter(args => args[0] === 'fetch').length, 1)
        assertEq(calls.filter(args => args[0] === 'diff').length, 2)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    bounded: () => {
        /** @type {readonly IoResult<ExitStatus>[]} */
        const outcomes = [...different, rejected, done, ...Array.from({ length: 9 }, () => [done, done, ...different, rejected]).flat(), done]
        const [calls, result] = execute(outcomes)
        assertEq(exitCode(result), 1)
        assertEq(calls.filter(args => args[0] === 'push').length, 10)
        assertEq(calls.filter(args => args[0] === 'fetch').length, 9)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    creationFailure: () => {
        const [calls, result] = execute([...different, rejected, rejected])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 5)
    },
    fetchFailure: () => {
        const [calls, result] = execute([...different, rejected, done, rejected, done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 7)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    mergeFailure: () => {
        const [calls, result] = execute([...different, rejected, done, done, rejected, done])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 8)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    cleanupDoesNotReplaceSuccess: () => {
        const [, result] = execute([...different, rejected, done, done, done, ...different, done, rejected])
        assertEq(exitCode(result), 0)
    },
    cannotStart: () => {
        const [calls, result] = execute([], env, true)
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 1)
    },
    cannotWait: () => {
        const [calls, result] = execute([error(ioError({ message: 'cannot wait' }))])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 1)
    },
    signaled: () => {
        const [calls, result] = execute([ok(['signaled', 'SIGTERM'])])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 1)
    },
    comparisonFailures: () => {
        for (const outcomes of [[invalid], [done, invalid], [done, done, invalid]]) {
            const [calls, result] = execute(outcomes)
            assertEq(exitCode(result), 1)
            assertEq(calls.filter(args => args[0] === 'push' || args[0] === 'worktree').length, 0)
        }
    },
    comparisonFailureAfterMerge: () => {
        const [calls, result] = execute([...different, rejected, done, done, done, done, done, invalid, done])
        assertEq(exitCode(result), 1)
        assertEq(calls.filter(args => args[0] === 'push').length, 1)
        assertEq(calls.filter(args => args[0] === 'fetch').length, 1)
        assertEq(calls.at(-1)?.[1], 'remove')
    },
    defaultDirectory: () => {
        const [calls, result] = execute([...different, rejected, done, done, done, ...different, done, done], {})
        assertEq(exitCode(result), 0)
        assertEq(calls[4]?.[2], '/fjs-ci-/publish')
    },
})
