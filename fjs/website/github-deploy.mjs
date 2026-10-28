/** GitHub Actions process boundary for pinned production and preview uploads. */

import { uploadArgs } from './cloudflare/module.f.mjs'
import { uploadGitHubVersion } from './github-preview.mjs'

try {
    const {
        CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID,
        WORKERS_CI_BRANCH = '',
        GITHUB_CLIENT_ID = '',
        GITHUB_CLIENT_SECRET = '',
        GITHUB_REDIRECT_URI = '',
        GITHUB_PREVIEW_REDIRECT_URI = '',
    } = process.env
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
        throw new Error('Configure the Cloudflare token and account before deploying.')
    }
    process.exitCode = await uploadGitHubVersion(
        { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI, GITHUB_PREVIEW_REDIRECT_URI },
        uploadArgs(process.argv[2] ?? '', WORKERS_CI_BRANCH))
} catch {
    console.error('Website deployment failed. Check mode, branch, Cloudflare credentials and GitHub app bindings.')
    process.exitCode = 1
}
