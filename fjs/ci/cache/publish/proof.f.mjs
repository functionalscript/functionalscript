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
        exec: command => calls => {
            const outcome = assertNotNullish(outcomes[calls.length])
            return [[...calls, [command]], outcome[0] === 'ok' && outcome[1][0] === 'exited' && outcome[1][1] === 0
                ? ok({ stdout: 'abc\n', stderr: '' })
                : error(ioError({ message: 'plumbing failed' }))]
        },
        childWait: () => calls => [calls, assertNotNullish(outcomes[calls.length - 1])],
        write: () => calls => [calls, ok(undefined)],
    }
    /** @type {NodeProgramOptions} */
    const options = { ...defaultNodeProgramOptions, env: environment }
    return partialRun(nodeCommands)(operations)([])(main(options))
}

const directory = 'tmp/fjs-ci-node/publish'
const create = ['worktree', 'add', directory, 'build-cache']
const remove = ['worktree', 'remove', '--force', directory]
const push = ['push', 'origin', 'build-cache']
/** @type {(remote?: boolean) => readonly (readonly string[])[]} */
const squash = (remote = true) => [
    comparison[1],
    [`git '-C' '${directory}' 'write-tree'`],
    [`git '-C' '${directory}' 'commit-tree' 'abc'${remote ? " '-p' 'refs/remotes/origin/build-cache'" : ''} '-m' 'ci: publish cache additions'`],
    ['update-ref', 'refs/heads/build-cache', 'abc'],
]
const reconcile = [
    ['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'],
    ['-C', directory, 'merge', '--squash', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache'],
    ['-C', directory, 'diff', '--cached', '--quiet', 'refs/remotes/origin/build-cache', '--'],
]
const prepared = [...different, done, done, done, done, done]

export const proof = /** @type {const} */ ({
    uncontended: () => {
        const [calls, result] = execute([...prepared, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [...comparison, create, ...squash(), push, remove])
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
        const [calls, result] = execute([done, rejected, done, rejected, done, done, done, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [...comparison.slice(0, 2), create, ...squash(false), push, remove])
    },
    repeatedRaces: () => {
        const retry = [done, done, rejected, done, done, done, done]
        const [calls, result] = execute([...prepared, rejected, ...retry, rejected, ...retry, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [
            ...comparison, create, ...squash(), push,
            ...reconcile, ...squash(), push,
            ...reconcile, ...squash(), push, remove,
        ])
    },
    alreadyPublished: () => {
        const [calls, result] = execute([...prepared, rejected, done, done, done, done])
        assertEq(exitCode(result), 0)
        assertStructurallySame(calls, [...comparison, create, ...squash(), push, ...reconcile, remove])
    },
    bounded: () => {
        const retry = [done, done, rejected, done, done, done, done, rejected]
        const [calls, result] = execute([...prepared, rejected, ...Array.from({ length: 9 }, () => retry).flat(), done])
        assertEq(exitCode(result), 1)
        assertEq(calls.filter(args => args[0] === 'push').length, 10)
        assertEq(calls.filter(args => args[0] === 'fetch').length, 9)
        assertStructurallySame(calls.at(-1), remove)
    },
    creationFailure: () => {
        const [calls, result] = execute([...different, rejected])
        assertEq(exitCode(result), 1)
        assertEq(calls.length, 4)
    },
    preparationFailures: () => {
        for (const index of [0, 1, 2, 3]) {
            const outcomes = [invalid, rejected, rejected, rejected]
            const [calls, result] = execute([...different, done, ...Array.from({ length: index }, () => done), assertNotNullish(outcomes[index]), done])
            assertEq(exitCode(result), 1)
            assertEq(calls.filter(args => args[0] === 'push').length, 0)
            assertStructurallySame(calls.at(-1), remove)
        }
    },
    reconciliationFailures: () => {
        const retry = [done, done, rejected, done, done, done, done]
        for (const index of [0, 1, 2, 3, 4, 5, 6]) {
            const [calls, result] = execute([...prepared, rejected, ...retry.slice(0, index), invalid, done])
            assertEq(exitCode(result), 1)
            assertEq(calls.filter(args => args[0] === 'push').length, 1)
            assertStructurallySame(calls.at(-1), remove)
        }
    },
    cleanupDoesNotReplaceSuccess: () => {
        const [, result] = execute([...prepared, done, rejected])
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
    defaultDirectory: () => {
        const [calls, result] = execute([...prepared, done, done], {})
        assertEq(exitCode(result), 0)
        assertEq(calls[3]?.[2], '/fjs-ci-/publish')
    },
    nulDirectory: () => {
        const [calls, result] = execute([...different, done, done, done], { RUNNER_TEMP: '\u0000' })
        assertEq(exitCode(result), 1)
        assertStructurallySame(calls.at(-1)?.slice(0, 3), ['worktree', 'remove', '--force'])
    },
    quotedDirectory: () => {
        const [calls, result] = execute([...prepared, done, done], { RUNNER_TEMP: "tmp's $(false)" })
        assertEq(exitCode(result), 0)
        assertEq(calls[5]?.[0], "git '-C' 'tmp'\\''s $(false)/fjs-ci-/publish' 'write-tree'")
    },
})
