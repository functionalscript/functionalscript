/** Native entry discovery and explicit selection, under the active runtime. */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const runtime = process.versions.deno ? 'deno' : process.versions.bun ? 'bun' : 'node'
const flags = runtime === 'node' ? ['--test'] : runtime === 'deno' ? ['test', '-A', '--config', fileURLToPath(new URL('../../../deno.json', import.meta.url))] : ['test']

export const proof = /** @type {const} */ ({
    selectiveEntries: () => {
        const root = mkdtempSync(join(tmpdir(), 'fjs-native-'))
        try {
            writeFileSync(join(root, 'package.json'), '{"type":"module"}')
            writeFileSync(join(root, 'a.f.mjs'), 'export const proof = { fjsMjs: () => console.log("FJS_MJS_CASE") }')
            writeFileSync(join(root, 'b.f.js'), 'export const proof = { fjsJs: () => console.log("FJS_JS_CASE") }')
            writeFileSync(join(root, 'proof.mjs'), 'console.log("HOST_IMPORT"); export const proof = { host: () => console.log("HOST_CASE") }')
            writeFileSync(join(root, 'old.f.ts'), 'console.log("LEGACY_IMPORT"); export const proof = { legacy: () => console.log("LEGACY_CASE") }')
            writeFileSync(join(root, 'ordinary.mjs'), 'throw Error("ordinary module imported")')
            const combined = new URL('../all.test.mjs', import.meta.url)
            writeFileSync(join(root, 'all.test.mjs'), `import ${JSON.stringify(combined.href)}`)
            for (const [entry, fjs, host, legacy] of /** @type {const} */ ([
                ['fjs-only.mjs', true, false, false],
                ['js-only.mjs', false, true, false],
                ['all.test.mjs', true, true, true],
                [null, true, true, true],
            ])) {
                const path = entry === null ? [] : [fileURLToPath(new URL('../' + entry, import.meta.url))]
                // A nested Node runner must use its own reporting channel.
                const { NODE_TEST_CONTEXT: _context, ...env } = process.env
                const result = spawnSync(process.execPath, [...flags, ...path], {
                    cwd: root,
                    env: { ...env, INIT_CWD: root },
                    encoding: 'utf8',
                    timeout: 30_000,
                })
                assert.ifError(result.error)
                const output = result.stdout + result.stderr
                assert.equal(result.status, 0, output)
                for (const [marker, expected] of /** @type {const} */ ([
                    ['FJS_MJS_CASE', fjs], ['FJS_JS_CASE', fjs],
                    ['HOST_IMPORT', host], ['HOST_CASE', host],
                    ['LEGACY_IMPORT', legacy], ['LEGACY_CASE', legacy],
                ])) {
                    assert.equal(output.split(marker).length - 1, expected ? 1 : 0, `${runtime} ${entry}: ${marker}\n${output}`)
                }
            }
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    },
})
