/**
 * Publishes cache additions despite concurrent CI writers. Git's merge joins
 * immutable CAS paths in a temporary worktree; the source checkout keeps its
 * branch, index and checkout-scoped credentials.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeProgram, Subprocess } from '../../../effects/node/types.ts'
 */

import { attemptStep, catchStep, finallyStep, pureError, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { childWait, exitStep, spawn } from '../../../effects/node/module.f.mjs'
import { join } from '../../../path/module.f.mjs'

const pushAttempts = /** @type {const} */ (10)

/** Git runs without a shell, on the job's terminal. @type {(args: readonly string[]) => Effect<Subprocess, 0, IoChannel>} */
const git = args => {
    const started = spawn('git', args, { stdio: 'inherit' })
    const ended = step(started, childWait)
    return step(ended, status => status[0] === 'exited' && status[1] === 0
        ? pureOk(0)
        : refuse('ERR_CI_PUBLISH')(`git ${args.join(' ')}: ${status[0]} ${status[1]}`))
}

/** Fetch and merge after each rejection, stopping on a fetch/merge failure or the push limit. @type {(directory: string, remaining: number) => Effect<Subprocess, 0, IoChannel>} */
const retryPush = (directory, remaining) => {
    // Network operations stay here: checkout's includeIf credentials belong to
    // this Git directory. The remote-tracking ref is shared with the worktree;
    // FETCH_HEAD is not. Fetch the new history without adding a shallow boundary.
    const fetched = git(['fetch', 'origin', 'build-cache:refs/remotes/origin/build-cache'])
    const merged = step(fetched, () => git(['-C', directory, 'merge', '--no-edit', '--allow-unrelated-histories', 'refs/remotes/origin/build-cache']))
    const pushed = step(merged, () => attemptStep(git(['push', 'origin', 'build-cache'])))
    const retry = step(pushed, result => result[0] === 'ok'
        ? pureOk(false)
        : remaining === 1 ? pureError(result[1]) : pureOk(true))
    return step(retry, again => again ? retryPush(directory, remaining - 1) : pureOk(0))
}

/** Owns the temporary worktree's lifetime, including failed merges. @type {(directory: string) => Effect<Subprocess, 0, IoChannel>} */
const publishInWorktree = directory => {
    const created = git(['worktree', 'add', directory, 'build-cache'])
    return step(created, () => finallyStep(
        retryPush(directory, pushAttempts - 1),
        () => git(['worktree', 'remove', '--force', directory])))
}

/** @type {NodeProgram} */
export const main = ({ env }) => {
    const directory = join(env.RUNNER_TEMP ?? '', `fjs-ci-${env.GITHUB_JOB ?? ''}`, 'publish')
    const pushed = git(['push', 'origin', 'build-cache'])
    const published = catchStep(pushed, () => publishInWorktree(directory))
    return exitStep(published)
}
