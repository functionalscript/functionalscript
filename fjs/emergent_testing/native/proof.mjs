/**
 * Native entry discovery and isolated coverage through real child processes.
 * FunctionalScript proofs cannot observe process exit statuses, filesystem
 * discovery boundaries or native coverage reports.
 */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const runtime = process.versions.deno ? 'deno' : process.versions.bun ? 'bun' : 'node'
const flags = runtime === 'node' ? ['--test'] : runtime === 'deno' ? ['test', '-A', '--config', fileURLToPath(new URL('../../../deno.json', import.meta.url))] : ['test']
const one = fileURLToPath(new URL('../one.mjs', import.meta.url))
const cli = fileURLToPath(new URL('../../module.mjs', import.meta.url))
const coverageReporter = fileURLToPath(new URL('../cov/reporter.mjs', import.meta.url))

/** @type {(run: (root: string) => void) => void} */
const withFixture = run => {
    const root = mkdtempSync(join(tmpdir(), 'fjs-native-'))
    try {
        writeFileSync(join(root, 'package.json'), '{"type":"module"}')
        run(root)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

/** @type {(root: string, files: Readonly<Record<string, string>>) => void} */
const writeFixture = (root, files) => {
    for (const [path, text] of Object.entries(files)) {
        const target = join(root, path)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, text)
    }
}

/** @type {(cwd: string, args: readonly string[], initCwd?: string) => { readonly status: number | null, readonly output: string }} */
const invoke = (cwd, args, initCwd = cwd) => {
    // A nested native runner must establish its own reporting channel.
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env
    const result = spawnSync(process.execPath, args, {
        cwd,
        env: { ...env, INIT_CWD: initCwd },
        encoding: 'utf8',
        timeout: 30_000,
    })
    assert.ifError(result.error)
    assert.equal(result.signal, null, result.stdout + result.stderr)
    return { status: result.status, output: result.stdout + result.stderr }
}

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
    oneDirectory: () => withFixture(root => {
        writeFixture(root, {
            'module.f.mjs': 'export const proof = { inline: () => console.log("INLINE_PROOF") }',
            'proof.f.mjs': 'export const proof = { sibling: () => console.log("SIBLING_PROOF") }',
            'split.proof.f.mjs': 'export const proof = { split: () => console.log("SPLIT_PROOF") }',
            'extra.f.js': 'export const proof = { fjs: () => console.log("FJS_JS_PROOF") }',
            'child/proof.f.mjs': 'throw Error("DESCENDANT_IMPORTED")',
            'proof.mjs': 'throw Error("HOST_IMPORTED")',
            'ordinary.mjs': 'throw Error("ORDINARY_IMPORTED")',
        })
        const result = invoke(root, [...flags, one], join(root, 'child'))
        assert.equal(result.status, 0, result.output)
        for (const marker of ['INLINE_PROOF', 'SIBLING_PROOF', 'SPLIT_PROOF', 'FJS_JS_PROOF']) {
            assert.equal(result.output.split(marker).length - 1, 1, result.output)
        }
        for (const marker of ['DESCENDANT_IMPORTED', 'HOST_IMPORTED', 'ORDINARY_IMPORTED']) {
            assert.equal(result.output.includes(marker), false, result.output)
        }
    }),
    oneDirectoryFailures: () => {
        for (const files of [
            { 'module.f.mjs': 'export const value = 1' },
            { 'proof.f.mjs': 'export const proof = {}' },
            { 'proof.f.mjs': 'export const proof = { unary: x => x }' },
            { 'module.f.mjs': 'throw Error("IMPORT_FAILURE")' },
        ]) {
            withFixture(root => {
                writeFixture(root, files)
                const result = invoke(root, [...flags, one])
                assert.notEqual(result.status, 0, result.output)
            })
        }
    },
    coverageScope: () => {
        if (runtime !== 'node') return
        withFixture(root => {
            writeFixture(root, {
                'module.f.mjs': 'export const proof = { outside: () => { throw Error("OUTSIDE_SCOPE") } }',
                'selected subtree/a module/module.f.js': 'export const identity = x => x',
                'selected subtree/a module/demo.f.mjs': 'export const demo = () => 1',
                'selected subtree/a module/proof.f.mjs': 'import { identity } from "./module.f.js"; import { demo } from "./demo.f.mjs"; export const proof = { own: () => [identity(1), demo(), console.log("FIRST_MODULE_PROOF")] }',
                'selected subtree/a module/helper.f.mjs': 'export const unmeasured = () => 2',
                'selected subtree/b/module.f.mjs': 'export const value = () => 3',
                'selected subtree/b/proof.f.mjs': 'import { value } from "./module.f.mjs"; export const proof = { own: () => value() }',
            })
            const selected = join(root, 'selected subtree')
            const result = invoke(root, [cli, 'cov', 'node'], selected)
            assert.equal(result.status, 0, result.output)
            assert.equal(result.output.includes('OUTSIDE_SCOPE'), false, result.output)
            assert.ok(result.output.includes('--test-coverage-lines=100'), result.output)
            assert.ok(result.output.includes('--test-coverage-branches=100'), result.output)
            assert.ok(result.output.includes('--test-coverage-functions=100'), result.output)
            assert.ok(result.output.includes('one.mjs'), result.output)
            assert.ok(result.output.includes(`cwd: '${join(selected, 'a module').replaceAll('\\', '/')}'`), result.output)
            assert.equal(result.output.split('command:').length - 1, 2, result.output)
            assert.ok(result.output.indexOf('command:') < result.output.indexOf('FIRST_MODULE_PROOF'), result.output)
        })
    },
    coverageIsolation: () => {
        if (runtime !== 'node') return
        withFixture(root => {
            writeFixture(root, {
                'a/module.f.mjs': 'export const choose = flag => flag ? 1 : 2',
                'a/proof.f.mjs': 'import { choose } from "./module.f.mjs"; export const proof = { own: () => choose(true) }',
                'b/module.f.mjs': 'export const value = () => 3',
                'b/proof.f.mjs': 'import { choose } from "../a/module.f.mjs"; import { value } from "./module.f.mjs"; export const proof = { other: () => [choose(false), value(), console.log("LATER_MODULE_PROOF")] }',
            })
            const combined = invoke(root, [
                '--test',
                '--experimental-test-coverage',
                `--test-coverage-include=${join(root, 'a/module.f.mjs').replaceAll('\\', '/')}`,
                `--test-coverage-include=${join(root, 'b/module.f.mjs').replaceAll('\\', '/')}`,
                '--test-coverage-lines=100',
                '--test-coverage-branches=100',
                '--test-coverage-functions=100',
                fileURLToPath(new URL('../fjs-only.mjs', import.meta.url)),
            ])
            assert.equal(combined.status, 0, combined.output)
            const result = invoke(root, [cli, 'cov', 'node'])
            assert.notEqual(result.status, 0, result.output)
            assert.ok(result.output.includes('LATER_MODULE_PROOF'), result.output)
        })
    },
    coverageFailures: () => {
        if (runtime !== 'node') return
        withFixture(root => {
            for (const args of [[], ['deno'], ['node', '--quiet'], ['node', '--verbose'], ['node']]) {
                const result = invoke(root, [cli, 'cov', ...args])
                assert.notEqual(result.status, 0, result.output)
            }
            writeFixture(root, { 'module.f.mjs': 'export const value = 1' })
            const result = invoke(root, [cli, 'cov', 'node'])
            assert.notEqual(result.status, 0, result.output)
        })
    },
    coverageTestFailure: () => {
        if (runtime !== 'node') return
        withFixture(root => {
            writeFixture(root, {
                'module.f.mjs': 'export const value = () => 1',
                'proof.f.mjs': 'import { value } from "./module.f.mjs"; export const proof = { fails: () => { value(); throw Error("TEST_FAILURE") } }',
            })
            const result = invoke(root, [cli, 'cov', 'node'])
            assert.notEqual(result.status, 0, result.output)
            assert.ok(result.output.includes('TEST_FAILURE'), result.output)
        })
    },
    coverageReportAdmission: () => {
        if (runtime !== 'node') return
        withFixture(root => {
            writeFixture(root, {
                'module.f.mjs': 'export const value = () => 1',
                'demo.f.mjs': 'export const demo = () => 2',
                'proof.f.mjs': 'import { value } from "./module.f.mjs"; import { demo } from "./demo.f.mjs"; export const proof = { own: () => [value(), demo()] }',
            })
            const missingFile = invoke(root, [
                '--test',
                '--experimental-test-coverage',
                '--test-coverage-include=module.f.mjs',
                '--test-coverage-lines=100',
                '--test-coverage-branches=100',
                '--test-coverage-functions=100',
                `--test-reporter=${coverageReporter}`,
                one,
            ])
            assert.notEqual(missingFile.status, 0, missingFile.output)
            assert.ok(missingFile.output.includes('Missing coverage:'), missingFile.output)
            assert.ok(missingFile.output.includes('demo.f.mjs'), missingFile.output)
            const missingReport = invoke(root, ['--test', `--test-reporter=${coverageReporter}`, one])
            assert.notEqual(missingReport.status, 0, missingReport.output)
            assert.ok(missingReport.output.includes('coverage report'), missingReport.output)
        })
    },
})
