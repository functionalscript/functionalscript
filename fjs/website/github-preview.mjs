/**
 * Upload a preview with GitHub app bindings when production is asset-only.
 * Build variables become explicit Worker bindings; the app secret is sent
 * through Wrangler's encrypted secret upload, never through command arguments.
 *
 * @module
 * @import { WorkerEnv, PreviewUploadHost } from './github/types.ts'
 */

import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Run the selected Cloudflare CLI without invoking a shell. */
/** @type {(args: readonly string[], env?: NodeJS.ProcessEnv) => Promise<number>} */
export const runWrangler = (args, env = process.env) => new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit', shell: false, env })
    child.once('error', () => reject(new Error('Unable to start the Worker upload.')))
    child.once('exit', code => resolve(code ?? 1))
})

/**
 * Keep the temporary secret outside the uploaded asset directory and remove
 * it after every upload attempt, including failed or rejected attempts.
 * The optional runner proves the filesystem boundary without live credentials.
 *
 * @type {(env: WorkerEnv, command: readonly string[], host?: PreviewUploadHost) => Promise<number>}
 */
export const uploadGitHubVersion = async (env, command, host = {}) => {
    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI, GITHUB_PREVIEW_REDIRECT_URI } = env
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_REDIRECT_URI) {
        throw new Error('Set all three GitHub app build bindings before uploading this version.')
    }
    const directory = await mkdtemp(join(tmpdir(), 'functionalscript-github-preview-'))
    try {
        const secretFile = join(directory, 'secrets.json')
        await writeFile(secretFile, JSON.stringify({ GITHUB_CLIENT_SECRET }), { mode: 0o600 })
        return await (host.run ?? runWrangler)([
            ...command,
            '--var', `GITHUB_CLIENT_ID:${GITHUB_CLIENT_ID}`,
            '--var', `GITHUB_REDIRECT_URI:${GITHUB_REDIRECT_URI}`,
            ...(GITHUB_PREVIEW_REDIRECT_URI ? ['--var', `GITHUB_PREVIEW_REDIRECT_URI:${GITHUB_PREVIEW_REDIRECT_URI}`] : []),
            '--secrets-file', secretFile,
        ])
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

/** Preserve the Workers Builds preview command while GitHub Actions is staged. */
/** @type {(env: WorkerEnv, host?: PreviewUploadHost) => Promise<number>} */
export const uploadGitHubPreview = (env, host = {}) => uploadGitHubVersion(env, ['wrangler', 'versions', 'upload'], host)

/** CLI execution remains separate from imported host proofs. */
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
    try {
        const {
            GITHUB_CLIENT_ID = '',
            GITHUB_CLIENT_SECRET = '',
            GITHUB_REDIRECT_URI = '',
            GITHUB_PREVIEW_REDIRECT_URI = '',
        } = process.env
        process.exitCode = await uploadGitHubPreview({ GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI, GITHUB_PREVIEW_REDIRECT_URI })
    } catch {
        console.error('GitHub preview upload failed. Check the three build bindings and Wrangler output.')
        process.exitCode = 1
    }
}
