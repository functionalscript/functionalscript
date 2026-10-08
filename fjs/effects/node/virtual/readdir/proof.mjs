/**
 * Portable ordering through the real Node adapter, on every supported OS.
 * A pure shuffled-input proof covers unsorted enumeration even on POSIX;
 * this proof checks the adapter actually applies the normalization.
 *
 * @import { Dir } from '../types.ts'
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { resultMapStep } from '../../../module.f.mjs'
import { ok } from '../../../../types/result/module.f.mjs'
import { readdir } from '../../module.f.mjs'
import { runEffect } from '../../module.mjs'
import { emptyState, virtualOperationMap } from '../module.f.mjs'

export const proof = {
    portableOrder: async () => {
        const root = await mkdtemp(join(tmpdir(), 'fjs-readdir-'))
        try {
            // No case-only collisions: these names also coexist on Windows.
            /** @type {readonly string[]} */
            const files = ['z', 'B', '10', '9', 'a/f', 'a/x/deep/h', 'a!/g', 'a!/y', '\uE000/file', '\u{10000}/file']
            for (const name of files) {
                const path = join(root, name)
                await mkdir(dirname(path), { recursive: true })
                await writeFile(path, '')
            }
            /** @type {readonly []} */
            const file = []
            /** @type {Dir} */
            const base = {
                z: file, B: file, '10': file, '9': file,
                a: { f: file, x: { deep: { h: file } } },
                'a!': { g: file, y: file },
                '\uE000': { file }, '\u{10000}': { file },
            }
            /** @type {readonly string[]} */
            const flat = ['10', '9', 'B', 'a', 'a!', 'z', '\uE000', '\u{10000}']
            /** @type {readonly string[]} */
            const recursive = [
                ...flat, 'a/f', 'a/x', 'a!/g', 'a!/y', '\uE000/file', '\u{10000}/file',
                'a/x/deep', 'a/x/deep/h',
            ]
            for (const recurse of [false, true]) {
                /** @type {{ readonly recursive?: true }} */
                const options = recurse ? { recursive: true } : {}
                const expected = recurse ? recursive : flat
                const [, virtual] = virtualOperationMap.readdir('base', options)({ ...emptyState, root: { base } })
                assertStructurallySame(
                    assertOk(virtual).map(({ name, parentPath }) => `${parentPath}/${name}`.slice('base/'.length)),
                    expected)
                assertEq(await runEffect(() => resultMapStep(readdir(root, options), result => {
                    assertStructurallySame(
                        assertOk(result).map(({ name, parentPath }) => relative(root, join(parentPath, name)).split(sep).join('/')),
                        expected)
                    return ok(0)
                })), 0)
            }
            // Host failures still use the same effect channel and code.
            assertEq(await runEffect(() => resultMapStep(readdir(join(root, 'missing'), {}), result => {
                assert(result[0] === 'error', result)
                assert(result[1][0] === 'ioError', result[1])
                assertEq(result[1][1].code, 'ENOENT')
                return ok(0)
            })), 0)
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    },
}
