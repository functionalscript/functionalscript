/**
 * @import { Check, Platform } from '../smart/types.ts'
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { ExecResult, IoResult, NodeOp, NodeProgramOptions } from '../../effects/node/types.ts'
 * @import { PartialMemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { Oid, OidBytes } from '../../git/types.ts'
 * @import { File, Rung, Tree } from './types.ts'
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { RequiredMap } from '../../types/object/types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { writeObject } from '../../cas/git/module.f.mjs'
import { history, historyStep, ioError, runPure } from '../../effects/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { nodeCommands, readUtf8File, writeFiles } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualAt, virtualOperationMap } from '../../effects/node/virtual/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { hexText, of, tryFromHexOf } from '../../git/oid/module.f.mjs'
import { tryRead as readObject } from '../../git/store/module.f.mjs'
import { write as writeTree } from '../../git/tree/module.f.mjs'
import { stringifySorted } from '../../media/json/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { u8ListToString } from '../../text/utf8/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
import { jobs } from '../self/module.f.mjs'
import { checks as jobChecks, platform as jobPlatform } from '../smart/module.f.mjs'
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

/** @type {(fs: readonly File[]) => RequiredMap<Rung, Tree>} */
const treesOf = fs => assertOk(pureResult(inputTrees(fs)))

const trees = treesOf(files)
const inputs = inputKeys(trees)

const idOf = of(20)
const sourceId = idOf('blob', ascii('source'))
const regular = /** @type {const} */ ({ mode: ascii('100644'), name: ascii('package.json'), oid: sourceId })
const tree = toArray(writeTree(20)([regular]))
const treeId = idOf('tree', tree)
const commit = ascii(`tree ${hexText(treeId)}\nauthor A <a@b> 1 +0000\ncommitter A <a@b> 1 +0000\n\nsource\n`)
const commitId = idOf('commit', commit)

const sourceListing = `100644 blob ${hexText(sourceId)}\tpackage.json\0`

/** Script Git's captured output while preserving the virtual filesystem. @type {(outcome: IoResult<ExecResult>, target?: Oid) => RunInstance<NodeOp, State>} */
const withGitResult = (outcome, target = commitId) => {
    /** @type {PartialMemOperationMap<NodeOp, State>} */
    const operations = {
        ...virtualOperationMap,
        execFile: (command, args) => state => {
            assertEq(command, 'git')
            assertStructurallySame(args, ['ls-tree', '-r', '-z', '--full-tree', hexText(target), '--'])
            return [state, outcome]
        },
    }
    return partialRun(nodeCommands)(operations)
}

/** @type {(stdout?: string, target?: Oid) => RunInstance<NodeOp, State>} */
const withGit = (stdout = sourceListing, target = commitId) => withGitResult(ok({ stdout, stderr: '' }), target)

/** @type {(stdout: string, width?: OidBytes, target?: Oid) => Result<readonly File[], IoChannel>} */
const enumerated = (stdout, width = 20, target = commitId) => withGit(stdout, target)(emptyState)(committedFiles(width)(target))[1]

const config = /** @type {const} */ ('[core]\nrepositoryformatversion = 0\n[user]\nname = Cache Writer\nemail = cache@example.com\n')

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
        GITHUB_SHA: hexText(commitId), GITHUB_JOB: 'deno', RUNNER_TEMP: 'tmp', GITHUB_OUTPUT: 'tmp/output',
        GIT_AUTHOR_NAME: 'github-actions[bot]',
        GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    },
}

/** @type {(s: State, path: string) => string} */
const textAt = (s, path) => assertOk(virtual(s)(readUtf8File(path))[1])

export const proof = /** @type {const} */ ({
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
    compileHostInputs: () => {
        /** @type {readonly Check[]} */
        const compiles = [
            { id: 'compile', rung: 'fjs', steps: [{ run: 'npm start compile' }] },
            { id: 'spidermonkey-compile', rung: 'fjs', steps: [{ run: 'npm run sm c' }] },
        ]
        // Both hosts execute the Result exception boundary through their effects.
        for (const path of ['fjs/module.mjs', 'fjs/spidermonkey.mjs', 'fjs/types/result/module.mjs']) {
            const before = treesOf([...files, [path, 'before']])
            const after = treesOf([...files, [path, 'after']])
            const beforeInputs = inputKeys(before)
            const afterInputs = inputKeys(after)
            assert(beforeInputs.fjs !== afterInputs.fjs)
            assert(beforeInputs.js !== afterInputs.js)
            assert(beforeInputs.ts !== afterInputs.ts)
            assertEq(beforeInputs.rust, afterInputs.rust)
            for (const compile of compiles) {
                assert(keyOf(checkManifest(compile, platform, beforeInputs, before))
                    !== keyOf(checkManifest(compile, platform, afterInputs, after)))
            }
        }
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
        assertStructurallySame(assertOk(enumerated(sourceListing)), [['package.json', vecToCBase32(sourceId)]])
        assertStructurallySame(assertOk(enumerated('')), [])
        const path = /** @type {const} */ (' fjs/café\tline\nmodule.f.js \n')
        assertStructurallySame(assertOk(enumerated(`${sourceListing}100755 blob ${hexText(sourceId)}\t${path}\0`)), [
            ['package.json', vecToCBase32(sourceId)], [path, vecToCBase32(sourceId)],
        ])
        const hash256 = of(32)
        const source256 = hash256('blob', ascii('source'))
        const commit256 = hash256('commit', ascii('commit'))
        assertStructurallySame(assertOk(enumerated(`100644 blob ${hexText(source256)}\tfjs/module.f.js\0`, 32, commit256)), [
            ['fjs/module.f.js', vecToCBase32(source256)],
        ])
    },
    malformedListing: () => {
        const hex = hexText(sourceId)
        for (const stdout of [
            sourceListing.slice(0, -1),
            `100644 blob ${hex} package.json\0`,
            `100644 blob\tpackage.json\0`,
            `100644 blob ${hex} extra\tpackage.json\0`,
            `100644  blob ${hex}\tpackage.json\0`,
            `100644 blob ${hex}\t\0`,
            `100644 blob ${'g'.repeat(40)}\tpackage.json\0`,
            `100644 blob ${hex.slice(2)}\tpackage.json\0`,
            `100644 blob ${hex}00\tpackage.json\0`,
            '\0',
            `${sourceListing}\0`,
        ]) {
            const refused = assertError(enumerated(stdout))
            assertEq(refused[0] === 'ioError' ? refused[1].code : '', 'ERR_CI_TREE')
        }
    },
    unsupportedInputs: () => {
        for (const header of ['120000 blob', '160000 commit', '040000 tree', '100644 commit', '100755 tree']) {
            const refused = assertError(enumerated(`${header} ${hexText(sourceId)}\tunsupported\0`))
            assertEq(refused[0] === 'ioError' ? refused[1].code : '', 'ERR_CI_INPUT')
        }
    },
    gitFailures: () => {
        for (const failure of [
            ioError({ code: 'ENOENT', message: 'git unavailable' }),
            ioError({ message: 'git ls-tree exited with code 128' }),
        ]) {
            const run = withGitResult(error(failure))
            assertStructurallySame(assertError(run(emptyState)(committedFiles(20)(commitId))[1]), failure)
            assertError(run(seeded())(init(options))[1])
        }
    },
    roundTrip: () => {
        const before = seeded()
        const [miss, result] = withGit()(before)(init(options))
        assertOk(result)
        assertEq(textAt(miss, 'tmp/output'), 'hit-suite=false\n')
        const manifest = textAt(miss, 'tmp/fjs-ci-deno/suite.json')
        assert(manifest.includes(vecToCBase32(sourceId)))
        const [added, reported] = virtual(miss)(report({ ...options, args: ['suite'] }))
        assertOk(reported)
        const [again, rereported] = virtual(added)(report({ ...options, args: ['suite'] }))
        assertOk(rereported)
        assertStructurallySame(again.root, added.root)
        const [hit, hitResult] = withGit()(again)(init(options))
        assertOk(hitResult)
        assertEq(textAt(hit, 'tmp/output'), 'hit-suite=true\n')
        assertEq(textAt(hit, 'tmp/fjs-ci-deno/suite.json'), manifest)
        assertEq(textAt(hit, '.git/config'), config)
    },
    configuredJobs: () => {
        const inputTree = treesOf([['package.json', vecToCBase32(sourceId)]])
        const keys = inputKeys(inputTree)
        for (const rust of [false, true]) {
            const [state, written] = virtual(seeded())(writeFiles(rust ? [['Cargo.toml', '']] : []))
            assertOk(written)
            for (const [id, job] of definedEntries(jobs(rust))) {
                const [initialized, result] = withGit()(state)(init({ ...options, env: { ...options.env, GITHUB_JOB: id } }))
                assertOk(result)
                const checks = jobChecks(id, job)
                assertEq(textAt(initialized, 'tmp/output'), checks.map(check => `hit-${check.id}=false\n`).join(''))
                for (const check of checks) {
                    assertEq(textAt(initialized, `tmp/fjs-ci-${id}/${check.id}.json`),
                        stringifySorted(checkManifest(check, jobPlatform(job['runs-on']), keys, inputTree)))
                }
            }
        }
    },
    initRefusals: () => {
        const state = seeded()
        for (const env of [
            { ...options.env, GITHUB_JOB: 'unknown' },
            { ...options.env, GITHUB_SHA: 'not-a-sha' },
            {},
        ]) { assertError(withGit()(state)(init({ ...options, env }))[1]) }
        for (const name of ['GITHUB_JOB', 'GITHUB_SHA', 'GITHUB_OUTPUT']) {
            const env = Object.fromEntries(Object.entries(options.env).filter(([key]) => key !== name))
            assertError(withGit()(state)(init({ ...options, env }))[1])
        }
        for (const name of ['RUNNER_TEMP']) {
            const env = Object.fromEntries(Object.entries(options.env).filter(([key]) => key !== name))
            assertOk(withGit()(state)(init({ ...options, env }))[1])
        }
        assertError(withGit()({ ...emptyState, root: { '.git': [utf8('bad')], tmp: {} } })(init(options))[1])
        /** @type {Dir} */
        const malformed = { ...root, '.git': { config: [utf8('[core]\nrepositoryformatversion = 99\n')], objects: { pack: {} } } }
        assertError(withGit()({ ...emptyState, root: malformed })(init(options))[1])
        const [corrupt, written] = virtual(state)(writeFiles([['.git/refs/heads/build-cache', 'not a ref\n']]))
        assertOk(written)
        assertError(withGit()(corrupt)(init(options))[1])
    },
    reportRefusal: () => {
        for (const name of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GITHUB_JOB']) {
            const env = Object.fromEntries(Object.entries(options.env).filter(([key]) => key !== name))
            assertError(virtual(seeded())(report({ ...options, env, args: ['suite'] }))[1])
        }
    },
    reportWithCheckoutIncludes: () => {
        const included = `${config}[includeIf "gitdir:/runner/_work/functionalscript/functionalscript/.git"]\npath = /runner/_temp/checkout-auth.config\n`
        const [checkout, configured] = virtual(seeded())(writeFiles([['.git/config', included]]))
        assertOk(configured)
        const [miss, initialized] = withGit()(checkout)(init(options))
        assertOk(initialized)
        const [added, reported] = virtual(miss)(report({ ...options, args: ['suite'] }))
        assertOk(reported)
        const id = assertNotNullish(tryFromHexOf(20)(ascii(textAt(added, '.git/refs/heads/build-cache').trim())))
        const commit = assertNotNullish(assertOk(virtual(added)(readObject('.git', 20)(id))[1]))
        assertEq(commit.type, 'commit')
        const text = u8ListToString(commit.payload)
        assert(text.includes('author github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>'))
        assert(text.includes('committer github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>'))
        const [hit, rechecked] = withGit()(added)(init(options))
        assertOk(rechecked)
        assertEq(textAt(hit, 'tmp/output'), 'hit-suite=true\n')
        assertEq(textAt(hit, '.git/config'), included)
    },
})
