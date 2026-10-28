/** GitHub Actions process boundary for pinned production and preview uploads. */

import { uploadArgs } from './cloudflare/module.f.mjs'
import { runWrangler } from './github-preview.mjs'

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
    process.exitCode = await runWrangler(uploadArgs(process.argv[2] ?? '', WORKERS_CI_BRANCH))
} catch {
    console.error('Website upload failed. Check CLOUDFLARE_API_TOKEN and the Wrangler output.')
    process.exitCode = 1
}
