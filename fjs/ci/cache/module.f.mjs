/**
 * Successful checks over committed inputs. Init reads Git trees, looks up each
 * check's manifest on build-cache and leaves that exact manifest outside the
 * checkout. Report adds it after the check passes; GitHub's steps own the push.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { ExecFile, NodeOp, Env, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { DocumentedCommands } from '../../cli/types.ts'
 * @import { Oid, OidBytes } from '../../git/types.ts'
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { RequiredMap } from '../../types/object/types.ts'
 * @import { Check, Platform } from '../smart/types.ts'
 * @import { File, Manifest, Rung, Tree } from './types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { collectRead, casAddFile } from '../../cas/module.f.mjs'
import { branchCas, snapshot } from '../../cas/git/module.f.mjs'
import { exactArgs } from '../../cli/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, orElse, pureOk, refuse, resultStep, step } from '../../effects/module.f.mjs'
import { access, execFile, exitStep, isNotFound, mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { oidBytes } from '../../git/format/module.f.mjs'
import { hexText, tryFromHexOf } from '../../git/oid/module.f.mjs'
import { tryCommonDir } from '../../git/repo/module.f.mjs'
import { stringifySorted } from '../../media/json/module.f.mjs'
import { join } from '../../path/module.f.js'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { maxLengthBytes, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import * as pins from '../config/module.f.js'
import { checks as jobChecks, platform as jobPlatform } from '../smart/module.f.mjs'
import { jobs } from '../self/module.f.mjs'
import { select } from './inputs/module.f.js'
import { main as publish } from './publish/module.f.mjs'

const digest = computeSync(sha256)
const chunks = u8ListToVecChunksMsb(Number(maxLengthBytes))

/** @type {(value: Unknown) => Vec} */
const contentHash = value => digest(chunks(stringToU8List(stringifySorted(value))))

/** Canonical JSON's existing SHA-256 CAS identity, with no publication. @type {(value: Unknown) => string} */
export const keyOf = value => vecToCBase32(contentHash(value))

/** The input groups each rung reads, including its lower rungs. @type {RequiredMap<Rung, readonly Rung[]>} */
const above = { fjs: ['fjs', 'js', 'ts'], js: ['js', 'ts'], ts: ['ts'], rust: ['rust'] }

/** A file added to its nested, repository-relative manifest tree. @type {(tree: Tree, path: readonly string[], id: string) => Tree} */
const setFile = (tree, [first, ...rest], id) => {
    const prior = tree[first]
    return { ...tree, [first]: rest.length === 0 ? id : setFile(typeof prior === 'object' ? prior : {}, rest, id) }
}

/**
 * Four input trees, including the deliberate overlaps between generated code
 * and Rust's workspace. An unclassified tracked file fails enumeration.
 *
 * @type {(files: readonly File[]) => Effect<never, RequiredMap<Rung, Tree>, IoChannel>}
 */
export const inputTrees = files => foldStep(pureOk(files), /** @type {RequiredMap<Rung, Tree>} */ ({ fjs: {}, js: {}, ts: {}, rust: {} }), ([path, id]) => trees => {
    const groups = select(path)
    return groups === null
        ? refuse('ERR_CI_INPUT')(`classify the tracked build input: ${path}`)
        : pureOk(groups.flatMap(group => above[group]).reduce((t, group) => ({ ...t, [group]: setFile(t[group], path.split('/'), id) }), trees))
})

/** The chained input manifests; a higher rung includes the one below by key. @type {(trees: RequiredMap<Rung, Tree>) => RequiredMap<Rung, string>} */
export const inputKeys = trees => {
    const contract = keyOf({ inputs: 1 })
    const fjs = keyOf({ contract, files: trees.fjs })
    const js = keyOf({ contract, files: trees.js, below: fjs })
    return { fjs, js, ts: keyOf({ contract, files: trees.ts, below: js }), rust: keyOf({ contract, files: trees.rust }) }
}

/** One check's identity over its rung, distinct even when two checks share inputs. @type {(check: Check, platform: Platform, inputs: RequiredMap<Rung, string>, trees: RequiredMap<Rung, Tree>) => Manifest} */
export const checkManifest = (check, platform, inputs, trees) => ({
    contract: keyOf({ version: 1, check: check.id, commands: check.steps, platform, tools: pins }),
    files: trees[check.rung],
    below: inputs[check.rung],
})

/** One NUL-delimited ls-tree record; the first tab separates metadata from the literal path. @type {(width: OidBytes, record: string) => Effect<never, File, IoChannel>} */
const treeFile = (width, record) => {
    const tab = record.indexOf('\t')
    const header = record.slice(0, tab).split(' ')
    const [mode, kind, hex] = header
    const name = record.slice(tab + 1)
    if (tab === -1 || header.length !== 3 || name === '') {
        return refuse('ERR_CI_TREE')('invalid git ls-tree record')
    }
    if (!['100644', '100755'].includes(mode) || kind !== 'blob') {
        return refuse('ERR_CI_INPUT')(`unsupported committed input mode: ${name}`)
    }
    const id = tryFromHexOf(width)(stringToU8List(hex))
    return id === null
        ? refuse('ERR_CI_TREE')(`invalid committed blob id: ${name}`)
        : pureOk([name, vecToCBase32(id)])
}

/** Enumerates committed blob ids in one Git process, without reading source blobs or working-tree files. @type {(width: OidBytes) => (commit: Oid) => Effect<ExecFile, readonly File[], IoChannel>} */
export const committedFiles = width => commit => {
    const listed = execFile('git', ['ls-tree', '-r', '-z', '--full-tree', hexText(commit), '--'])
    return step(listed, ({ stdout }) => {
        if (stdout !== '' && !stdout.endsWith('\u0000')) {
            return refuse('ERR_CI_TREE')('unterminated git ls-tree output')
        }
        return foldStep(pureOk(stdout.split('\u0000').slice(0, -1)), /** @type {readonly File[]} */ ([]), record => files =>
            mapStep(treeFile(width, record), file => [...files, file]))
    })
}

/** The action's temporary directory is outside the source checkout. @type {(env: Env) => string} */
const manifestDirectory = env => join(env.RUNNER_TEMP ?? '', `fjs-ci-${env.GITHUB_JOB ?? ''}`)

/** The local branch's repository; CI invokes this from the checkout root. */
const repository = () => step(tryCommonDir('.'), dir => dir === null
    ? refuse('ERR_CI_REPOSITORY')('run from the Git checkout root')
    : pureOk({ dir, branch: 'build-cache' }))

/** @type {(options: NodeProgramOptions) => Effect<NodeOp, 0, number>} */
export const init = ({ env }) => {
    const checks = history(resultStep(access('Cargo.toml'), result => {
        const id = env.GITHUB_JOB ?? ''
        const job = jobs(result[0] === 'ok')[id]
        return job === undefined
            ? refuse('ERR_CI_JOB')('GITHUB_JOB must name a configured CI job')
            : pureOk({ checks: jobChecks(id, job), platform: jobPlatform(job['runs-on']) })
    }))
    const platform = historyStep(checks, value => pureOk(value.platform))
    const repo = historyStep(platform, repository)
    const width = historyStep(repo, b => oidBytes(b.dir))
    const files = historyStep(width, w => {
        const commit = w === null ? null : tryFromHexOf(w)(ascii(env.GITHUB_SHA ?? ''))
        return commit === null || w === null
            ? refuse('ERR_CI_COMMIT')('GITHUB_SHA must name the checked-out commit')
            : committedFiles(w)(commit)
    })
    const trees = historyStep(files, inputTrees)
    const cache = historyStep(trees, (_t, _f, _w, b) => snapshot(b))
    const created = historyStep(cache, () => mkdir(manifestDirectory(env), { recursive: true }))
    const prepared = mapStep(created, ([, cas, t, , , , host, cs]) => {
        const inputs = inputKeys(t)
        return cs.checks.map(check => ({ check, manifest: checkManifest(check, host, inputs, t), cas }))
    })
    const outputs = foldStep(prepared, '', ({ check, manifest, cas }) => output => {
        const key = contentHash(manifest)
        const hit = history(catchStep(mapStep(collectRead(cas.read(key)), () => true), orElse(isNotFound, false)))
        const written = historyStep(hit, () => writeUtf8File(join(manifestDirectory(env), `${check.id}.json`), stringifySorted(manifest)))
        return mapStep(written, ([, found]) => `${output}hit-${check.id}=${found}\n`)
    })
    const written = step(outputs, output => writeUtf8File(env.GITHUB_OUTPUT ?? '', output))
    return exitStep(written)
}

/** @type {(options: NodeProgramOptions) => Effect<NodeOp, 0, number>} */
export const report = ({ env, args: [check] }) => {
    const author = /** @type {const} */ ({ name: env.GIT_AUTHOR_NAME ?? '', email: env.GIT_AUTHOR_EMAIL ?? '' })
    const cache = step(repository(), b => branchCas(sha256, b, author))
    const added = step(cache, cas => casAddFile(cas)(join(manifestDirectory(env), `${check}.json`)))
    return exitStep(added)
}

/** Cache subcommands, alongside the existing argument-free CI generator. @type {DocumentedCommands<NodeOp>} */
export const commands = [
    {
        names: ['init'], description: 'Look up successful checks for this CI job',
        usage: 'fjs ci init', examples: ['npm start ci init'],
        note: 'GITHUB_JOB selects the checks directly from the repository CI configuration.', docs: 'fjs/ci/cache/README.md',
        handler: exactArgs('ci init', 0)(init),
    },
    {
        names: ['report'], description: 'Record one successful check in build-cache',
        usage: 'fjs ci report <check>', examples: ['npm start ci report tsc'],
        note: 'Run after the check succeeds; publish the local branch with git push.', docs: 'fjs/ci/cache/README.md',
        handler: exactArgs('ci report', 1)(report),
    },
    {
        names: ['publish'], description: 'Publish cache entries, squashing concurrent additions',
        usage: 'fjs ci publish', examples: ['npm start ci publish'],
        note: 'Attempts at most ten pushes, merging in a temporary worktree after rejection.', docs: 'fjs/ci/cache/README.md',
        handler: exactArgs('ci publish', 0)(publish),
    },
]
