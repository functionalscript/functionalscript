/**
 * Coverage successes stored as canonical manifests in the local build-cache
 * branch. Preparation hashes each manifest once; native Git reads one pinned
 * inventory and imports all successful additions in one atomic commit.
 * Neither phase changes the source checkout or index. Lookup needs no author.
 *
 * @module
 *
 * @import { NodeOp, NodeProgramOptions } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { Author } from '../../../cas/git/types.ts'
 * @import { Cache, Entry } from './types.ts'
 */

import { vecToCBase32 } from '../../../basen/cbase32/module.f.mjs'
import { contentKey, toPath, unshard } from '../../../cas/module.f.mjs'
import { configuredAuthor } from '../../../cas/git/module.f.mjs'
import { sha256 } from '../../../crypto/sha2/module.f.mjs'
import { catchStep, history, historyStep, mapStep, pureError, pureOk, refuse, step } from '../../../effects/module.f.mjs'
import { fromList } from '../../../effects/list/module.f.mjs'
import { execFile } from '../../../effects/node/module.f.mjs'
import { stringifySorted } from '../../../media/json/module.f.mjs'
import { stringToU8List } from '../../../text/utf8/module.f.mjs'
import { u8ListToMaxVecChunksMsb } from '../../../types/bit_vec/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'

const branch = /** @type {const} */ ('refs/heads/build-cache')
const captureBytes = /** @type {const} */ (0x400_0000)
const attempts = /** @type {const} */ (10)
const message = /** @type {const} */ ('coverage: record successful targets\n')
const invalid = refuse('ERR_COV_CACHE')

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

/** An object id as Git prints it for SHA-1 or SHA-256 repositories. @type {(text: string) => boolean} */
const objectId = text => (text.length === 40 || text.length === 64)
    && [...text].every(c => '0123456789abcdef'.includes(c))

/** The exact canonical bytes used both to look up and to save a manifest. @type {(manifest: Unknown) => Effect<NodeOp, Entry, IoChannel>} */
const prepare = manifest => {
    const payload = stringifySorted(manifest)
    const bytes = toArray(stringToU8List(payload))
    const key = contentKey(sha256)(fromList(u8ListToMaxVecChunksMsb(bytes)))
    return mapStep(key, key => ({ manifest, key: vecToCBase32(key), path: toPath(key), payload, byteLength: bytes.length }))
}

/** One immutable cache tree, pinned before its inventory is requested. @type {(dir: string) => Effect<NodeOp, {readonly tip: string | null, readonly paths: readonly string[], readonly objects: Readonly<Record<string, string>>}, IoChannel>} */
const inventory = dir => {
    const refs = execFile('git', ['--git-dir', dir, 'for-each-ref', '--format=%(refname)%00%(objectname)', branch])
    const tip = step(refs, ({ stdout, stderr }) => {
        if (stderr !== '' || (stdout !== '' && !stdout.endsWith('\n'))) { return invalid('cannot read the build-cache ref') }
        const lines = stdout.split('\n').filter(line => line !== '')
        const matches = lines.map(line => line.split('\u0000')).filter(([name]) => name === branch)
        if (matches.length === 0) { return pureOk(null) }
        const found = matches[0]
        return matches.length !== 1 || found.length !== 2 || !objectId(found[1])
            ? invalid('invalid build-cache object id')
            : pureOk(found[1])
    })
    return step(tip, tip => {
        if (tip === null) { return pureOk({ tip: /** @type {string | null} */ (tip), paths: /** @type {readonly string[]} */ ([]), objects: /** @type {Readonly<Record<string, string>>} */ ({}) }) }
        const listed = execFile('git', ['--git-dir', dir, 'ls-tree', '-r', '-z', '--full-tree', tip, '--', '.cas'], { maxBuffer: captureBytes })
        return step(listed, ({ stdout, stderr }) => {
            if (stderr !== '' || (stdout !== '' && !stdout.endsWith('\u0000'))) { return invalid('invalid build-cache tree listing') }
            const records = stdout.split('\u0000').slice(0, -1)
            const parsed = records.map(record => {
                const fields = record.split('\t')
                const [mode, kind, oid, ...extra] = fields[0].split(' ')
                const file = fields[1] ?? ''
                const key = file.startsWith('.cas/') ? unshard(file.slice(5)) : null
                return fields.length !== 2 || extra.length !== 0 || mode !== '100644' || kind !== 'blob'
                    || !objectId(oid ?? '') || key === null || toPath(key) !== file
                    ? null : /** @type {readonly [string, string]} */ ([file, oid])
            })
            if (parsed.some(entry => entry === null)) { return invalid('build-cache holds an invalid manifest entry') }
            const entries = /** @type {readonly (readonly [string, string])[]} */ (parsed)
            return pureOk({ tip, paths: entries.map(([file]) => file), objects: Object.fromEntries(entries) })
        })
    })
}

/** Native Git supplies a valid raw ident; explicit invalid names are refused before it runs. @type {(dir: string, options: NodeProgramOptions) => Effect<NodeOp, string, IoChannel>} */
const identity = (dir, options) => step(authorOf(dir, options), author => {
    if ([author.name, author.email].some(value => value.trim() === '' || ['<', '>', '\n', '\r', '\u0000'].some(c => value.includes(c)))) {
        return refuse('ERR_COV_AUTHOR')('invalid coverage cache identity')
    }
    const found = execFile('git', ['--git-dir', dir, '-c', `user.name=${author.name}`, '-c', `user.email=${author.email}`, 'var', 'GIT_COMMITTER_IDENT'])
    return step(found, ({ stdout }) => stdout.endsWith('\n') && stdout.length > 1 && !stdout.slice(0, -1).includes('\n')
        ? pureOk(stdout.slice(0, -1))
        : refuse('ERR_COV_AUTHOR')('git returned an invalid committer identity'))
})

/** No payload is rehashed or rebuilt after the plan has prepared it. @type {(entries: readonly Entry[], tip: string | null, ident: string) => string} */
const batch = (entries, tip, ident) => `commit ${branch}\nauthor ${ident}\ncommitter ${ident}\ndata ${message.length}\n${message}\n${tip === null ? '' : `from ${tip}\n`}${entries.map(entry => `M 100644 inline ${entry.path}\ndata ${entry.byteLength}\n${entry.payload}\n`).join('')}\ndone\n`

/** A path map avoids a scan of the inventory for every target. @type {(paths: readonly string[]) => Readonly<Record<string, true>>} */
const pathMap = paths => Object.fromEntries(paths.map(file => [file, true]))

/** A path is a hit only when its pinned blob still holds the exact prepared manifest. @type {(dir: string, entries: readonly Entry[], objects: Readonly<Record<string, string>>) => Effect<NodeOp, readonly boolean[], IoChannel>} */
const lookup = (dir, entries, objects) => {
    const found = entries.map(entry => Object.hasOwn(objects, entry.path))
    const hits = Object.values(Object.fromEntries(entries.filter((_, i) => found[i]).map(entry => [entry.path, entry])))
    if (hits.length === 0) { return pureOk(found) }
    // Matching complete expected frames checks oid, type, UTF-8 byte length,
    // payload, separators and end-of-output without guessing where a bad blob
    // ends. One missing, corrupt or changed blob refuses this cache batch.
    const stdin = hits.map(entry => `${objects[entry.path]}\n`).join('')
    const expected = hits.map(entry => `${objects[entry.path]} blob ${entry.byteLength}\n${entry.payload}\n`).join('')
    const checked = execFile('git', ['--git-dir', dir, 'cat-file', '--batch'], { stdin, maxBuffer: captureBytes })
    return step(checked, ({ stdout, stderr }) => stdout === expected && stderr === ''
        ? pureOk(found)
        : invalid('build-cache holds a missing or invalid manifest blob'))
}

/** Publish only successes; a concurrent local writer is reread and unioned after rejection. @type {(dir: string, entries: readonly Entry[], found: {readonly tip: string | null, readonly paths: readonly string[]}, ident: string, remaining: number) => Effect<NodeOp, void, IoChannel>} */
const commit = (dir, entries, found, ident, remaining) => {
    const paths = pathMap(found.paths)
    const pending = entries.filter(entry => !Object.hasOwn(paths, entry.path))
    if (pending.length === 0) { return pureOk(undefined) }
    const imported = execFile('git', ['--git-dir', dir, 'fast-import', '--quiet', '--date-format=raw', '--done'], { stdin: batch(pending, found.tip, ident), maxBuffer: captureBytes })
    return catchStep(mapStep(imported, () => undefined), failure => remaining === 1
        ? pureError(failure)
        : step(inventory(dir), latest => latest.tip === found.tip
            ? pureError(failure)
            : commit(dir, entries, latest, ident, remaining - 1)))
}

/** Open the caller's repository, including direct subtree and linked-worktree invocation. @type {(options: NodeProgramOptions) => Effect<NodeOp, Cache, IoChannel>} */
export const open = options => {
    const root = history(directory('--show-toplevel'))
    const git = historyStep(root, () => directory('--git-common-dir'))
    return mapStep(git, ([dir, root]) => ({
        root,
        prepare,
        lookup: entries => entries.length === 0 ? pureOk([]) : step(inventory(dir), found => lookup(dir, entries, found.objects)),
        saveMany: entries => {
            if (entries.length === 0) { return pureOk(undefined) }
            const distinct = Object.values(Object.fromEntries(entries.map(entry => [entry.path, entry])))
            return step(inventory(dir), found => {
                const paths = pathMap(found.paths)
                return distinct.every(entry => Object.hasOwn(paths, entry.path))
                    ? pureOk(undefined)
                    : step(identity(dir, options), ident => commit(dir, distinct, found, ident, attempts))
            })
        },
    }))
}
