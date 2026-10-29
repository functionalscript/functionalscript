/** GitHub Actions process boundary for pinned production and preview uploads. */

import { uploadArgs } from './cloudflare/module.f.mjs'
import { runWrangler } from './github-preview.mjs'
import { uploadPreviewWithComment } from './github-preview-comment.mjs'

try {
    const {
        CLOUDFLARE_API_TOKEN,
        WORKERS_CI_BRANCH = '',
    } = process.env
    if (!CLOUDFLARE_API_TOKEN) {
        throw new Error('Configure CLOUDFLARE_API_TOKEN before uploading.')
    }
    // Account is committed in wrangler.jsonc. keep_vars and Wrangler's version
    // upload preserve existing Worker variables and secrets without re-uploading.
    const mode = process.argv[2] ?? ''
    const args = uploadArgs(mode, WORKERS_CI_BRANCH)
    process.exitCode = mode === 'preview' && process.env.GITHUB_ACTIONS === 'true'
        ? await uploadPreviewWithComment(args, {
            token: process.env.GITHUB_TOKEN ?? '',
            eventPath: process.env.GITHUB_EVENT_PATH ?? '',
        })
        : await runWrangler(args)
} catch {
    console.error('Website upload or preview comment failed. Check CLOUDFLARE_API_TOKEN, Actions permissions, and the workflow output.')
    process.exitCode = 1
}
