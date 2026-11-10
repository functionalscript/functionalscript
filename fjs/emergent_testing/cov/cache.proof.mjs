/**
 * Successful coverage manifests through the real CLI, Git objects and local
 * remotes. Every repository and publication target is confined to a fixture.
 */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { toPath } from '../../cas/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'

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

/** @type {(cwd: string, executable: string, args: readonly string[], extraEnv?: Readonly<Record<string, string>>, input?: string) => { readonly status: number | null, readonly stdout: string, readonly stderr: string, readonly output: string }} */
const execute = (cwd, executable, args, extraEnv = {}, input) => {
    const result = spawnSync(executable, args, {
        cwd,
        env: {
            ...env,
            GIT_CONFIG_GLOBAL: join(cwd, '.coverage-global-config'),
            RUNNER_TEMP: join(cwd, '.coverage-tmp'),
            ...extraEnv,
        },
        encoding: 'utf8', input, timeout: 30_000, maxBuffer: 4 * 1_024 * 1_024,
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

/** @type {(root: string, directories: readonly string[], markers?: boolean) => void} */
const initialize = (root, directories, markers = false) => {
    mkdirSync(root, { recursive: true })
    git(root, ['init', '--quiet', '--initial-branch=main'])
    identify(root)
    write(root, 'package.json', '{"type":"module"}\n')
    // Fixed completion markers count children without adding runtime inputs.
    const proofSource = markers
        ? 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); console.log("CACHE_CHILD_FINISHED fixture"); return undefined; } };\n'
        : 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); return undefined; } };\n'
    for (const directory of directories) {
        write(root, `${directory}/helper.f.js`, 'export const helper = () => 1;\n')
        write(root, `${directory}/module.f.js`, 'import { helper } from "./helper.f.js"; export const value = () => helper();\n')
        write(root, `${directory}/proof.f.mjs`, proofSource)
    }
    git(root, ['add', '.'])
    git(root, ['commit', '--quiet', '-m', 'source fixture'])
}

/** @type {(cwd: string, synchronize?: boolean, status?: number, extraEnv?: Readonly<Record<string, string>>) => string} */
const coverage = (cwd, synchronize = false, status = 0, extraEnv = {}) => {
    const result = execute(cwd, process.execPath, [cli, 'cov', 'node', ...(synchronize ? ['--sync'] : [])], extraEnv)
    assert.equal(result.status, status, result.output)
    assert(!result.output.includes('UNCACHED'), result.output)
    assert(!result.output.includes('CACHE ') && !result.output.includes('CACHE:'), result.output)
    return result.output
}

/** Executed children retain their native test and coverage output. @type {(output: string) => void} */
const nativeOutput = output => {
    assert(output.includes('ℹ tests'), output)
    assert(output.includes('start of coverage report'), output)
    assert(!output.includes('command:'), output)
}

/** Cached targets launch no child and therefore emit no native transcript. @type {(output: string) => void} */
const cachedOutput = output => {
    assert(!output.includes('ℹ tests'), output)
    assert(!output.includes('start of coverage report'), output)
    assert(!output.includes('command:'), output)
}

/** @type {(root: string) => { readonly head: string, readonly index: Buffer, readonly worktrees: string }} */
const sourceState = root => ({
    head: git(root, ['rev-parse', 'HEAD']),
    index: readFileSync(join(root, '.git/index')),
    worktrees: git(root, ['worktree', 'list', '--porcelain']),
})

/** @type {(root: string) => readonly string[]} */
const entries = root => git(root, ['ls-tree', '-r', '--name-only', 'build-cache']).split('\n')

/** Untracked runtime inputs execute naturally on every invocation, without recording success.
 * @type {(source: string, reference: string) => void}
 */
const _uncacheable = (source, reference) => withFixture(root => {
    const repo = join(root, 'source')
    initialize(repo, ['unit'])
    write(repo, 'unit/proof.f.mjs', source)
    const before = sourceState(repo)
    const args = /** @type {const} */ ([cli, 'cov', 'node'])
    const results = /** @type {const} */ ([
        execute(join(repo, 'unit'), process.execPath, args),
        execute(join(repo, 'unit'), process.execPath, args),
    ])
    const output = results.map(result => result.output).join('\n')
    for (const result of results) {
        assert.equal(result.status, 0, output)
        assert(result.output.includes('unit/module.f.js...Ok'), output)
        assert(result.output.includes(`untracked runtime input: ${reference}`), output)
        assert(result.output.includes('UNCACHED'), output)
        assert(!result.output.includes('...Cached'), output)
        nativeOutput(result.output)
    }
    const stored = execute(repo, 'git', ['show-ref', '--verify', '--quiet', 'refs/heads/build-cache'])
    assert.equal(stored.status, 1, stored.output)
    assert.deepEqual(sourceState(repo), before)
    assert.equal(git(repo, ['status', '--porcelain']), ' M unit/proof.f.mjs')
})

/** @type {(path: string) => readonly { readonly argv: readonly string[], readonly time: string }[]} */
const _commands = path => readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    .filter(event => event.event === 'start' && Array.isArray(event.argv))

/** @type {(output: string) => number} */
const _finished = output => output.split('\n').filter(line => line.includes('CACHE_CHILD_FINISHED ')).length

/** Seed canonical SHA-256 CAS entries through one native import, then pack Git's
 * objects. Payload construction reuses the production shard/encoding helpers.
 * @type {(root: string, count: number) => void}
 */
const _seedPacked = (root, count) => {
    const message = 'seed packed coverage cache\n'
    const ident = 'Coverage Fixture <coverage@example.com> 1700000000 +0000'
    const items = Array.from({ length: count }, (_, fixture) => {
        const payload = JSON.stringify({ fixture })
        const key = u8ListToVecMsb([...createHash('sha256').update(payload).digest()])
        return `M 100644 inline ${toPath(key)}\ndata ${Buffer.byteLength(payload)}\n${payload}\n`
    }).join('')
    const input = `commit refs/heads/build-cache\nauthor ${ident}\ncommitter ${ident}\ndata ${Buffer.byteLength(message)}\n${message}\n${items}\ndone\n`
    const imported = execute(root, 'git', ['fast-import', '--quiet', '--date-format=raw', '--done'], {}, input)
    assert.equal(imported.status, 0, imported.output)
    git(root, ['repack', '-ad'])
    assert(readdirSync(join(root, '.git/objects/pack')).some(name => name.endsWith('.pack')))
}

export const proof = process.versions.bun || process.versions.deno ? {} : {
    timeDependentProofsNeverCache: () => _uncacheable(
        'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); Date.now(); return undefined; } };\n',
        'Date'),
    randomDependentProofsNeverCache: () => _uncacheable(
        'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); Math.random(); return undefined; } };\n',
        'Math.random'),
    localSuccessAndInvalidation: () => withFixture(root => {
        const repo = join(root, 'source')
        initialize(repo, ['unit'])
        const before = sourceState(repo)
        const modulePath = join(repo, 'unit/module.f.js')
        const moduleBefore = readFileSync(modulePath)
        const cold = coverage(join(repo, 'unit'))
        assert(cold.includes('unit/module.f.js...Ok'), cold)
        nativeOutput(cold)
        assert(cold.indexOf('start of coverage report') < cold.indexOf('unit/module.f.js...Ok'), cold)
        assert(cold.includes('0 cached'), cold)
        assert.equal(entries(repo).length, 1)
        const first = git(repo, ['rev-parse', 'build-cache'])

        const warm = coverage(join(repo, 'unit'))
        assert(warm.includes('unit/module.f.js...Cached'), warm)
        assert(warm.includes('1 cached'), warm)
        cachedOutput(warm)
        assert(!warm.includes('command:'), warm)
        assert.equal(git(repo, ['rev-parse', 'build-cache']), first)

        // Package scopes affect how Node loads .f.js files even when their
        // source bytes are unchanged. New nested scopes count as inputs too.
        for (const scope of ['package.json', 'unit/package.json']) {
            write(repo, scope, '{"type":"commonjs"}\n')
            const incompatible = coverage(join(repo, 'unit'), false, 1)
            assert(incompatible.includes('unit/module.f.js...Failed'), incompatible)
            assert(incompatible.includes('command:'), incompatible)
            assert(!incompatible.includes('...Cached'), incompatible)
            assert.equal(git(repo, ['rev-parse', 'build-cache']), first)
            if (scope === 'package.json') write(repo, scope, '{"type":"module"}\n')
            else rmSync(join(repo, scope))
            const restored = coverage(join(repo, 'unit'))
            assert(restored.includes('unit/module.f.js...Cached'), restored)
            cachedOutput(restored)
            assert(!restored.includes('command:'), restored)
        }

        write(repo, 'unit/helper.f.js', 'export const helper = () => 2;\n')
        const changed = coverage(join(repo, 'unit'))
        assert(changed.includes('unit/module.f.js...Ok'), changed)
        nativeOutput(changed)
        assert(!changed.includes('...Cached'), changed)
        assert.equal(entries(repo).length, 2)
        const successful = git(repo, ['rev-parse', 'build-cache'])
        assert.notEqual(successful, first)

        write(repo, 'unit/proof.f.mjs', 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); throw "fixture failure"; } };\n')
        const failed = coverage(join(repo, 'unit'), false, 1)
        assert(failed.includes('unit/module.f.js...Failed'), failed)
        assert(failed.includes('fixture failure'), failed)
        assert(failed.includes('ℹ tests'), failed)
        assert(failed.includes('command:'), failed)
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
        assert(first.includes('a/module.f.js...Ok'), first)
        nativeOutput(first)
        const firstTip = git(origin, ['rev-parse', 'build-cache'])
        const shared = coverage(join(b, 'a'), true)
        assert(shared.includes('a/module.f.js...Cached'), shared)
        cachedOutput(shared)
        assert(!shared.includes('command:'), shared)
        assert.equal(git(origin, ['rev-parse', 'build-cache']), firstTip)

        const pending = coverage(join(a, 'b'))
        assert(pending.includes('b/module.f.js...Ok'), pending)
        nativeOutput(pending)
        const aEntries = entries(a)
        assert.equal(aEntries.length, 2)
        assert.equal(git(origin, ['rev-parse', 'build-cache']), firstTip)
        const advancing = coverage(join(b, 'c'), true)
        assert(advancing.includes('c/module.f.js...Ok'), advancing)
        nativeOutput(advancing)
        const bEntries = entries(b)
        assert.equal(bEntries.length, 2)
        const advancedTip = git(origin, ['rev-parse', 'build-cache'])
        assert.notEqual(advancedTip, firstTip)

        const replayed = coverage(join(a, 'b'), true)
        assert(replayed.includes('b/module.f.js...Cached'), replayed)
        cachedOutput(replayed)
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
        assert(imported.includes('c/module.f.js...Cached'), imported)
        cachedOutput(imported)
        assert(!imported.includes('command:'), imported)
        assert.deepEqual(sourceState(a), aBefore)
        assert.deepEqual(sourceState(b), bBefore)
        assert.equal(git(a, ['status', '--porcelain']), '')
        assert.equal(git(b, ['status', '--porcelain']), '')
    }),
    batchPublicationRetainsOnlySuccesses: () => withFixture(root => {
        const origin = join(root, 'origin.git')
        const repo = join(root, 'source')
        const trace = join(root, 'git-trace.jsonl')
        mkdirSync(origin)
        git(origin, ['init', '--bare', '--quiet', '--initial-branch=main'])
        initialize(repo, ['a', 'b', 'c'], true)
        git(repo, ['remote', 'add', 'origin', origin])
        write(repo, 'b/proof.f.mjs', 'import { value } from "./module.f.js"; export const proof = { covers: () => { value(); console.log("CACHE_CHILD_FINISHED b"); throw "batch fixture failure"; } };\n')
        const before = sourceState(repo)

        const output = coverage(repo, true, 1, { GIT_TRACE2_EVENT: trace })
        assert(output.includes('a/module.f.js...Ok'), output)
        assert(output.includes('b/module.f.js...Failed'), output)
        assert(output.includes('c/module.f.js...Ok'), output)
        assert(output.includes('batch fixture failure'), output)
        assert(output.includes('ℹ tests'), output)
        assert(output.includes('command:'), output)
        assert(output.includes('Coverage: 2 passed, 1 failed, 3 total (0 cached)'), output)
        assert(output.indexOf('a/module.f.js...Ok') < output.indexOf('b/module.f.js...Failed'), output)
        assert(output.indexOf('b/module.f.js...Failed') < output.indexOf('c/module.f.js...Ok'), output)

        // Native Git trace events distinguish one end-of-command publication
        // from a push after each successful module. All targets are processed
        // even when an earlier coverage child fails.
        const events = _commands(trace)
        const imports = events.filter(event => event.argv.includes('fast-import'))
        assert.equal(imports.length, 1, JSON.stringify(imports))
        const pushes = events.filter(event => event.argv.includes('push'))
        assert.equal(pushes.length, 1, JSON.stringify(pushes))
        assert.equal(_finished(output), 3, output)
        const inventories = events.filter(event => event.argv.includes('for-each-ref')
            && event.argv.includes('--format=%(refname)%00%(objectname)'))
        assert.equal(inventories.length, 2, JSON.stringify(inventories))
        assert(Date.parse(pushes[0].time) >= Date.parse(imports[0].time), JSON.stringify(pushes))
        const saved = entries(repo)
        assert.equal(saved.length, 2)
        assert.deepEqual(entries(origin), saved)
        const modules = saved.map(path => JSON.parse(git(repo, ['show', `build-cache:${path}`])).module).sort()
        assert.deepEqual(modules, ['a/module.f.js', 'c/module.f.js'])
        assert.deepEqual(sourceState(repo), before)
        assert.equal(git(repo, ['status', '--porcelain']), ' M b/proof.f.mjs')
    }),
    packedInventoryExceedsDefaultCaptureAndRemainsBatched: () => withFixture(root => {
        const repo = join(root, 'source')
        initialize(repo, ['unit'], true)
        const before = sourceState(repo)
        const seeded = 16_000
        _seedPacked(repo, seeded)
        const listing = execute(repo, 'git', ['ls-tree', '-r', '-z', '--full-tree', 'build-cache', '--', '.cas'])
        assert.equal(listing.status, 0, listing.output)
        assert(Buffer.byteLength(listing.stdout) > 1_024 * 1_024)
        assert.equal(listing.stdout.split('\u0000').filter(record => record !== '').length, seeded)

        const initial = git(repo, ['rev-parse', 'build-cache'])
        for (const phase of ['cold', 'warm', 'changed']) {
            if (phase === 'changed') write(repo, 'unit/helper.f.js', 'export const helper = () => 2;\n')
            const trace = join(root, `${phase}-trace.jsonl`)
            const output = coverage(join(repo, 'unit'), false, 0, { GIT_TRACE2_EVENT: trace })
            const events = _commands(trace)
            const inventories = events.filter(event => event.argv.includes('for-each-ref')
                && event.argv.includes('--format=%(refname)%00%(objectname)'))
            const listings = events.filter(event => event.argv.includes('ls-tree') && event.argv.includes('--full-tree'))
            const imports = events.filter(event => event.argv.includes('fast-import'))
            assert.equal(inventories.length, phase === 'warm' ? 1 : 2, JSON.stringify(inventories))
            assert.equal(listings.length, inventories.length, JSON.stringify(listings))
            assert.equal(imports.length, phase === 'warm' ? 0 : 1, JSON.stringify(imports))
            assert.equal(events.filter(event => event.argv.includes('cat-file')).length, phase === 'warm' ? 1 : 0, JSON.stringify(events))
            assert.equal(events.filter(event => event.argv.includes('push')).length, 0, JSON.stringify(events))
            for (const name of ['hash-object', 'update-index', 'write-tree', 'commit-tree']) {
                assert.equal(events.filter(event => event.argv.includes(name)).length, 0, JSON.stringify(events))
            }
            if (phase === 'warm') {
                assert(output.includes('unit/module.f.js...Cached'), output)
                cachedOutput(output)
                assert.equal(_finished(output), 0, output)
            } else {
                assert(output.includes('unit/module.f.js...Ok'), output)
                nativeOutput(output)
                assert.equal(_finished(output), 1, output)
                assert(Date.parse(imports[0].time) >= Date.parse(inventories[1].time), JSON.stringify(imports))
            }
            const expected = seeded + (phase === 'changed' ? 2 : 1)
            assert.equal(entries(repo).length, expected)
            const tip = git(repo, ['rev-parse', 'build-cache'])
            assert.notEqual(tip, initial)
            assert.equal(Number(git(repo, ['rev-list', '--count', 'build-cache'])), phase === 'changed' ? 3 : 2)
            assert.deepEqual(sourceState(repo), before)
        }
        assert.equal(git(repo, ['status', '--porcelain']), ' M unit/helper.f.js')
    }),
    earlierChildCannotReuseLaterTargetsOldSnapshot: () => withFixture(root => {
        const repo = join(root, 'source')
        initialize(repo, ['a', 'b'])
        const original = coverage(join(repo, 'b'))
        assert(original.includes('b/module.f.js...Ok'), original)
        const before = git(repo, ['rev-parse', 'build-cache'])
        // This host-dependent proof runs uncached. The graph for b has already
        // been captured when a changes b's input, before b's old cache hit.
        write(repo, 'a/proof.f.mjs', `
import { writeFileSync } from 'node:fs';
import { value } from './module.f.js';
export const proof = { changesLaterInput: () => {
    value();
    writeFileSync(new URL('../b/helper.f.js', import.meta.url), 'export const helper = () => 2;\\n');
} };
`)
        const changed = execute(repo, process.execPath, [cli, 'cov', 'node'])
        assert.equal(changed.status, 0, changed.output)
        assert(changed.output.includes('b/module.f.js...Ok'), changed.output)
        assert(!changed.output.includes('...Cached'), changed.output)
        assert(changed.output.includes('coverage inputs changed since the cache snapshot'), changed.output)
        assert.equal(git(repo, ['rev-parse', 'build-cache']), before)
        const fresh = coverage(join(repo, 'b'))
        assert(fresh.includes('b/module.f.js...Ok'), fresh)
        assert.equal(entries(repo).length, 2)
        assert(coverage(join(repo, 'b')).includes('b/module.f.js...Cached'))
    }),

}
