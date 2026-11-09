/** Coverage runtime inputs against Node's real loader and filesystem. */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const runtimePath = fileURLToPath(new URL('./runtime.mjs', import.meta.url))

/** @type {(script: string) => unknown} */
const invoke = script => {
    // A nested Node process must use its own reporting channel.
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env, timeout: 30_000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.signal, null, result.stderr)
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

export const proof = process.versions.bun || process.versions.deno ? {} : {
    runtimeFactsAndFramework: () => {
        const record = invoke(runtimePath)
        assert(record !== null && typeof record === 'object')
        assert('node' in record && 'versions' in record && 'platform' in record && 'arch' in record && 'env' in record && 'files' in record)
        assert.equal(record.node, process.versions.node)
        assert.deepEqual(record.versions, { ...process.versions })
        assert.equal(record.platform, process.platform)
        assert.equal(record.arch, process.arch)
        assert.deepEqual(record.env, Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
            .map(name => [name, process.env[name] ?? null])))
        const files = record.files
        assert(files !== null && typeof files === 'object')
        for (const root of [
            'package.json', 'fjs/module.mjs', 'fjs/module.f.mjs',
            'fjs/effects/node/module.mjs', 'fjs/effects/module.mjs',
            'fjs/emergent_testing/one.mjs', 'fjs/emergent_testing/module.f.mjs',
            'fjs/emergent_testing/cov/reporter.mjs', 'fjs/emergent_testing/cov/module.f.mjs',
            'fjs/emergent_testing/cov/runtime.mjs', 'fjs/cli/module.f.mjs',
            'fjs/emergent_testing/cov/native/module.mjs',
        ]) {
            assert(root in files, `Missing framework input: ${root}`)
        }
        for (const hash of Object.values(files)) {
            assert.equal(typeof hash, 'string')
            assert.equal(hash.length, 64)
        }
        assert.deepEqual(invoke(runtimePath), record)
    },
    changedTransitiveFile: () => {
        const root = mkdtempSync(join(tmpdir(), 'fjs-cov-runtime-'))
        try {
            const script = join(root, 'fjs/emergent_testing/cov/runtime.mjs')
            write(root, 'package.json', '{"type":"module"}')
            mkdirSync(dirname(script), { recursive: true })
            copyFileSync(runtimePath, script)
            write(root, 'fjs/effects/node/module.mjs', 'export const adapter = true\n')
            write(root, 'fjs/emergent_testing/cov/reporter.mjs', "import '../../dependency.mjs'\n")
            write(root, 'fjs/emergent_testing/cov/native/module.mjs', 'throw new Error("Coverage wrapper imported")\n')
            write(root, 'fjs/emergent_testing/module.f.mjs', 'export const registerOne = () => undefined\n')
            write(root, 'fjs/cli/module.f.mjs', 'export const dispatch = () => undefined\n')
            // These entries must only be hashed: importing any would execute it.
            for (const entry of ['fjs/emergent_testing/one.mjs', 'fjs/module.mjs', 'fjs/module.f.mjs']) {
                write(root, entry, 'throw new Error("Executable entry imported")\n')
            }
            write(root, 'fjs/dependency.mjs', 'export const value = 1\n')
            const first = invoke(script)
            assert(first !== null && typeof first === 'object' && 'files' in first)
            const firstFiles = first.files
            assert(firstFiles !== null && typeof firstFiles === 'object' && 'fjs/dependency.mjs' in firstFiles)
            const before = firstFiles['fjs/dependency.mjs']
            write(root, 'fjs/dependency.mjs', 'export const value = 2\n')
            const second = invoke(script)
            assert(second !== null && typeof second === 'object' && 'files' in second)
            const secondFiles = second.files
            assert(secondFiles !== null && typeof secondFiles === 'object' && 'fjs/dependency.mjs' in secondFiles)
            assert.notEqual(secondFiles['fjs/dependency.mjs'], before)
            assert.deepEqual(Object.keys(firstFiles), Object.keys(secondFiles))
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    },
}
