/**
 * Host proofs for preview upload's filesystem and process boundary: the
 * actual temporary secret file, its permissions and cleanup, and the argv
 * passed to Wrangler. FunctionalScript cannot observe host files or await
 * an external process. The process is supplied locally; no upload is made.
 */

import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { uploadGitHubPreview } from './github-preview.mjs'

const env = /** @type {const} */ ({
    GITHUB_CLIENT_ID: 'public-client-id',
    GITHUB_CLIENT_SECRET: 'preview-only-secret',
    GITHUB_REDIRECT_URI: 'https://functionalscript.example/prs/',
})

/** @type {(args: readonly string[]) => string} */
const secretPath = args => {
    const index = args.indexOf('--secrets-file')
    assert(index >= 0)
    const path = args[index + 1]
    assert(isAbsolute(path))
    return path
}

/** Cleanup covers the containing temporary directory as well as the file. */
/** @type {(path: string) => void} */
const removed = path => {
    assert(path !== '')
    assert(!existsSync(path))
    assert(!existsSync(dirname(path)))
}

export const proof = /** @type {const} */ ({
    uploadsPublicBindingsAndProtectedSecretFile: async () => {
        let path = ''
        const result = await uploadGitHubPreview(env, {
            run: async args => {
                path = secretPath(args)
                assertStructurallySame(args, [
                    'wrangler', 'versions', 'upload',
                    '--var', `GITHUB_CLIENT_ID:${env.GITHUB_CLIENT_ID}`,
                    '--var', `GITHUB_REDIRECT_URI:${env.GITHUB_REDIRECT_URI}`,
                    '--secrets-file', path,
                ])
                assert(args.every(arg => !arg.includes(env.GITHUB_CLIENT_SECRET)))
                assertStructurallySame(JSON.parse(await readFile(path, 'utf8')), {
                    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
                })
                if (process.platform !== 'win32') {
                    assertEq((await stat(path)).mode & 0o777, 0o600)
                }
                return 0
            },
        })
        assertEq(result, 0)
        removed(path)
    },
    removesSecretFileAfterNonzeroExit: async () => {
        let path = ''
        const result = await uploadGitHubPreview(env, {
            run: async args => {
                path = secretPath(args)
                assert(existsSync(path))
                return 17
            },
        })
        assertEq(result, 17)
        removed(path)
    },
    removesSecretFileAfterRejectedProcess: async () => {
        let path = ''
        const failure = new Error('Preview upload failed.')
        const result = await uploadGitHubPreview(env, {
            run: async args => {
                path = secretPath(args)
                assert(existsSync(path))
                throw failure
            },
        }).then(() => null, (/** @type {unknown} */ error) => error)
        assertEq(result, failure)
        removed(path)
    },
    missingOrEmptyBindingsPreventUpload: async () => {
        const cases = /** @type {const} */ ([
            { GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI: env.GITHUB_REDIRECT_URI },
            { GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID, GITHUB_REDIRECT_URI: env.GITHUB_REDIRECT_URI },
            { GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET },
            { ...env, GITHUB_CLIENT_ID: '' },
            { ...env, GITHUB_CLIENT_SECRET: '' },
            { ...env, GITHUB_REDIRECT_URI: '' },
        ])
        for (const configured of cases) {
            let called = false
            const failure = await uploadGitHubPreview(configured, {
                run: async () => { called = true; return 0 },
            }).then(() => null, (/** @type {unknown} */ error) => error)
            assert(failure instanceof Error)
            assertEq(called, false)
            assert(!failure.message.includes(env.GITHUB_CLIENT_SECRET))
            assert(!failure.message.includes(env.GITHUB_CLIENT_ID))
            assert(!failure.message.includes(env.GITHUB_REDIRECT_URI))
        }
    },
})
