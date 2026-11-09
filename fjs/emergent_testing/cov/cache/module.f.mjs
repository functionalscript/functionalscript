/**
 * Coverage successes stored as canonical manifests in the local build-cache
 * branch. Reads need no author; a successful coverage run may save afterwards.
 * No checkout, fetch or push is performed here.
 *
 * @module
 *
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { EffectList } from '../../../effects/list/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Author } from '../../../cas/git/types.ts'
 * @import { Cache } from './types.ts'
 */

import { collectRead, contentKey } from '../../../cas/module.f.mjs'
import { branchCas, configuredAuthor, snapshot } from '../../../cas/git/module.f.mjs'
import { sha256 } from '../../../crypto/sha2/module.f.mjs'
import { catchStep, history, historyStep, mapStep, orElse, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { fromList } from '../../../effects/list/module.f.mjs'
import { execFile, isNotFound } from '../../../effects/node/module.f.mjs'
import { stringifySorted } from '../../../media/json/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListToMaxVecChunksMsb } from '../../../types/bit_vec/module.f.mjs'

/** The exact canonical bytes used both to look up and to save a manifest. @type {(manifest: Unknown) => EffectList<never, Vec, IoChannel>} */
const payload = manifest => fromList(u8ListToMaxVecChunksMsb(stringToU8List(stringifySorted(manifest))))

/** One Git path, preserving whitespace and embedded newlines. @type {(name: string) => Effect<NodeOp, string, IoChannel>} */
const directory = name => {
    const found = execFile('git', ['rev-parse', '--path-format=absolute', name])
    return step(found, ({ stdout }) => stdout.endsWith('\n') && stdout.length > 1
        ? pureOk(stdout.slice(0, -1))
        : refuse('ERR_COV_REPOSITORY')(`git rev-parse ${name} returned no directory`))
}

/** Explicit CI identity takes precedence; local runs use Git configuration. @type {(dir: string, options: NodeProgramOptions) => Effect<NodeOp, Author, IoChannel>} */
const authorOf = (dir, { env, home }) => {
    const name = env.GIT_AUTHOR_NAME
    const email = env.GIT_AUTHOR_EMAIL
    if (name !== undefined || email !== undefined) {
        return name === undefined || email === undefined
            ? refuse('ERR_COV_AUTHOR')('set both GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL')
            : pureOk({ name, email })
    }
    return step(configuredAuthor(dir, home), author => author === null
        ? refuse('ERR_COV_AUTHOR')('set Git user.name and user.email before recording coverage')
        : pureOk(author))
}

/** Open the caller's repository, including direct subtree and linked-worktree invocation. @type {(options: NodeProgramOptions) => Effect<NodeOp, Cache, IoChannel>} */
export const open = options => {
    const root = history(directory('--show-toplevel'))
    const git = historyStep(root, () => directory('--git-common-dir'))
    return mapStep(git, ([dir, root]) => {
        const branch = { dir, branch: 'build-cache' }
        return {
            root,
            has: manifest => {
                const key = history(contentKey(sha256)(payload(manifest)))
                const opened = historyStep(key, () => snapshot(branch))
                return step(opened, ([reader, key]) => catchStep(
                    mapStep(collectRead(reader.read(key)), () => true),
                    orElse(isNotFound, false)))
            },
            save: manifest => {
                const author = authorOf(dir, options)
                const opened = step(author, author => branchCas(sha256, branch, author))
                return step(opened, cas => mapStep(cas.write(payload(manifest)), () => undefined))
            },
        }
    })
}
