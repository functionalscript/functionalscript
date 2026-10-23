/**
 * Successful checks over committed inputs. Init reads Git trees, looks up each
 * check's manifest on build-cache and leaves that exact manifest outside the
 * checkout. Report adds it after the check passes; GitHub's steps own the push.
 *
 * @module
 *
 * @import { Effect, IoChannel, Operation } from '../../effects/types.ts'
 * @import { NodeOp, Env, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { DocumentedCommands } from '../../cli/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { Oid, OidBytes } from '../../git/types.ts'
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Check, Platform } from '../smart/types.ts'
 * @import { File, Manifest, Rung, Tree } from './types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { collectRead, casAddFile } from '../../cas/module.f.mjs'
import { branchCas, configuredAuthor, snapshot } from '../../cas/git/module.f.mjs'
import { exactArgs } from '../../cli/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { catchStep, foldStep, history, historyStep, mapStep, orElse, pureOk, refuse, step } from '../../effects/module.f.mjs'
import { exitStep, isNotFound, mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { oidBytes } from '../../git/format/module.f.mjs'
import { tryFromHexOf } from '../../git/oid/module.f.mjs'
import { tryCommonDir } from '../../git/repo/module.f.mjs'
import { objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { isSubtree } from '../../git/tree/module.f.mjs'
import { tryEntries } from '../../git/walk/module.f.mjs'
import { parse, stringifySorted } from '../../media/json/module.f.mjs'
import { join } from '../../path/module.f.mjs'
import { parse as parseType } from '../../rtti/parse/module.f.mjs'
import { stringToU8List, u8ListToString } from '../../text/utf8/module.f.mjs'
import { maxLengthBytes, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import * as pins from '../config/module.f.js'
import { checksSchema, platformSchema } from '../smart/module.f.mjs'
import { select } from './inputs/module.f.js'

const digest = computeSync(sha256)
const chunks = u8ListToVecChunksMsb(Number(maxLengthBytes))

/** @type {(value: Unknown) => Vec} */
const contentHash = value => digest(chunks(stringToU8List(stringifySorted(value))))

/** Canonical JSON's existing SHA-256 CAS identity, with no publication. @type {(value: Unknown) => string} */
export const keyOf = value => vecToCBase32(contentHash(value))

/** The input groups each rung reads, including its lower rungs. @type {Readonly<Record<Rung, readonly Rung[]>>} */
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
 * @type {(files: readonly File[]) => Effect<never, Readonly<Record<Rung, Tree>>, IoChannel>}
 */
export const inputTrees = files => foldStep(pureOk(files), /** @type {Readonly<Record<Rung, Tree>>} */ ({ fjs: {}, js: {}, ts: {}, rust: {} }), ([path, id]) => trees => {
    const groups = select(path)
    return groups === null
        ? refuse('ERR_CI_INPUT')(`classify the tracked build input: ${path}`)
        : pureOk(groups.flatMap(group => above[group]).reduce((t, group) => ({ ...t, [group]: setFile(t[group], path.split('/'), id) }), trees))
})

/** The chained input manifests; a higher rung includes the one below by key. @type {(trees: Readonly<Record<Rung, Tree>>) => Readonly<Record<Rung, string>>} */
export const inputKeys = trees => {
    const contract = keyOf({ inputs: 1 })
    const fjs = keyOf({ contract, files: trees.fjs })
    const js = keyOf({ contract, files: trees.js, below: fjs })
    return { fjs, js, ts: keyOf({ contract, files: trees.ts, below: js }), rust: keyOf({ contract, files: trees.rust }) }
}

/** One check's identity over its rung, distinct even when two checks share inputs. @type {(check: Check, platform: Platform, inputs: Readonly<Record<Rung, string>>, trees: Readonly<Record<Rung, Tree>>) => Manifest} */
export const checkManifest = (check, platform, inputs, trees) => ({
    contract: keyOf({ version: 1, check: check.id, commands: check.steps, platform, tools: pins }),
    files: trees[check.rung],
    below: inputs[check.rung],
})

/**
 * Walks trees alone. Leaf blob ids are reused without reading their objects,
 * and the starting id is the exact commit GitHub checked out.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} width
 * @returns {(commit: Oid) => Effect<O, readonly File[], IoChannel>}
 */
export const committedFiles = (read, width) => {
    const entries = tryEntries(read, width)
    /** @type {(id: Oid, path: string) => Effect<O, readonly File[], IoChannel>} */
    const walk = (id, path) => step(entries(id), es => es === null
        ? refuse('ERR_CI_TREE')(`cannot read the committed tree at ${path}`)
        : foldStep(pureOk(es), /** @type {readonly File[]} */ ([]), e => files => {
            const decoded = u8ListToString(e.name)
            const name = path === '' ? decoded : join(path, decoded)
            return isSubtree(e)
                ? mapStep(walk(e.oid, name), below => [...files, ...below])
                : ['100644', '100755'].includes(u8ListToString(e.mode))
                    ? pureOk([...files, [name, vecToCBase32(e.oid)]])
                    : refuse('ERR_CI_INPUT')(`unsupported committed input mode: ${name}`)
        }))
    return commit => walk(commit, '')
}

const readChecks = parseType(checksSchema)
const readPlatform = parseType(platformSchema)

/** Parse the generator's JSON using the shared RTTI schema. @template T @param {string} text @param {(value: Unknown) => Result<T, unknown>} read @returns {Effect<never, T, IoChannel>} */
const settings = (text, read) => {
    const json = parse(text)
    if (json[0] === 'error') { return refuse('ERR_CI_SETTINGS')(json[1]) }
    const result = read(json[1])
    return result[0] === 'error' ? refuse('ERR_CI_SETTINGS')('invalid CI cache settings') : pureOk(result[1])
}

/** The action's temporary directory is outside the source checkout. @type {(env: Env) => string} */
const manifestDirectory = env => join(env.RUNNER_TEMP ?? '', `fjs-ci-${env.GITHUB_JOB ?? ''}`)

/** The local branch's repository; CI invokes this from the checkout root. */
const repository = () => step(tryCommonDir('.'), dir => dir === null
    ? refuse('ERR_CI_REPOSITORY')('run from the Git checkout root')
    : pureOk({ dir, branch: 'build-cache' }))

/** @type {(options: NodeProgramOptions) => Effect<NodeOp, 0, number>} */
export const init = ({ env }) => {
    const checks = history(settings(env.FJS_CI_CHECKS ?? '', readChecks))
    const platform = historyStep(checks, () => settings(env.FJS_CI_PLATFORM ?? '', readPlatform))
    const repo = historyStep(platform, repository)
    const width = historyStep(repo, b => oidBytes(b.dir))
    const dirs = historyStep(width, (_w, b) => objectsDirs(b.dir))
    const files = historyStep(dirs, (ods, w) => {
        const commit = w === null ? null : tryFromHexOf(w)(ascii(env.GITHUB_SHA ?? ''))
        return commit === null || w === null
            ? refuse('ERR_CI_COMMIT')('GITHUB_SHA must name the checked-out commit')
            : committedFiles(readIn(ods, w), w)(commit)
    })
    const trees = historyStep(files, inputTrees)
    const cache = historyStep(trees, (_t, _f, _ods, _w, b) => snapshot(b))
    const created = historyStep(cache, () => mkdir(manifestDirectory(env), { recursive: true }))
    const outputs = step(created, ([, cas, t, , , , , host, cs]) => {
        const inputs = inputKeys(t)
        return foldStep(pureOk(cs), '', check => output => {
            const manifest = checkManifest(check, host, inputs, t)
            const key = contentHash(manifest)
            const hit = history(catchStep(mapStep(collectRead(cas.read(key)), () => true), orElse(isNotFound, false)))
            const written = historyStep(hit, () => writeUtf8File(join(manifestDirectory(env), `${check.id}.json`), stringifySorted(manifest)))
            return mapStep(written, ([, found]) => `${output}hit-${check.id}=${found}\n`)
        })
    })
    const written = step(outputs, output => writeUtf8File(env.GITHUB_OUTPUT ?? '', output))
    return exitStep(written)
}

/** @type {(options: NodeProgramOptions) => Effect<NodeOp, 0, number>} */
export const report = ({ env, home, args: [check] }) => {
    const repo = history(repository())
    const author = historyStep(repo, b => configuredAuthor(b.dir, home))
    const cache = step(author, ([a, b]) => a === null
        ? refuse('ERR_CI_AUTHOR')('configure user.name and user.email before reporting')
        : branchCas(sha256, b, a))
    const added = step(cache, cas => casAddFile(cas)(join(manifestDirectory(env), `${check}.json`)))
    return exitStep(added)
}

/** Cache subcommands, alongside the existing argument-free CI generator. @type {DocumentedCommands<NodeOp>} */
export const commands = [
    {
        names: ['init'], description: 'Look up successful checks for this CI job',
        usage: 'fjs ci init', examples: ['npm start ci init'],
        note: 'The generated workflow supplies check definitions and temporary paths.', docs: 'fjs/ci/cache/README.md',
        handler: exactArgs('ci init', 0)(init),
    },
    {
        names: ['report'], description: 'Record one successful check in build-cache',
        usage: 'fjs ci report <check>', examples: ['npm start ci report tsc'],
        note: 'Run after the check succeeds; publish the local branch with git push.', docs: 'fjs/ci/cache/README.md',
        handler: exactArgs('ci report', 1)(report),
    },
]
