/**
 * The Cloudflare site build: install the pinned Rust, document the workspace,
 * generate the site. Cloudflare's Workers Builds runs it as the build
 * command, and it is the one place that command's steps are written down.
 *
 * The toolchain goes into a temporary directory the build removes again, as
 * `CARGO_HOME` and `RUSTUP_HOME`, so nothing is installed into the image's
 * home directory and nothing in the repository folder — the directory the
 * site serves — is touched beyond `target/`. What to install and what to run
 * is decided in `./cloudflare/module.f.mjs`.
 *
 * @module
 * @import { CloudflareBuildHost } from './cloudflare/types.ts'
 */

import { spawn } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { docArgs, rustupInitArgs, rustupInitUrl, targetTriple } from './cloudflare/module.f.mjs'

/** Runs a command without a shell, inheriting the build's output. */
/** @type {(command: string, args: readonly string[], env: Readonly<Record<string, string | undefined>>) => Promise<number>} */
const run = (command, args, env) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, env })
    child.once('error', () => reject(new Error(`Unable to start ${command}.`)))
    child.once('exit', code => resolve(code ?? 1))
})

/** Saves the installer and makes it executable. */
/** @type {(url: string, path: string) => Promise<void>} */
const download = async (url, path) => {
    const response = await fetch(url)
    if (!response.ok) { throw new Error(`${url}: ${response.status}`) }
    await writeFile(path, new Uint8Array(await response.arrayBuffer()))
    await chmod(path, 0o755)
}

/**
 * Runs the three steps in order and answers the exit code of the first that
 * fails, or the generator's. The toolchain directory is removed either way.
 *
 * @type {(host?: CloudflareBuildHost) => Promise<number>}
 */
export const buildOnCloudflare = async (host = {}) => {
    const triple = targetTriple(host.platform ?? process.platform, host.arch ?? process.arch)
    if (triple === null) { throw new Error('No rustup installer for this host.') }
    const directory = await mkdtemp(join(tmpdir(), 'functionalscript-cloudflare-build-'))
    try {
        const env = { ...process.env, CARGO_HOME: directory, RUSTUP_HOME: directory }
        const rustupInit = join(directory, 'rustup-init')
        await (host.download ?? download)(rustupInitUrl(triple), rustupInit)
        const installed = await (host.run ?? run)(rustupInit, rustupInitArgs, env)
        if (installed !== 0) { return installed }
        const documented = await (host.run ?? run)(join(directory, 'bin', 'cargo'), docArgs, env)
        if (documented !== 0) { return documented }
        return await (host.run ?? run)('npm', ['run', 'website'], env)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

/** CLI execution remains separate from imported host proofs. */
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
    process.exitCode = await buildOnCloudflare()
}
