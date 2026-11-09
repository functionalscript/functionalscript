/** Native coverage logs stay quiet on success and complete on failure. */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const wrapper = fileURLToPath(new URL('./module.mjs', import.meta.url))

/** @type {(run: (root: string, logs: string) => void) => void} */
const withFixture = run => {
    const root = mkdtempSync(join(tmpdir(), 'fjs-native-output-'))
    const logs = join(root, 'logs')
    mkdirSync(logs)
    try {
        run(root, logs)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

/** @type {(root: string, logs: string, source: string) => { readonly status: number | null, readonly stdout: string, readonly stderr: string }} */
const invoke = (root, logs, source) => {
    const file = join(root, 'entry.mjs')
    writeFileSync(file, source)
    const { NODE_TEST_CONTEXT: _context, NODE_OPTIONS: _options, INIT_CWD: _cwd, ...env } = process.env
    const result = spawnSync(process.execPath, [wrapper, file], {
        cwd: root,
        env: { ...env, TMPDIR: logs, TMP: logs, TEMP: logs },
        encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1_024 * 1_024,
    })
    assert.ifError(result.error)
    assert.equal(result.signal, null, result.stdout + result.stderr)
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

export const proof = process.versions.bun || process.versions.deno ? {} : {
    successfulOutputIsDiscarded: () => withFixture((root, logs) => {
        const result = invoke(root, logs, 'process.stdout.write("passing output\\n"); process.stderr.write("passing warning\\n");\n')
        assert.equal(result.status, 0)
        assert.equal(result.stdout, 'Ok\n')
        assert.equal(result.stderr, '')
        assert.deepEqual(readdirSync(logs), [])
    }),
    failedOutputHasNoCaptureLimit: () => withFixture((root, logs) => {
        const block = 'x'.repeat(2 * 1_024 * 1_024)
        const result = invoke(root, logs, `process.stdout.write("stdout marker\\n"); process.stderr.write("stderr marker\\n"); process.stdout.write(${JSON.stringify(block)}); process.stderr.write("\\nlast marker\\n"); process.exitCode = 7;\n`)
        assert.equal(result.status, 7)
        assert.equal(result.stdout, 'Failed\n')
        assert.equal(result.stderr, `stdout marker\nstderr marker\n${block}\nlast marker\nCoverage subprocess exited with code 7\n`)
        assert.deepEqual(readdirSync(logs), [])
    }),
    signalIsReported: () => withFixture((root, logs) => {
        const result = invoke(root, logs, 'process.stdout.write("before signal\\n"); process.kill(process.pid, "SIGTERM");\n')
        assert.notEqual(result.status, 0)
        assert.equal(result.stdout, 'Failed\n')
        assert(result.stderr.includes('before signal\n'), result.stderr)
        assert(result.stderr.includes('Coverage subprocess'), result.stderr)
        if (process.platform !== 'win32') assert(result.stderr.includes('SIGTERM'), result.stderr)
        assert.deepEqual(readdirSync(logs), [])
    }),
    captureSetupFailureIsNotSuccess: () => withFixture((root, logs) => {
        const result = invoke(root, join(logs, 'missing'), 'process.stdout.write("unreachable");\n')
        assert.notEqual(result.status, 0)
        assert.equal(result.stdout, 'Failed\n')
        assert(result.stderr.includes('Coverage output capture failed:'), result.stderr)
        assert.deepEqual(readdirSync(logs), [])
    }),
    ...(process.platform === 'win32' ? {} : {
        failedLogReadIsNotSuccess: () => withFixture((root, logs) => {
            // POSIX permits a process to remove a directory holding its open
            // log. The resulting read error must remain visible and nonzero.
            const result = invoke(root, logs, 'import { readdirSync, rmSync } from "node:fs"; import { join } from "node:path"; for (const entry of readdirSync(process.env.TMPDIR)) rmSync(join(process.env.TMPDIR, entry), { recursive: true, force: true }); process.exitCode = 3;\n')
            assert.notEqual(result.status, 0)
            assert.equal(result.stdout, 'Failed\n')
            assert(result.stderr.includes('Coverage output capture failed:'), result.stderr)
            assert(result.stderr.includes('ENOENT'), result.stderr)
            assert.deepEqual(readdirSync(logs), [])
        }),
    }),
}
