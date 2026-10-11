/**
 * Host proofs for the Cloudflare build's process and filesystem boundary:
 * the commands it runs, in order, in which environment, and that the
 * toolchain directory is gone afterwards. The processes and the download are
 * supplied locally; nothing is installed.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { rust } from '../ci/config/module.f.js'
import { buildOnCloudflare } from './cloudflare-build.mjs'

/** @type {(failAt: number) => { readonly build: Promise<number>, readonly calls: string[][], readonly directory: () => string }} */
const trace = failAt => {
    /** @type {string[][]} */
    const calls = []
    let directory = ''
    const build = buildOnCloudflare({
        platform: 'linux',
        arch: 'x64',
        download: async (url, path) => {
            assertEq(url, 'https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init')
            assert(isAbsolute(path))
            directory = dirname(path)
            assert(existsSync(directory))
            calls.push(['download', path])
        },
        run: async (command, args, env) => {
            assertEq(env.CARGO_HOME, directory)
            assertEq(env.RUSTUP_HOME, directory)
            calls.push([command, ...args])
            return calls.length === failAt ? 17 : 0
        },
    })
    return { build, calls, directory: () => directory }
}

export const proof = /** @type {const} */ ({
    installsDocumentsThenGenerates: async () => {
        const { build, calls, directory } = trace(0)
        assertEq(await build, 0)
        const d = directory()
        assertStructurallySame(calls, [
            ['download', `${d}/rustup-init`],
            [`${d}/rustup-init`, '-y', '--profile', 'minimal', '--default-toolchain', rust, '--no-modify-path'],
            [`${d}/bin/cargo`, 'doc', '--no-deps', '--workspace'],
            ['npm', 'run', 'website'],
        ])
        assert(!existsSync(d))
    },
    // A failed step is the build's exit code, and nothing after it runs.
    stopsAtTheFirstFailure: async () => {
        for (const failAt of [2, 3]) {
            const { build, calls, directory } = trace(failAt)
            assertEq(await build, 17)
            assertEq(calls.length, failAt)
            assert(!existsSync(directory()))
        }
    },
    refusesAHostWithoutAnInstaller: async () => {
        const failure = await buildOnCloudflare({ platform: 'win32', arch: 'x64' })
            .then(() => null, (/** @type {unknown} */ error) => error)
        assert(failure instanceof Error)
    },
    removesTheDirectoryAfterARejectedDownload: async () => {
        let path = ''
        const failure = new Error('offline')
        const result = await buildOnCloudflare({
            platform: 'linux', arch: 'arm64',
            download: async (_, p) => { path = p; await readFile(p).catch(() => undefined); throw failure },
        }).then(() => null, (/** @type {unknown} */ error) => error)
        assertEq(result, failure)
        assert(!existsSync(dirname(path)))
    },
})
