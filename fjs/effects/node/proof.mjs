/**
 * Host proofs of the Node runner: the operations whose whole contract is
 * what the host does with them, driven against the real host. Each is a
 * `NodeProgram` run through `runEffect`, answering `0` where the host did
 * what the operation promises and a code naming what it did instead.
 *
 * File-module proofs own temporary trees and remove them in `finally`. They
 * exercise the sibling host runner; compiler traversal and diagnostics are
 * proved synchronously in `fsc/transpiler/proof.f.mjs`.
 *
 * @import { NodeProgram, NodeOp } from './types.ts'
 * @import { Effect } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import zlib from 'node:zlib'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { resultMapStep } from '../module.f.mjs'
import { maxLengthBytes, msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { tagLoose, tagPayload } from '../../git/testlib.f.mjs'
import { inflate, inflateTrailingCode, resolveFileModule } from './module.f.mjs'
import { runEffect } from './module.mjs'

/** @type {(program: NodeProgram) => Promise<number>} */
const exitCode = runEffect

/** @type {(n: number) => Uint8Array} */
const bytes = n => Uint8Array.from({ length: n }, (_, i) => i * 7 & 0xFF)

/** @type {(data: Uint8Array) => Uint8Array} */
const deflated = data => new Uint8Array(zlib.deflateSync(data))

/** @type {(...parts: readonly Uint8Array[]) => Uint8Array} */
const joined = (...parts) => new Uint8Array(parts.flatMap(p => [...p]))

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
    'dep #%.mjs': 'export const url = import.meta.url; export default [42];',
    'other.mjs': 'export default [42];',
    'left.mjs': 'import value from "./dep%20%23%25.mjs"; export default value;',
    'right.mjs': 'import value from "./absent/%2e%2e/dep%20%23%25.mjs"; export default value;',
    'cycle.mjs': 'import value from "./%63ycle.mjs"; export default value;',
    'entry #%.mjs': 'export const url = import.meta.url; import a from "./left.mjs"; import b from "./right.mjs"; import c from "./%64ep%20%23%25.mjs"; import d from "./other.mjs"; export default [a, b, c, d];',
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
    resolveFileModule: {
        fileIdentity: () => withFixtures(async directory => {
            const entry = new URL('entry%20%23%25.mjs', directory)
            const dependency = new URL('dep%20%23%25.mjs', directory)
            const path = fileURLToPath(entry)
            for (const name of [path, relative(process.cwd(), path), `${fileURLToPath(directory)}./entry #%.mjs`]) {
                await hostCheck(resolveFileModule(name, null), result => {
                    const location = unwrap(result)
                    assertEq(location.id, entry.href)
                    assertEq(location.path, path)
                })
            }
            for (const spelling of ['./dep%20%23%25.mjs', './%64ep%20%23%25.mjs', './absent/%2e%2e/dep%20%23%25.mjs']) {
                await hostCheck(resolveFileModule(spelling, entry.href), result => {
                    const location = unwrap(result)
                    assertEq(location.id, dependency.href)
                    assertEq(location.path, fileURLToPath(dependency))
                })
            }
        }),
        // Only Node's loader defines this profile. Compare the adapter's
        // identities with import.meta.url and actual native module instances;
        // compiler graph sharing is proved through synchronous mock effects.
        nativeIdentity: () => withFixtures(async directory => {
            if (!('Bun' in globalThis) && !('Deno' in globalThis)) {
                const entry = new URL('entry%20%23%25.mjs', directory)
                const dependency = new URL('dep%20%23%25.mjs', directory)
                const native = await import(entry.href)
                assertStructurallySame(native.default, expectedValue)
                assertStructurallySame(sharing(native.default), expectedSharing)
                for (const name of [fileURLToPath(entry), relative(process.cwd(), fileURLToPath(entry))]) {
                    await hostCheck(resolveFileModule(name, null), result => assertEq(unwrap(result).id, native.url))
                }
                for (const spelling of ['./dep%20%23%25.mjs', './%64ep%20%23%25.mjs', './absent/%2e%2e/dep%20%23%25.mjs']) {
                    const imported = await import(new URL(spelling, entry).href)
                    assertEq(imported.default, native.default[0])
                    await hostCheck(resolveFileModule(spelling, entry.href), result => {
                        assertEq(unwrap(result).id, imported.url)
                        assertEq(unwrap(result).path, fileURLToPath(dependency))
                    })
                }
            }
        }),
        cycleIdentity: () => withFixtures(async directory => {
            const cycle = new URL('cycle.mjs', directory)
            await hostCheck(resolveFileModule(fileURLToPath(cycle), null), result => assertEq(unwrap(result).id, cycle.href))
            await hostCheck(resolveFileModule('./%63ycle.mjs', cycle.href), result => assertEq(unwrap(result).id, cycle.href))
        }),
        resolutionErrors: () => withFixtures(async directory => {
            const entry = new URL('entry%20%23%25.mjs', directory)
            for (const name of ['./missing.mjs', './dep%2Fmjs', './bad%', './left.mjs?', './left.mjs#', 'https://example.com/dep.mjs']) {
                await hostCheck(resolveFileModule(name, entry.href), result => assertEq(result[0], 'error'))
            }
            const missing = fileURLToPath(new URL('missing.mjs', directory))
            await hostCheck(resolveFileModule(missing, null), result => assertEq(result[0], 'error'))
        }),
    },
    inflate: {
        // A stream through the real zlib: the bytes it was made from, every
        // one, and the whole input taken.
        roundTrip: async () => {
            const data = bytes(1000)
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(deflated(data))), r => {
                if (r[0] === 'error') { return error(1) }
                const out = toArray(u8List(msb)(r[1]))
                return out.length === data.length && out.every((b, i) => b === data[i]) ? ok(0) : error(2)
            })
            assertEq(await exitCode(program), 0)
        },
        // A stream another zlib wrote: the loose object file Git 2.43 wrote
        // for the checked-in tag, inflated to the envelope the tag's bytes
        // make, every one, so what the runner reads is what Git writes and
        // not only what Node deflates.
        gitWrote: async () => {
            const envelope = toArray(writeEnvelope('tag', tagPayload))
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(u8ListToVec(msb)(tagLoose)), r => {
                if (r[0] === 'error') { return error(1) }
                const out = toArray(u8List(msb)(r[1]))
                return out.length === envelope.length && out.every((b, i) => b === envelope[i]) ? ok(0) : error(2)
            })
            assertEq(await exitCode(program), 0)
        },
        // Bytes after the end of the stream are refused with the runner's
        // own code, since zlib alone would read the stream and say nothing.
        trailing: async () => {
            const input = joined(deflated(bytes(10)), new Uint8Array([1, 2, 3]))
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(input)), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === inflateTrailingCode
                    && r[1][1].message === '3 bytes after the end of the zlib stream' ? ok(0) : error(1))
            assertEq(await exitCode(program), 0)
        },
        // Bytes that are no zlib stream are the channel's: Node's own code, kept.
        notZlib: async () => {
            /** @type {NodeProgram} */
            const program = () => resultMapStep(inflate(toVec(new Uint8Array([0x6A, 0x75, 0x6E, 0x6B]))), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'Z_DATA_ERROR' ? ok(0) : error(1))
            assertEq(await exitCode(program), 0)
        },
        // A stream that inflates past the bound is refused, not cut short:
        // one byte over `maxLengthBytes` is `ERR_BUFFER_TOO_LARGE`, and the
        // bound itself inflates.
        bound: async () => {
            const most = Number(maxLengthBytes)
            /** @type {NodeProgram} */
            const over = () => resultMapStep(inflate(toVec(deflated(new Uint8Array(most + 1)))), r =>
                r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'ERR_BUFFER_TOO_LARGE' ? ok(0) : error(1))
            assertEq(await exitCode(over), 0)
            /** @type {NodeProgram} */
            const fits = () => resultMapStep(inflate(toVec(deflated(new Uint8Array(most)))), r => r[0] === 'ok' ? ok(0) : error(1))
            assertEq(await exitCode(fits), 0)
        },
    },
}
