/**
 * Read-only filesystem proofs of the Node file-module profile on every runtime.
 * Native ESM comparisons run on Node, whose loader defines this profile.
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { realpathSync } from 'node:fs'
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

// Bun can retain an extra slash in import.meta.url. Derive expectations from
// the canonical filesystem location, independently of the proof loader's URL.
const source = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)))
const directory = new URL('./fixtures/url%2523identity/', source)
const entry = new URL('entry%20%23%25.mjs', directory)
const dependency = new URL('dep%20%23%25.mjs', directory)
const cycle = new URL('cycle.mjs', directory)
const expectedValue = [[42], [42], [42], [42]]
const expectedSharing = [true, true, true]

/** Observe sharing, not just equal contents. @type {(value: unknown) => readonly boolean[]} */
const sharing = value => {
    assert(value instanceof Array)
    const [a, b, c, d] = value
    return [a === b, b === c, c !== d]
}

export const proof = {
    fileIdentity: async () => {
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
    },
    moduleSharing: async () => {
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
    },
    cycle: async () => {
        const path = fileURLToPath(cycle)
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
    },
    resolutionErrors: async () => {
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
    },
}
