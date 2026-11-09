/**
 * Synchronizes the coverage success branch without checking out source files.
 * Initial fetches seed a new local cache; publication and importing concurrent
 * writers' results are deferred until the caller finishes its coverage batch.
 * @module
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { Synchronize } from './types.ts'
 */

import { history, historyStep, mapStep, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { childWait, execFile, spawn } from '../../../effects/node/module.f.mjs'
import { publishFrom } from '../../../ci/cache/publish/module.f.mjs'

const localRef = 'refs/heads/build-cache'
const remoteRef = 'refs/remotes/origin/build-cache'

/** Git's exit status remains distinct from a process that did not complete. @type {(root: string, args: readonly string[]) => Effect<NodeOp, number, IoChannel>} */
const gitStatus = (root, args) => {
    const started = spawn('git', ['-C', root, ...args], { stdio: 'inherit' })
    const ended = step(started, childWait)
    return step(ended, ([kind, value]) => kind === 'exited'
        ? pureOk(value)
        : refuse('ERR_COVERAGE_SYNC')(`git ${args.join(' ')}: ${kind} ${value}`))
}

/** @type {(root: string, args: readonly string[]) => Effect<NodeOp, void, IoChannel>} */
const git = (root, args) => step(gitStatus(root, args), code => code === 0
    ? pureOk(undefined)
    : refuse('ERR_COVERAGE_SYNC')(`git ${args.join(' ')}: exit code ${code}`))

/** @type {(root: string) => Effect<NodeOp, boolean, IoChannel>} */
const hasLocal = root => step(gitStatus(root, ['show-ref', '--verify', '--quiet', localRef]), code => code === 0 || code === 1
    ? pureOk(code === 0)
    : refuse('ERR_COVERAGE_SYNC')(`cannot inspect local build-cache: exit code ${code}`))

/** @type {(root: string) => Effect<NodeOp, void, IoChannel>} */
const fetch = root => git(root, ['fetch', 'origin', `${localRef}:${remoteRef}`])

/**
 * Fetch the remote baseline and preserve/replay any unpublished local entries.
 * A missing remote branch is the first publication, not an error. The caller
 * decides when publication is allowed (for example excluding fork CI jobs).
 * @type {(options: NodeProgramOptions, root: string) => Effect<NodeOp, Synchronize, IoChannel>}
 */
export const openSync = (options, root) => {
    const listed = history(execFile('git', ['-C', root, 'ls-remote', 'origin', localRef]))
    const remote = historyStep(listed, ({ stdout }) => stdout.trim() === ''
        ? mapStep(git(root, ['update-ref', '-d', remoteRef]), () => false)
        : mapStep(fetch(root), () => true))
    const local = historyStep(remote, () => hasLocal(root))
    /** @type {Synchronize} */
    const synchronize = () => {
        const published = publishFrom(root, options)
        const fetched = step(published, () => fetch(root))
        // The publisher may discover that another writer already stored all of
        // our entries. Advancing here also imports those writers' other keys.
        return step(fetched, () => git(root, ['update-ref', localRef, remoteRef]))
    }
    return step(local, ([present, known]) => present
        ? pureOk(synchronize)
        : known ? mapStep(git(root, ['update-ref', localRef, remoteRef]), () => synchronize)
            : pureOk(synchronize))
}
