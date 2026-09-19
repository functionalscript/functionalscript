/**
 * Temporary-filesystem proofs of the Node file-module profile on every runtime.
 * Native ESM comparisons run on Node, whose loader defines this profile.
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
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

const expectedValue = [[42], [42], [42], [42]]
const expectedSharing = [true, true, true]

/** Observe sharing, not just equal contents. @type {(value: unknown) => readonly boolean[]} */
const sharing = value => {
    assert(value instanceof Array)
    const [a, b, c, d] = value
    return [a === b, b === c, c !== d]
}

export const proof = {
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
        for (const name of ['./missing.mjs', './dep%2Fmjs', './bad%', './left.mjs?', './left.mjs#', 'https://example.com/dep.mjs']) {
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
