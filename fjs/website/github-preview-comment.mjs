/** GitHub REST boundary for one updatable website-preview comment per PR. */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runWrangler } from './github-preview.mjs'

const marker = /** @type {const} */ ('<!-- functionalscript-website-preview -->')

/**
 * Use the automatically supplied Actions token and pull-request event. Existing
 * comments belong to github-actions[bot], so a user's matching text is untouched.
 * @type {(previewUrl: string, options: { readonly token: string, readonly eventPath: string }, request?: typeof fetch) => Promise<void>}
 */
export const commentPreview = async (previewUrl, { token, eventPath }, request = fetch) => {
    if (!token) { throw new Error('The Actions token is required to publish a preview comment.') }
    const event = JSON.parse(await readFile(eventPath, 'utf8'))
    const repository = event.repository?.full_name
    if (typeof repository !== 'string' || !Number.isInteger(event.number)
        || event.pull_request?.head?.repo?.full_name !== repository) {
        throw new Error('Preview comments require a same-repository pull request.')
    }
    const url = new URL(previewUrl)
    if (url.protocol !== 'https:') { throw new Error('The preview URL must use HTTPS.') }
    const base = `https://api.github.com/repos/${repository}`
    const headers = /** @type {const} */ ({
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    const body = `${marker}\nWebsite preview: [Open preview](${url.href})`
    for (let page = 1; ; page += 1) {
        const response = await request(`${base}/issues/${event.number}/comments?per_page=100&page=${page}`, { headers })
        if (!response.ok) { throw new Error(`Unable to read preview comments (HTTP ${response.status}).`) }
        /** @type {readonly { readonly id: number, readonly body: string, readonly user: { readonly login: string } }[]} */
        const comments = await response.json()
        const existing = comments.find(comment => comment.user.login === 'github-actions[bot]' && comment.body.startsWith(marker))
        if (existing !== undefined || comments.length < 100) {
            const target = existing === undefined
                ? `${base}/issues/${event.number}/comments`
                : `${base}/issues/comments/${existing.id}`
            const result = await request(target, {
                method: existing === undefined ? 'POST' : 'PATCH',
                headers,
                body: JSON.stringify({ body }),
            })
            if (!result.ok) { throw new Error(`Unable to publish the preview comment (HTTP ${result.status}).`) }
            return
        }
    }
}

/**
 * Read Wrangler's pinned structured output instead of reconstructing its URL.
 * The temporary file stays outside the asset directory and is always removed.
 * @type {(args: readonly string[], options: { readonly token: string, readonly eventPath: string }, run?: typeof runWrangler, request?: typeof fetch) => Promise<number>}
 */
export const uploadPreviewWithComment = async (args, options, run = runWrangler, request = fetch) => {
    const directory = await mkdtemp(join(tmpdir(), 'functionalscript-preview-upload-'))
    const outputPath = join(directory, 'wrangler.ndjson')
    try {
        const code = await run(args, { ...process.env, WRANGLER_OUTPUT_FILE_PATH: outputPath })
        if (code !== 0) { return code }
        const entries = (await readFile(outputPath, 'utf8')).split('\n').filter(line => line !== '').map(line => JSON.parse(line))
        const uploaded = entries.find(entry => entry.type === 'version-upload')
        if (typeof uploaded?.preview_alias_url !== 'string' || uploaded.preview_alias_url === '') {
            throw new Error('Wrangler did not report a preview alias URL.')
        }
        await commentPreview(uploaded.preview_alias_url, options, request)
        return 0
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}
