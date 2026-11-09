/**
 * Successful coverage manifests through the real CLI, Git objects and local
 * remotes. Every repository and publication target is confined to a fixture.
 */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../module.mjs', import.meta.url))

/** A fixture's Git commands cannot inherit another checkout's Git paths. */
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !name.startsWith('GIT_') && !['NODE_TEST_CONTEXT', 'INIT_CWD', 'NODE_OPTIONS', 'RUNNER_TEMP'].includes(name)))

const env = {
    ...environment,
    GIT_AUTHOR_NAME: 'Coverage Fixture', GIT_AUTHOR_EMAIL: 'coverage@example.com',
    GIT_COMMITTER_NAME: 'Coverage Fixture', GIT_COMMITTER_EMAIL: 'coverage@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
}

/** @type {(cwd: string, executable: string, args: readonly string[]) => { readonly status: number | null, readonly stdout: string, readonly stderr: string, readonly output: string }} */
const execute = (cwd, executable, args) => {
    const result = spawnSync(executable, args, {
        cwd,
        env: {
            ...env,
            GIT_CONFIG_GLOBAL: join(cwd, '.coverage-global-config'),
            RUNNER_TEMP: join(cwd, '.coverage-tmp'),
        },
        encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1_024 * 1_024,
    })
    assert.ifError(result.error)
    assert.equal(result.signal, null, result.stdout + result.stderr)
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: result.stdout + result.stderr }
}

/** @type {(cwd: string, args: readonly string[]) => string} */
const git = (cwd, args) => {
    const result = execute(cwd, 'git', args)
    assert.equal(result.status, 0, result.output)
    return result.stdout.trimEnd()
}

/** @type {(run: (root: string) => void) => void} */
const withFixture = run => {
    const root = mkdtempSync(join(tmpdir(), 'fjs-cov-cache-'))
    try {
        run(root)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

/** @type {(root: string, path: string, contents: string) => void} */
const write = (root, path, contents) => {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
}

/** @type {(root: string) => void} */
const identify = root => {
    git(root, ['config', 'user.name', 'Coverage Fixture'])
    git(root, ['config', 'user.email', 'coverage@example.com'])
    git(root, ['config', 'commit.gpgsign', 'false'])
}

/** @type {(root: string, directories: readonly string[]) => void} */
const initialize = (root, directories) => {
    mkdirSync(root, { recursive: true })
    git(root, ['init', '--quiet', '--initial-branch=main'])
    identify(root)
    write(root, 'package.json', '{"type":"module"}\n')
    for (const directory of directories) {
        write(root, `${directory}/helper.f.js`, 'export const helper = () => 1;\n')
        write(root, `${directory}/module.f.js`, 'import { helper } from "./helper.f.js"; export const value = () => helper();\n')
        write(root, `${directory}/proof.f.mjs`, 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); return undefined; } };\n')
    }
    git(root, ['add', '.'])
    git(root, ['commit', '--quiet', '-m', 'source fixture'])
}

/** @type {(cwd: string, synchronize?: boolean, status?: number) => string} */
const coverage = (cwd, synchronize = false, status = 0) => {
    const result = execute(cwd, process.execPath, [cli, 'cov', 'node', ...(synchronize ? ['--sync'] : [])])
    assert.equal(result.status, status, result.output)
    assert(!result.output.includes('UNCACHED'), result.output)
    assert(!result.output.includes('CACHE '), result.output)
    return result.output
}

/** @type {(root: string) => { readonly head: string, readonly index: Buffer, readonly worktrees: string }} */
const sourceState = root => ({
    head: git(root, ['rev-parse', 'HEAD']),
    index: readFileSync(join(root, '.git/index')),
    worktrees: git(root, ['worktree', 'list', '--porcelain']),
})

/** @type {(root: string) => readonly string[]} */
const entries = root => git(root, ['ls-tree', '-r', '--name-only', 'build-cache']).split('\n')

export const proof = process.versions.bun || process.versions.deno ? {} : {
    localSuccessAndInvalidation: () => withFixture(root => {
        const repo = join(root, 'source')
        initialize(repo, ['unit'])
        const before = sourceState(repo)
        const modulePath = join(repo, 'unit/module.f.js')
        const moduleBefore = readFileSync(modulePath)
        const cold = coverage(join(repo, 'unit'))
        assert(cold.includes('command:'), cold)
        assert(cold.includes('0 cached'), cold)
        assert.equal(entries(repo).length, 1)
        const first = git(repo, ['rev-parse', 'build-cache'])

        const warm = coverage(join(repo, 'unit'))
        assert(warm.includes('CACHED '), warm)
        assert(!warm.includes('command:'), warm)
        assert.equal(git(repo, ['rev-parse', 'build-cache']), first)

        // Package scopes affect how Node loads .f.js files even when their
        // source bytes are unchanged. New nested scopes count as inputs too.
        for (const scope of ['package.json', 'unit/package.json']) {
            write(repo, scope, '{"type":"commonjs"}\n')
            const incompatible = coverage(join(repo, 'unit'), false, 1)
            assert(incompatible.includes('command:'), incompatible)
            assert(!incompatible.includes('CACHED '), incompatible)
            assert.equal(git(repo, ['rev-parse', 'build-cache']), first)
            if (scope === 'package.json') write(repo, scope, '{"type":"module"}\n')
            else rmSync(join(repo, scope))
            const restored = coverage(join(repo, 'unit'))
            assert(restored.includes('CACHED '), restored)
            assert(!restored.includes('command:'), restored)
        }

        write(repo, 'unit/helper.f.js', 'export const helper = () => 2;\n')
        const changed = coverage(join(repo, 'unit'))
        assert(changed.includes('command:'), changed)
        assert(!changed.includes('CACHED '), changed)
        assert.equal(entries(repo).length, 2)
        const successful = git(repo, ['rev-parse', 'build-cache'])
        assert.notEqual(successful, first)

        write(repo, 'unit/proof.f.mjs', 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); throw "fixture failure"; } };\n')
        const failed = coverage(join(repo, 'unit'), false, 1)
        assert(failed.includes('FAIL '), failed)
        assert.equal(git(repo, ['rev-parse', 'build-cache']), successful)
        assert.equal(entries(repo).length, 2)
        assert.deepEqual(sourceState(repo), before)
        assert.deepEqual(readFileSync(modulePath), moduleBefore)
        assert.equal(git(repo, ['status', '--porcelain']), ' M unit/helper.f.js\n M unit/proof.f.mjs')
    }),
    remoteReplayAndSharedSuccesses: () => withFixture(root => {
        const origin = join(root, 'origin.git')
        const seed = join(root, 'seed')
        const a = join(root, 'job-a')
        const b = join(root, 'job-b')
        mkdirSync(origin)
        git(origin, ['init', '--bare', '--quiet', '--initial-branch=main'])
        initialize(seed, ['a', 'b', 'c'])
        git(seed, ['remote', 'add', 'origin', origin])
        git(seed, ['push', '--quiet', 'origin', 'main'])
        git(root, ['clone', '--quiet', origin, a])
        git(root, ['clone', '--quiet', origin, b])
        identify(a)
        identify(b)
        const aBefore = sourceState(a)
        const bBefore = sourceState(b)

        const first = coverage(join(a, 'a'), true)
        assert(first.includes('command:'), first)
        const firstTip = git(origin, ['rev-parse', 'build-cache'])
        const shared = coverage(join(b, 'a'), true)
        assert(shared.includes('CACHED '), shared)
        assert(!shared.includes('command:'), shared)
        assert.equal(git(origin, ['rev-parse', 'build-cache']), firstTip)

        const pending = coverage(join(a, 'b'))
        assert(pending.includes('command:'), pending)
        const aEntries = entries(a)
        assert.equal(aEntries.length, 2)
        assert.equal(git(origin, ['rev-parse', 'build-cache']), firstTip)
        const advancing = coverage(join(b, 'c'), true)
        assert(advancing.includes('command:'), advancing)
        const bEntries = entries(b)
        assert.equal(bEntries.length, 2)
        const advancedTip = git(origin, ['rev-parse', 'build-cache'])
        assert.notEqual(advancedTip, firstTip)

        const replayed = coverage(join(a, 'b'), true)
        assert(replayed.includes('CACHED '), replayed)
        assert(!replayed.includes('command:'), replayed)
        const union = [...new Set([...aEntries, ...bEntries])].sort()
        assert.equal(union.length, 3)
        assert.deepEqual(entries(origin), union)
        assert.deepEqual(entries(a), union)
        git(origin, ['merge-base', '--is-ancestor', firstTip, 'build-cache'])
        git(origin, ['merge-base', '--is-ancestor', advancedTip, 'build-cache'])
        for (const line of git(origin, ['rev-list', '--parents', 'build-cache']).split('\n')) {
            assert(line.split(' ').length <= 2, line)
        }
        const imported = coverage(join(a, 'c'))
        assert(imported.includes('CACHED '), imported)
        assert(!imported.includes('command:'), imported)
        assert.deepEqual(sourceState(a), aBefore)
        assert.deepEqual(sourceState(b), bBefore)
        assert.equal(git(a, ['status', '--porcelain']), '')
        assert.equal(git(b, ['status', '--porcelain']), '')
    }),
}
