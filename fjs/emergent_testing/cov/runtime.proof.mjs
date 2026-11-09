/** Coverage runtime inputs against Node's real loader and filesystem. */

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
        write(root, 'package.json', '{"type":"module"}')
        mkdirSync(dirname(script), { recursive: true })
        copyFileSync(runtimePath, script)
        write(root, 'fjs/effects/node/module.mjs', 'export const adapter = true\n')
        write(root, 'fjs/emergent_testing/cov/reporter.mjs', "import '../../dependency.mjs'\n")
        write(root, 'fjs/emergent_testing/module.f.mjs', 'export const registerOne = () => undefined\n')
        write(root, 'fjs/cli/module.f.mjs', 'export const dispatch = () => undefined\n')
        // These entries must only be inventoried: importing any executes it.
        for (const entry of ['fjs/emergent_testing/one.mjs', 'fjs/module.mjs', 'fjs/module.f.mjs']) {
            write(root, entry, 'throw new Error("Executable entry imported")\n')
        }
        write(root, 'fjs/dependency.mjs', 'export const value = 1\n')
        run(root, script)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
}

/** @type {(source: string | NodeJS.TypedArray) => string} */
const hash = source => createHash('sha256').update(source).digest('hex')

/** @type {(record: unknown, path: string) => unknown} */
const fingerprint = (record, path) => {
    assert(record !== null && typeof record === 'object' && 'fingerprints' in record)
    assert(record.fingerprints !== null && typeof record.fingerprints === 'object')
    return Object.entries(record.fingerprints).find(([name]) => name === path)?.[1]
}

export const proof = process.versions.bun || process.versions.deno ? {} : {
    runtimeFactsAndFramework: () => {
        const record = invoke(runtimePath)
        assert(record !== null && typeof record === 'object')
        assert('node' in record && 'versions' in record && 'platform' in record && 'arch' in record && 'env' in record && 'files' in record
            && 'fingerprints' in record && 'resolutions' in record && 'absentScopes' in record)
        assert.equal(record.node, process.versions.node)
        assert.deepEqual(record.versions, { ...process.versions })
        assert.equal(record.platform, process.platform)
        assert.equal(record.arch, process.arch)
        assert.deepEqual(record.env, Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
            .map(name => [name, process.env[name] ?? null])))
        const files = record.files
        assert(Array.isArray(files))
        for (const root of [
            'package.json', 'fjs/module.mjs', 'fjs/module.f.mjs',
            'fjs/effects/node/module.mjs', 'fjs/effects/module.mjs',
            'fjs/emergent_testing/one.mjs', 'fjs/emergent_testing/module.f.mjs',
            'fjs/emergent_testing/cov/reporter.mjs', 'fjs/emergent_testing/cov/module.f.mjs',
            'fjs/emergent_testing/cov/runtime.mjs', 'fjs/cli/module.f.mjs',
        ]) {
            assert(files.includes(root), `Missing framework input: ${root}`)
        }
        assert(files.every(path => typeof path === 'string'))
        assert.deepEqual(files, [...new Set(files)].sort())
        const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
        assert.deepEqual(record.fingerprints, Object.fromEntries(files.map(path => [path, hash(readFileSync(join(packageRoot, path)))])))
        assert(Array.isArray(record.resolutions))
        for (const resolution of record.resolutions) {
            assert(isAbsolute(resolution.name) && isAbsolute(resolution.path))
            assert.equal(realpathSync(resolution.name), resolution.path)
            assert.equal(pathToFileURL(resolution.path).href, resolution.id)
        }
        assert.equal(new Set(record.resolutions.map(resolution => JSON.stringify(resolution))).size, record.resolutions.length)
        assert(Array.isArray(record.absentScopes))
        assert(record.absentScopes.every(path => typeof path === 'string' && isAbsolute(path) && !existsSync(path)))
        assert.deepEqual(record.absentScopes, [...new Set(record.absentScopes)].sort())
        assert.deepEqual(invoke(runtimePath), record)
    },
    transitiveInventoryAndExecutableEntries: () => withFixture((root, script) => {
        const first = invoke(script)
        assert(first !== null && typeof first === 'object' && 'files' in first)
        const firstFiles = first.files
        assert(Array.isArray(firstFiles) && firstFiles.includes('fjs/dependency.mjs'))
        write(root, 'fjs/dependency.mjs', "import './added.mjs'; export const value = 2\n")
        write(root, 'fjs/added.mjs', 'export const added = true\n')
        const second = invoke(script)
        assert(second !== null && typeof second === 'object' && 'files' in second)
        const secondFiles = second.files
        assert(Array.isArray(secondFiles))
        assert(secondFiles.includes('fjs/added.mjs'))
        assert.deepEqual(secondFiles.filter(path => path !== 'fjs/added.mjs'), firstFiles)
        assert.equal(fingerprint(first, 'fjs/dependency.mjs'), hash('export const value = 1\n'))
        assert.equal(fingerprint(second, 'fjs/dependency.mjs'), hash("import './added.mjs'; export const value = 2\n"))
    }),
    fingerprintsLoadedSourceBeforeLaterDiskChanges: () => withFixture((root, script) => {
        const replacement = 'export const value = 2\n'
        const source = `import { writeFileSync } from 'node:fs'; writeFileSync(new URL(import.meta.url), ${JSON.stringify(replacement)}); export const value = 1\n`
        write(root, 'fjs/dependency.mjs', source)
        const record = invoke(script)
        assert.equal(readFileSync(join(root, 'fjs/dependency.mjs'), 'utf8'), replacement)
        assert.equal(fingerprint(record, 'fjs/dependency.mjs'), hash(source))
        assert.notEqual(fingerprint(record, 'fjs/dependency.mjs'), hash(replacement))
    }),
    canonicalTargetsRetainRequestedAliasesAndPackageScopes: () => withFixture((root, script) => {
        write(root, 'fjs/nested/target.mjs', "import './transitive.mjs'; export const value = 1\n")
        write(root, 'fjs/nested/transitive.mjs', 'export const nested = true\n')
        const requested = join(realpathSync(root), 'aliases/target.mjs')
        const target = realpathSync(join(root, 'fjs/nested/target.mjs'))
        // Directory junctions also exercise aliases without Windows file-link privileges.
        const kind = process.platform === 'win32' ? 'junction' : 'dir'
        symlinkSync(join(root, 'fjs/nested'), join(root, 'aliases'), kind)
        write(root, 'fjs/emergent_testing/cov/reporter.mjs', "import '../../../aliases/target.mjs'\n")
        const entry = join(root, 'probe-alias/runtime.mjs')
        symlinkSync(dirname(script), dirname(entry), kind)
        const first = invoke(entry)
        assert(first !== null && typeof first === 'object' && 'files' in first && 'resolutions' in first && 'absentScopes' in first)
        assert(Array.isArray(first.files) && Array.isArray(first.resolutions) && Array.isArray(first.absentScopes))
        assert(first.files.includes('fjs/nested/target.mjs') && first.files.includes('fjs/nested/transitive.mjs'))
        assert.equal(first.files.includes('aliases/target.mjs'), false)
        assert(first.resolutions.some(resolution => resolution.name === requested && resolution.path === target && resolution.id === pathToFileURL(target).href))
        const canonicalScript = realpathSync(script)
        assert(first.resolutions.some(resolution => resolution.name === entry && resolution.path === canonicalScript && resolution.id === pathToFileURL(canonicalScript).href))
        const scope = join(realpathSync(root), 'fjs/nested/package.json')
        assert(first.absentScopes.includes(scope))
        const scopeSource = '{"type":"module"}'
        write(root, 'fjs/nested/package.json', scopeSource)
        const second = invoke(script)
        assert(second !== null && typeof second === 'object' && 'files' in second && 'absentScopes' in second)
        assert(Array.isArray(second.files) && second.files.includes('fjs/nested/package.json'))
        assert(Array.isArray(second.absentScopes) && !second.absentScopes.includes(scope))
        assert.equal(fingerprint(second, 'fjs/nested/package.json'), hash(scopeSource))
    }),
    unsupportedFileIdentitiesRefuse: () => withFixture((root, script) => {
        for (const suffix of ['?separate', '#separate']) {
            write(root, 'fjs/emergent_testing/cov/reporter.mjs', `import '../../dependency.mjs${suffix}'\n`)
            const result = launch(script)
            assert.notEqual(result.status, 0, result.stderr)
            assert(result.stderr.includes('unsupported coverage runtime URL'), result.stderr)
            assert.equal(result.stdout, '')
        }
        write(root, 'node_modules/bare/package.json', '{"type":"module","exports":"./module.mjs"}')
        write(root, 'node_modules/bare/module.mjs', 'export const value = 1\n')
        write(root, 'fjs/emergent_testing/cov/reporter.mjs', "import 'bare'\n")
        const result = launch(script)
        assert.notEqual(result.status, 0, result.stderr)
        assert(result.stderr.includes('unsupported coverage runtime import'), result.stderr)
        assert.equal(result.stdout, '')
    }),
}
