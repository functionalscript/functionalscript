/**
 * Temporary-filesystem proofs of the Node file-module profile on every runtime.
 * Native ESM comparisons run on Node, whose loader defines this profile.
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runEffect } from '../../effects/node/module.mjs'
import { resolveFileModule } from '../../effects/node/module.f.mjs'
import { resultMapStep } from '../../effects/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.mjs'
import { transpile } from './module.f.mjs'
import { resolve } from '../edag/module.f.mjs'
import { tryStringify as graphText } from '../serializer/module.f.mjs'

/**
 * @template T, E
 * @param {Effect<NodeOp, T, E>} effect
 * @param {(result: Result<T, E>) => void} check
 * @returns {Promise<void>}
 */
const hostCheck = async (effect, check) => {
    assertEq(await runEffect(() => resultMapStep(effect, result => {
        check(result)
        return ok(0)
    })), 0)
}

const fixtures = {
    'dep #%.mjs': 'export default [42];',
    'other.mjs': 'export default [42];',
    'left.mjs': 'import value from "./dep%20%23%25.mjs"; export default value;',
    'right.mjs': 'import value from "./absent/%2e%2e/dep%20%23%25.mjs"; export default value;',
    'cycle.mjs': 'import value from "./%63ycle.mjs"; export default value;',
    'entry #%.mjs': 'import a from "./left.mjs"; import b from "./right.mjs"; import c from "./%64ep%20%23%25.mjs"; import d from "./other.mjs"; export default [a, b, c, d];',
    'suffix-dep.mjs': 'import common from "./dep%20%23%25.mjs"; export default [common];',
    'suffix-entry.mjs': `
import v0 from "./suffix-dep.mjs";
import v1 from "./suffix-dep.mjs?v=1";
import v2 from "./%73uffix-dep.mjs?v=1";
import v3 from "./suffix-dep.mjs?v=2";
import v4 from "./suffix-dep.mjs#a";
import v5 from "./suffix-dep.mjs#b";
import v6 from "./suffix-dep.mjs?";
import v7 from "./suffix-dep.mjs#";
import v8 from "./suffix-dep.mjs?#";
import v9 from "./suffix-dep.mjs?v=1#";
import v10 from "./suffix-dep.mjs?v=1#a";
import v11 from "./suffix-dep.mjs?v=1#a";
import v12 from "./suffix-dep.mjs?bad%/a:b#%2F";
export default [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12];`,
}

/**
 * Each proof owns a unique temporary tree, including native module-cache keys.
 * Keep deliberately unusual filenames out of the repository/site, and clean up
 * even when writing a fixture, importing it or an assertion fails.
 *
 * @type {(check: (directory: URL) => Promise<void>) => Promise<void>}
 */
const withFixtures = async check => {
    const temporary = await mkdtemp(join(tmpdir(), 'fjs-module-url-'))
    try {
        const path = join(temporary, 'url%23identity')
        await mkdir(path)
        for (const [name, source] of Object.entries(fixtures)) {
            await writeFile(join(path, name), source)
        }
        // The temporary root may itself be reached through a symlink. Expected
        // identities use its canonical location, independently of this loader.
        const directory = pathToFileURL(`${await realpath(path)}${sep}`)
        await check(directory)
    } finally {
        await rm(temporary, { recursive: true, force: true })
    }
}

const suffixGroups = /** @type {const} */ ([0, 1, 1, 2, 3, 4, 0, 0, 0, 1, 5, 5, 6])
const expectedValue = [[42], [42], [42], [42]]
const expectedSharing = [true, true, true]

/** Observe sharing, not just equal contents. @type {(value: unknown) => readonly boolean[]} */
const sharing = value => {
    assert(value instanceof Array)
    const [a, b, c, d] = value
    return [a === b, b === c, c !== d]
}

/** @type {(value: unknown) => readonly (readonly boolean[])[]} */
const identities = value => {
    assert(value instanceof Array)
    return value.map(a => value.map(b => a === b))
}

/** @type {(value: unknown) => unknown} */
const dependencyOf = value => {
    assert(value instanceof Array)
    return value[0]
}

/** Compare actual JS allocations after EDAG serialization as well as values. @type {(path: string, native: unknown) => Promise<void>} */
const compareCompilers = async (path, native) => {
    await hostCheck(transpile(path), result => {
        const { value } = unwrap(result)
        assertStructurallySame(value, native)
        assertStructurallySame(identities(value), identities(native))
        assert(value instanceof Array && native instanceof Array)
        assertStructurallySame(identities(value.map(dependencyOf)), identities(native.map(dependencyOf)))
    })
    await hostCheck(resolve(path), result => {
        const text = unwrap(graphText(unwrap(result)))
        const value = new Function(text.replace('export default ', 'return '))()
        assertStructurallySame(value, native)
        assertStructurallySame(identities(value), identities(native))
        // Distinct wrappers must not duplicate their shared ordinary dependency.
        assert(value instanceof Array && native instanceof Array)
        assertStructurallySame(identities(value.map(dependencyOf)), identities(native.map(dependencyOf)))
    })
}

const nodeSuffixProof = {
    suffixIdentities: () => withFixtures(async directory => {
        const entry = new URL('entry%20%23%25.mjs', directory)
        for (const suffix of ['', '?v=1', '#copy', '?v=1#copy', '?', '#', '?#', '?v=1#', '?q=é x', '?bad%/a:b#%2F']) {
            const specifier = `./suffix-dep.mjs${suffix}`
            const expected = import.meta.resolve(new URL(specifier, directory).href)
            await hostCheck(resolveFileModule(specifier, entry.href + '?parent#old'), result => {
                const { id, path } = unwrap(result)
                assertEq(id, expected)
                assertEq(path, fileURLToPath(new URL('suffix-dep.mjs', directory)))
            })
        }
    }),
    suffixSharing: () => withFixtures(async directory => {
        const url = new URL('suffix-entry.mjs', directory)
        for (let attempt = 0; attempt < 2; attempt++) {
            const native = (await import(url.href)).default
            assertStructurallySame(identities(native), suffixGroups.map(a => suffixGroups.map(b => a === b)))
            await compareCompilers(fileURLToPath(url), native)
        }
    }),
    symlinkAndJsonSuffixes: async () => {
        const temporary = await mkdtemp(join(tmpdir(), 'fjs-module-suffix-'))
        try {
            // Windows can spell tmpdir() with an 8.3 name. Create the junction
            // against the canonical root so both loaders use the same spelling.
            const root = await realpath(temporary)
            const real = join(root, 'real')
            const alias = join(root, 'alias')
            await mkdir(real)
            // Directory junctions need no Windows symlink privilege.
            await symlink(real, alias, 'junction')
            await writeFile(join(real, 'common.mjs'), 'export default [42];')
            await writeFile(join(real, 'dep.mjs'), 'import c from "./common.mjs"; export default [c];')
            const path = join(root, 'main.mjs')
            await writeFile(path, 'import a from "./real/dep.mjs?v=1"; import b from "./alias/dep.mjs?v=1"; import c from "./alias/dep.mjs?v=2"; export default [a,b,c];')
            const native = (await import(pathToFileURL(path).href)).default
            assert(native[0] === native[1] && native[0] !== native[2])
            assert(native[0][0] === native[2][0])
            await compareCompilers(path, native)
            // JSON fixture bytes are temporary: the npm package ships .mjs,
            // not .json test data. Attributes still refer to the loading path.
            const suffixes = /** @type {const} */ (['', '?v=1', '?v=1', '?v=2', '#a', '#b', '?', '#', '?#', '?v=1#', '?v=1#a', '?v=1#a', '?bad%/a:b#%2F'])
            const imports = suffixes.map((suffix, i) => `import v${i} from "./data.json${suffix}" with { type: "json" };`).join('\n')
            const source = imports + `\nexport default [${suffixes.map((_, i) => `v${i}`).join(',')}];`
            const jsonEntry = join(root, 'json.mjs')
            await writeFile(join(root, 'data.json'), '[[42]]')
            await writeFile(jsonEntry, source)
            for (let attempt = 0; attempt < 2; attempt++) {
                const jsonNative = (await import(pathToFileURL(jsonEntry).href)).default
                assertStructurallySame(identities(jsonNative), suffixGroups.map(a => suffixGroups.map(b => a === b)))
                await compareCompilers(jsonEntry, jsonNative)
            }
            for (const suffix of ['?v=1', '#copy', '?', '#']) {
                await hostCheck(resolveFileModule(`./alias/dep.mjs${suffix}`, pathToFileURL(path).href), result => {
                    assertEq(unwrap(result).id, import.meta.resolve(pathToFileURL(join(alias, 'dep.mjs')).href + suffix))
                })
            }
        } finally {
            await rm(temporary, { recursive: true, force: true })
        }
    },
}

export const proof = {
    // This resolver declares the Node profile even under Node-compatible APIs.
    // Bun/Deno loaders retain empty delimiters, so they are not its reference.
    nodeSuffixes: 'Bun' in globalThis || 'Deno' in globalThis ? {} : nodeSuffixProof,
    suffixCanonicalization: () => withFixtures(async directory => {
        const entry = new URL('entry%20%23%25.mjs', directory)
        const file = new URL('suffix-dep.mjs', directory)
        const cases = /** @type {const} */ ([
            ['', ''], ['?', ''], ['#', ''], ['?#', ''],
            ['?v=1#', '?v=1'], ['?#copy', '#copy'],
            ['?v=1#copy', '?v=1#copy'], ['?q=é x', '?q=%C3%A9%20x'],
            ['?bad%/a:b#%2F', '?bad%/a:b#%2F'],
        ])
        for (const [suffix, canonical] of cases) {
            await hostCheck(resolveFileModule(`./suffix-dep.mjs${suffix}`, entry.href + '?parent#old'), result => {
                assertStructurallySame(unwrap(result), { id: file.href + canonical, path: fileURLToPath(file) })
            })
        }
    }),
    fileIdentity: () => withFixtures(async directory => {
        const entry = new URL('entry%20%23%25.mjs', directory)
        const dependency = new URL('dep%20%23%25.mjs', directory)
        await hostCheck(resolveFileModule(fileURLToPath(entry), null), result => {
            const location = unwrap(result)
            assertEq(location.id, entry.href)
            assertEq(location.path, fileURLToPath(entry))
        })
        for (const spelling of ['./%64ep%20%23%25.mjs', './absent/%2e%2e/dep%20%23%25.mjs']) {
            await hostCheck(resolveFileModule(spelling, entry.href), result => {
                const location = unwrap(result)
                assertEq(location.id, dependency.href)
                assertEq(location.path, fileURLToPath(dependency))
            })
        }
    }),
    moduleSharing: () => withFixtures(async directory => {
        const entry = new URL('entry%20%23%25.mjs', directory)
        // Deno and Bun have different native URL resolution/cache semantics.
        // Only Node's native loader is an oracle for the declared Node profile.
        if (!('Bun' in globalThis) && !('Deno' in globalThis)) {
            const native = (await import(entry.href)).default
            assertStructurallySame(native, expectedValue)
            assertStructurallySame(sharing(native), expectedSharing)
        }
        // Both compiler paths must implement that profile on every runtime.
        // Repeated cold compiler loads preserve sharing even with a warm
        // native cache; compilation never caches instances across calls.
        for (const path of [fileURLToPath(entry), `${fileURLToPath(directory)}./entry #%.mjs`]) {
            await hostCheck(transpile(path), result => {
                const { value } = unwrap(result)
                assertStructurallySame(value, expectedValue)
                assertStructurallySame(sharing(value), expectedSharing)
            })
            await hostCheck(resolve(path), result => {
                const graph = unwrap(result)
                assert(graph instanceof Array && graph[0] === '[]')
                assertStructurallySame(sharing(graph[1]), expectedSharing)
            })
        }
    }),
    cycle: () => withFixtures(async directory => {
        const path = fileURLToPath(new URL('cycle.mjs', directory))
        for (const input of [path, `${fileURLToPath(directory)}./cycle.mjs`]) {
            /** @type {readonly Effect<NodeOp, unknown, ParseError>[]} */
            const effects = [transpile(input), resolve(input)]
            for (const effect of effects) {
                await hostCheck(effect, result => {
                    assert(result[0] === 'error')
                    assertEq(result[1].message, 'circular dependency')
                    assertEq(result[1].path, path)
                })
            }
        }
    }),
    resolutionErrors: () => withFixtures(async directory => {
        const entry = new URL('entry%20%23%25.mjs', directory)
        for (const name of ['./missing.mjs', './dep%2Fmjs', './bad%', 'https://example.com/dep.mjs']) {
            await hostCheck(resolveFileModule(name, entry.href), result => assertEq(result[0], 'error'))
        }
        const missing = fileURLToPath(new URL('missing.mjs', directory))
        /** @type {readonly Effect<NodeOp, unknown, ParseError>[]} */
        const effects = [transpile(missing), resolve(missing)]
        for (const effect of effects) {
            await hostCheck(effect, result => {
                assert(result[0] === 'error')
                assert(result[1].message.startsWith('module resolution failed:'))
            })
        }
    }),
}
