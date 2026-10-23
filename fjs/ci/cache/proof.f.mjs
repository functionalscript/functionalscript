/**
 * @import { Check, Platform } from '../smart/types.ts'
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { Envelope } from '../../git/object/types.ts'
 * @import { Oid } from '../../git/types.ts'
 * @import { File, Rung, Tree } from './types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { writeObject } from '../../cas/git/module.f.mjs'
import { history, historyStep, pureOk, runPure } from '../../effects/module.f.mjs'
import { readUtf8File, writeFiles } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, virtual, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { hexText, of } from '../../git/oid/module.f.mjs'
import { write as writeTree } from '../../git/tree/module.f.mjs'
import { stringifySorted } from '../../media/json/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { checkManifest, committedFiles, init, inputKeys, inputTrees, keyOf, report } from './module.f.mjs'

/** @type {Check} */
const check = { id: 'suite', rung: 'js', steps: [{ run: 'node --test' }] }

/** @type {Platform} */
const platform = { os: 'ubuntu', version: '26.04', architecture: 'arm64' }

/** @type {readonly File[]} */
const files = [
    ['fjs/a/module.f.js', 'a'], ['fjs/a/proof.f.mjs', 'b'],
    ['other.mjs', 'c'], ['types.ts', 'd'], ['nanvm/lib/src/lib.rs', 'r'], ['doc/DESIGN.md', 'ignored'],
]

/** @template T, E @param {Effect<never, T, E>} e @returns {Result<T, E>} */
const pureResult = e => assertNotNullish(runPure(e)[0])

/** @type {(fs: readonly File[]) => Readonly<Record<Rung, Tree>>} */
const treesOf = fs => assertOk(pureResult(inputTrees(fs)))

const trees = treesOf(files)
const inputs = inputKeys(trees)

const idOf = of(20)
const sourceId = idOf('blob', ascii('source'))
const regular = { mode: ascii('100644'), name: ascii('package.json'), oid: sourceId }
const tree = toArray(writeTree(20)([regular]))
const treeId = idOf('tree', tree)
const commit = ascii(`tree ${hexText(treeId)}\nauthor A <a@b> 1 +0000\ncommitter A <a@b> 1 +0000\n\nsource\n`)
const commitId = idOf('commit', commit)

/** Source blobs are deliberately absent: enumeration needs their ids alone. @type {(id: Oid) => Envelope | null} */
const sourceObject = id => id === commitId ? { type: 'commit', payload: commit }
    : id === treeId ? { type: 'tree', payload: tree } : null

const config = '[core]\nrepositoryformatversion = 0\n[user]\nname = Cache Writer\nemail = cache@example.com\n'

/** @type {Dir} */
const root = { '.git': { config: [utf8(config)], objects: { pack: {} } }, tmp: {}, home: {} }

/** The native writer seeds just the tree and commit; no parent or source blob exists. @type {() => State} */
const seeded = () => {
    const write = writeObject('.git', 20)
    const t = history(write('tree', tree))
    const c = historyStep(t, () => write('commit', commit))
    const [state, result] = virtualAt(root)(c)
    assertOk(result)
    return state
}

/** @type {NodeProgramOptions} */
const options = {
    ...defaultNodeProgramOptions,
    home: 'home',
    env: {
        FJS_CI_CHECKS: stringifySorted([check]), FJS_CI_PLATFORM: stringifySorted(platform),
        GITHUB_SHA: hexText(commitId), GITHUB_JOB: 'node', RUNNER_TEMP: 'tmp', GITHUB_OUTPUT: 'tmp/output',
    },
}

/** @type {(s: State, path: string) => string} */
const textAt = (s, path) => assertOk(virtual(s)(readUtf8File(path))[1])

export const proof = {
    keys: () => {
        assertEq(keyOf({ z: 1, a: { z: 2, a: 3 } }), keyOf({ a: { a: 3, z: 2 }, z: 1 }))
        assert(keyOf(['test', 'lint']) !== keyOf(['lint', 'test']))
        assertStructurallySame(treesOf(files.toReversed()), trees)
        assertStructurallySame(trees.js.fjs, trees.fjs.fjs)
        assertStructurallySame(trees.ts, { ...trees.js, 'types.ts': 'd' })
        assertError(pureResult(inputTrees([['unexpected.dat', 'x']])))
    },
    rungs: () => {
        const changedTs = inputKeys(treesOf(files.map(([p, id]) => [p, p === 'types.ts' ? 'changed' : id])))
        assertEq(changedTs.fjs, inputs.fjs)
        assertEq(changedTs.js, inputs.js)
        assert(changedTs.ts !== inputs.ts)
        assertEq(changedTs.rust, inputs.rust)
        const changedJs = inputKeys(treesOf(files.map(([p, id]) => [p, p === 'other.mjs' ? 'changed' : id])))
        assertEq(changedJs.fjs, inputs.fjs)
        assert(changedJs.js !== inputs.js)
        assert(changedJs.ts !== inputs.ts)
        const changedFjs = inputKeys(treesOf(files.map(([p, id]) => [p, p === 'fjs/a/module.f.js' ? 'changed' : id])))
        assert(changedFjs.fjs !== inputs.fjs)
        assert(changedFjs.js !== inputs.js)
        assert(changedFjs.ts !== inputs.ts)
    },
    contracts: () => {
        const manifest = checkManifest(check, platform, inputs, trees)
        assertStructurallySame(manifest.files, trees.js)
        assertEq(keyOf(manifest), keyOf(checkManifest({ ...check }, { ...platform }, { ...inputs }, { ...trees })))
        assert(keyOf(manifest) !== keyOf(checkManifest({ ...check, steps: [{ run: 'node --test other' }] }, platform, inputs, trees)))
        assert(keyOf(manifest) !== keyOf(checkManifest({ ...check, id: 'another-check' }, platform, inputs, trees)))
        assert(keyOf(manifest) !== keyOf(checkManifest(check, { ...platform, architecture: 'x64' }, inputs, trees)))
        assert(keyOf(manifest) !== keyOf(checkManifest({ ...check, steps: [{ run: 'node --test', 'working-directory': 'sub' }] }, platform, inputs, trees)))
    },
    committedFiles: () => {
        const read = /** @type {(id: Oid) => import('../../effects/types.ts').Effect<never, Envelope | null, import('../../effects/types.ts').IoChannel>} */ (id => pureOk(sourceObject(id)))
        assertStructurallySame(assertOk(pureResult(committedFiles(read, 20)(commitId))), [['package.json', vecToCBase32(sourceId)]])
        assertError(pureResult(committedFiles(read, 20)(sourceId)))
        const subTree = toArray(writeTree(20)([{ ...regular, name: ascii('module.f.js') }]))
        const subId = idOf('tree', subTree)
        const parentTree = toArray(writeTree(20)([{ mode: ascii('40000'), name: ascii('fjs'), oid: subId }]))
        const parentId = idOf('tree', parentTree)
        const nested = /** @type {typeof read} */ (id => pureOk(id === parentId ? { type: 'tree', payload: parentTree } : id === subId ? { type: 'tree', payload: subTree } : null))
        assertStructurallySame(assertOk(pureResult(committedFiles(nested, 20)(parentId))), [['fjs/module.f.js', vecToCBase32(sourceId)]])
        for (const mode of ['120000', '160000']) {
            const bytes = toArray(writeTree(20)([{ ...regular, mode: ascii(mode) }]))
            const id = idOf('tree', bytes)
            const unusual = /** @type {typeof read} */ (() => pureOk({ type: 'tree', payload: bytes }))
            assertError(pureResult(committedFiles(unusual, 20)(id)))
        }
    },
    roundTrip: () => {
        const before = seeded()
        const [miss, result] = virtual(before)(init(options))
        assertOk(result)
        assertEq(textAt(miss, 'tmp/output'), 'hit-suite=false\n')
        const manifest = textAt(miss, 'tmp/fjs-ci-node/suite.json')
        assert(manifest.includes(vecToCBase32(sourceId)))
        const [added, reported] = virtual(miss)(report({ ...options, args: ['suite'] }))
        assertOk(reported)
        const [again, rereported] = virtual(added)(report({ ...options, args: ['suite'] }))
        assertOk(rereported)
        assertStructurallySame(again.root, added.root)
        const [hit, hitResult] = virtual(again)(init(options))
        assertOk(hitResult)
        assertEq(textAt(hit, 'tmp/output'), 'hit-suite=true\n')
        assertEq(textAt(hit, 'tmp/fjs-ci-node/suite.json'), manifest)
        assertEq(textAt(hit, '.git/config'), config)
    },
    initRefusals: () => {
        const state = seeded()
        for (const env of [
            { ...options.env, FJS_CI_CHECKS: 'bad' },
            { ...options.env, FJS_CI_CHECKS: '{}' },
            { ...options.env, FJS_CI_PLATFORM: 'bad' },
            { ...options.env, GITHUB_SHA: 'not-a-sha' },
            {},
        ]) { assertError(virtual(state)(init({ ...options, env }))[1]) }
        for (const name of ['FJS_CI_PLATFORM', 'GITHUB_SHA', 'GITHUB_OUTPUT']) {
            const env = Object.fromEntries(Object.entries(options.env).filter(([key]) => key !== name))
            assertError(virtual(state)(init({ ...options, env }))[1])
        }
        for (const name of ['RUNNER_TEMP', 'GITHUB_JOB']) {
            const env = Object.fromEntries(Object.entries(options.env).filter(([key]) => key !== name))
            assertOk(virtual(state)(init({ ...options, env }))[1])
        }
        assertError(virtualAt({ '.git': [utf8('bad')], tmp: {} })(init(options))[1])
        const malformed = { ...root, '.git': { config: [utf8('[core]\nrepositoryformatversion = 99\n')], objects: { pack: {} } } }
        assertError(virtualAt(malformed)(init(options))[1])
        const [corrupt, written] = virtual(state)(writeFiles([['.git/refs/heads/build-cache', 'not a ref\n']]))
        assertOk(written)
        assertError(virtual(corrupt)(init(options))[1])
    },
    reportRefusal: () => {
        const noAuthor = { ...root, '.git': { config: [utf8('[core]\nrepositoryformatversion = 0\n')], objects: { pack: {} } } }
        assertError(virtualAt(noAuthor)(report({ ...options, args: ['suite'] }))[1])
    },
}
