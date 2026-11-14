/** Coverage tool identity against Node's real process and filesystem. */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const runtimePath = fileURLToPath(new URL('./runtime.mjs', import.meta.url))

/** @type {(script: string) => import('node:child_process').SpawnSyncReturns<string>} */
const launch = script => {
    // A nested Node process must use its own reporting channel.
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env, timeout: 30_000 })
    assert.ifError(result.error)
    assert.equal(result.signal, null, result.stderr)
    return result
}

/** @type {(script: string) => unknown} */
const invoke = script => {
    const result = launch(script)
    assert.equal(result.status, 0, result.stderr)
    const lines = result.stdout.trimEnd().split('\n')
    assert.equal(lines.length, 1, result.stdout)
    return JSON.parse(lines[0])
}

/** @type {(root: string, path: string, content: string) => void} */
const write = (root, path, content) => {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
}

/** @type {(run: (root: string, script: string) => void) => void} */
const withFixture = run => {
    const root = mkdtempSync(join(tmpdir(), 'fjs-cov-runtime-'))
    try {
        const script = join(root, 'fjs/emergent_testing/cov/runtime.mjs')
        write(root, 'package.json', '{"type":"module","version":"1.0.0"}')
        mkdirSync(dirname(script), { recursive: true })
        copyFileSync(runtimePath, script)
        run(root, script)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

export const proof = process.versions.bun || process.versions.deno ? {} : {
    runtimeFactsAndVersion: () => {
        const version = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version
        const record = invoke(runtimePath)
        assert.deepEqual(record, {
            functionalscript: version,
            node: process.versions.node,
            versions: { ...process.versions },
            platform: process.platform,
            arch: process.arch,
            env: Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
                .map(name => [name, process.env[name] ?? null])),
        })
        assert.deepEqual(invoke(runtimePath), record)
    },
    toolingChangesKeepVersionIdentity: () => withFixture((root, script) => {
        const first = invoke(script)
        // The runtime needs neither a tooling inventory nor loaded definitions.
        for (const path of [
            'fjs/effects/node/module.mjs', 'fjs/emergent_testing/cov/reporter.mjs',
            'fjs/emergent_testing/module.f.mjs', 'fjs/cli/module.f.js',
            'fjs/emergent_testing/one.mjs', 'fjs/module.mjs', 'fjs/module.f.mjs',
        ]) {
            write(root, path, 'throw new Error("Tooling source must not execute")\n')
        }
        assert.deepEqual(invoke(script), first)
        write(root, 'fjs/cli/module.f.js', "import './new-dependency.mjs'\n")
        write(root, 'fjs/cli/new-dependency.mjs', 'throw new Error("Added tool dependency must not execute")\n')
        assert.deepEqual(invoke(script), first)
        write(root, 'package.json', '{"type":"module","version":"2.0.0"}')
        assert(first !== null && typeof first === 'object')
        assert.deepEqual(invoke(script), { ...first, functionalscript: '2.0.0' })
    }),
    invalidOrMissingVersionRefuses: () => withFixture((root, script) => {
        for (const source of ['{}', '{"version":null}', '{"version":1}', '{"version":""}']) {
            write(root, 'package.json', source)
            const result = launch(script)
            assert.notEqual(result.status, 0, result.stderr)
            assert(result.stderr.includes('FunctionalScript package.json must contain a nonempty version'), result.stderr)
            assert.equal(result.stdout, '')
        }
        rmSync(join(root, 'package.json'))
        const result = launch(script)
        assert.notEqual(result.status, 0, result.stderr)
        assert.equal(result.stdout, '')
    }),
}
