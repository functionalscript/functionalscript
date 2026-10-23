/**
 * The `fjs cas git` commands: the CAS in a Git branch from the command
 * line — `add`, `get` and `list`, the three commands `fjs cas` has for the
 * store under `~/.cas/`, over a branch of the repository the current
 * directory is in. Each is one call into the API of
 * [`fjs/cas/git`](../module.f.mjs), so what the CLI does is what a program
 * calling the API does. Nothing moves between repositories here: `git push`
 * and `git fetch` carry the branch, and `git merge` joins two writers'.
 *
 * The repository is the one at the current directory: its `.git` directory
 * or file, read as Git reads one through `commondir`, or the directory
 * itself where it is a repository directory — bare, or a worktree's own
 * `.git`. The parents are not searched as `git` searches them, so the
 * commands run from the root of the worktree
 * ([`todo/find-repository-upward.md`](./todo/find-repository-upward.md)).
 * The author of `add`'s commit is the repository's configured `user.name`
 * and `user.email`, as `git commit`'s is.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { CreateExclusive, ReadFile, Stat, Write, WriteBytes, WriteFile } from '../../../effects/node/types.ts'
 * @import { DocumentedCommands } from '../../../cli/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Author, Branch, WriteOperation } from '../types.ts'
 */

import { cBase32ToVec, vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { exactArgs } from '../../../cli/module.f.mjs'
import { sha256 } from '../../../crypto/sha2/module.f.mjs'
import { catchStep, forEachStep, history, historyStep, mapStep, orElse, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { exitStep, isNotFound, log, writeFromStream } from '../../../effects/node/module.f.mjs'
import { oidBytes as widthOf } from '../../../git/format/module.f.mjs'
import { tryCommonDir } from '../../../git/repo/module.f.mjs'
import { casAddFile } from '../../module.f.mjs'
import { branchCas, configuredAuthor, snapshot } from '../module.f.mjs'

/** The code the current directory is refused with where it is neither a Git worktree nor a repository directory. */
export const noRepositoryCode = /** @type {const} */ ('ERR_NO_REPOSITORY')

/** The code a repository with no configured author is refused with: a commit needs one. */
export const noAuthorCode = /** @type {const} */ ('ERR_NO_AUTHOR')

/** The directory the commands run in, as a path: the current one. */
const here = '.'

/**
 * Whether `path` is itself a repository directory: one whose `config` Git
 * opens, which is what a bare repository and a worktree's `.git` are. A
 * missing `config` is no repository; any other failure to read it is the
 * error it is.
 *
 * @type {(path: string) => Effect<ReadFile, boolean, IoChannel>}
 */
const isRepository = path => catchStep(mapStep(widthOf(path), w => w !== null), orElse(isNotFound, false))

/**
 * The branch `branch` of the current directory's repository: the repository
 * directory found as Git finds it from a worktree — through a `.git`
 * directory or file and `commondir` — or the current directory itself where
 * it is a repository directory; refused where it is neither.
 *
 * @type {(branch: string) => Effect<ReadFile | Stat, Branch, IoChannel>}
 */
const branchOf = branch => {
    const found = history(catchStep(tryCommonDir(here), orElse(isNotFound, null)))
    const direct = historyStep(found, d => d === null ? isRepository(here) : pureOk(false))
    return step(direct, ([yes, d]) => {
        if (d !== null) { return pureOk({ dir: d, branch }) }
        return yes
            ? pureOk({ dir: here, branch })
            : refuse(noRepositoryCode)('the current directory is neither a Git worktree nor a repository directory')
    })
}

/**
 * The author the repository is configured with, or refused: the commit
 * needs one, and `git commit` would ask for the same two settings.
 *
 * @type {(branch: Branch, home: string) => Effect<ReadFile, Author, IoChannel>}
 */
const authorOf = ({ dir }, home) => step(configuredAuthor(dir, home), a => a === null
    ? refuse(noAuthorCode)(`set user.name and user.email in ${dir}/config or ${home}/.gitconfig`)
    : pureOk(a))

/**
 * A key as the command line spells one, or refused.
 *
 * @type {(text: string) => Effect<never, Vec, IoChannel>}
 */
const keyOf = text => {
    const key = cBase32ToVec(text)
    return key === null ? refuse('ERR_KEY_FORMAT')(`invalid key format: ${text}`) : pureOk(key)
}

const docs = 'fjs/cas/git/README.md'

/** @type {DocumentedCommands<WriteOperation | Write | WriteFile | WriteBytes | CreateExclusive>} */
export const commands = [
    {
        names: ['add'],
        description: 'Store file content on the branch and print its key',
        usage: 'fjs cas git add <branch> <path>',
        examples: ['fjs cas git add build-cache ./README.md'],
        note: 'One commit on the branch, by the repository\'s configured user.name and user.email, or no commit where the branch already holds the content. The checkout is not touched.',
        docs,
        handler: exactArgs('cas git add', 2)(({ home, args: [branch, path] }) => {
            const b = history(branchOf(branch))
            const a = historyStep(b, x => authorOf(x, home))
            const cas = step(a, ([author, x]) => branchCas(sha256, x, author))
            const added = step(cas, c => casAddFile(c)(path))
            const logged = step(added, key => log(vecToCBase32(key)))
            return exitStep(logged)
        }),
    },
    {
        names: ['get'],
        description: 'Restore content of the branch by key into a file',
        usage: 'fjs cas git get <branch> <key> <path>',
        examples: ['fjs cas git get build-cache "$key" ./restored'],
        note: 'Reads the key from the commit the branch is at. A key the branch does not hold fails.',
        docs,
        handler: exactArgs('cas git get', 3)(({ args: [branch, keyText, path] }) => {
            const k = history(keyOf(keyText))
            const b = historyStep(k, () => branchOf(branch))
            const s = historyStep(b, snapshot)
            const written = step(s, ([cas, , key]) => writeFromStream(path, cas.read(key)))
            return exitStep(written)
        }),
    },
    {
        names: ['list'],
        description: 'List the keys the branch holds',
        usage: 'fjs cas git list <branch>',
        examples: ['fjs cas git list build-cache'],
        note: 'Prints every key the commit the branch is at holds, one per line; nothing for a branch that is not there.',
        docs,
        handler: exactArgs('cas git list', 1)(({ args: [branch] }) => {
            const s = step(branchOf(branch), snapshot)
            const keys = step(s, cas => cas.list())
            return exitStep(forEachStep(keys, key => log(vecToCBase32(key))))
        }),
    },
]

/** The table as a module's entry point, so `fjs run` can run it. */
export const main = commands
