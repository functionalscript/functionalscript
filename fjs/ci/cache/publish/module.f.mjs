/**
 * Publishes cache additions despite concurrent CI writers. Git's squash merge joins
 * immutable CAS paths in a temporary worktree; the source checkout keeps its
 * branch, index and checkout-scoped credentials.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { ExecFile, NodeProgram, Subprocess } from '../../../effects/node/types.ts'
 */

import { attemptStep, finallyStep, history, historyStep, mapStep, pureError, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { childWait, execFile, exitStep, spawn } from '../../../effects/node/module.f.mjs'
import { join } from '../../../path/module.f.js'

const pushAttempts = /** @type {const} */ (10)

/** Git runs without a shell, on the job's terminal. @type {(args: readonly string[]) => Effect<Subprocess, number, IoChannel>} */
const gitStatus = args => {
    const started = spawn('git', args, { stdio: 'inherit' })
    const ended = step(started, childWait)
    return step(ended, status => status[0] === 'exited'
        ? pureOk(status[1])
        : refuse('ERR_CI_PUBLISH')(`git ${args.join(' ')}: ${status[0]} ${status[1]}`))
}

/** A Git command whose only success is exit zero. @type {(args: readonly string[]) => Effect<Subprocess, 0, IoChannel>} */
const git = args => step(gitStatus(args), code => code === 0
    ? pureOk(0)
    : refuse('ERR_CI_PUBLISH')(`git ${args.join(' ')}: exit code ${code}`))

/** Quiet Git predicates use zero for true and one for false; other exits are errors. @type {(args: readonly string[]) => Effect<Subprocess, boolean, IoChannel>} */
const gitTest = args => step(gitStatus(args), code => code === 0 || code === 1
    ? pureOk(code === 0)
    : refuse('ERR_CI_PUBLISH')(`git ${args.join(' ')}: exit code ${code}`))

/** Compare trees, including the initial publication where no remote cache exists. @type {() => Effect<Subprocess, boolean, IoChannel>} */
const hasNewInformation = () => {
    const local = history(gitTest(['show-ref', '--verify', '--quiet', 'refs/heads/build-cache']))
    const remote = historyStep(local, present => present
        ? gitTest(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/build-cache'])
        : pureOk(false))
    const same = step(remote, ([known, present]) => !present ? pureOk(true) : known
        ? gitTest(['diff', '--quiet', 'refs/remotes/origin/build-cache', 'refs/heads/build-cache', '--'])
        : pureOk(false))
    return mapStep(same, equal => !equal)
}

/** Capture plumbing output with literal argv on every platform. @type {(args: readonly string[]) => Effect<ExecFile, string, IoChannel>} */
const gitOutput = args => mapStep(execFile('git', args), ({ stdout }) => stdout.trim())

/** One commit of the index, with only the remote tip as parent (or a root). @type {(directory: string) => Effect<Subprocess | ExecFile, 0, IoChannel>} */
const squash = directory => {
    const remote = history(gitTest(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/build-cache']))
    const tree = historyStep(remote, () => gitOutput(['-C', directory, 'write-tree']))
    const commit = step(tree, ([tree, remote]) => gitOutput([
        '-C', directory, 'commit-tree', tree,
        ...(remote ? ['-p', 'refs/remotes/origin/build-cache'] : []),
        '-m', 'ci: publish cache additions',
    ]))
    return step(commit, commit => git(['update-ref', 'refs/heads/build-cache', commit]))
}

/** Push normally, fetching and squashing after rejection, up to the push limit. @type {(directory: string, remaining: number) => Effect<Subprocess | ExecFile, 0, IoChannel>} */
const retryPush = (directory, remaining) => {
    // Network operations use the source checkout's checkout-scoped credentials.
    const pushed = attemptStep(git(['push', 'origin', 'build-cache']))
    return step(pushed, result => result[0] === 'ok'
        ? pureOk(0)
        : remaining === 1 ? pureError(result[1]) : reconcile(directory, remaining - 1))
}

/** Combine concurrent immutable paths without recording a merge parent. @type {(directory: string, remaining: number) => Effect<Subprocess | ExecFile, 0, IoChannel>} */
const reconcile = (directory, remaining) => {
    const fetched = git(['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'])
    const merged = step(fetched, () => git(['-C', directory, 'merge', '--squash', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache']))
    const same = step(merged, () => gitTest(['-C', directory, 'diff', '--cached', '--quiet', 'refs/remotes/origin/build-cache', '--']))
    const committed = step(same, same => same ? pureOk(false) : mapStep(squash(directory), () => true))
    return step(committed, changed => changed ? retryPush(directory, remaining) : pureOk(0))
}

/** Owns the temporary worktree's lifetime, including failed squash merges. @type {(directory: string) => Effect<Subprocess | ExecFile, 0, IoChannel>} */
const publishInWorktree = directory => {
    const created = git(['worktree', 'add', directory, 'build-cache'])
    const committed = step(squash(directory), () => retryPush(directory, pushAttempts))
    return step(created, () => finallyStep(
        committed,
        () => git(['worktree', 'remove', '--force', directory])))
}

/** @type {NodeProgram} */
export const main = ({ env }) => {
    const directory = join(env.RUNNER_TEMP ?? '', `fjs-ci-${env.GITHUB_JOB ?? ''}`, 'publish')
    const changed = hasNewInformation()
    const published = step(changed, changed => changed ? publishInWorktree(directory) : pureOk(0))
    return exitStep(published)
}
