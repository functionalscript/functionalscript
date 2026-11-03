/** GitHub REST boundary for the personal-notes approval. */

import { readFile } from 'node:fs/promises'

import { notesPrefix, onlyPersonalNotes } from './module.f.js'

const bot = /** @type {const} */ ('github-actions[bot]')

/**
 * Approve a pull request that changes only its author's personal notes, or
 * dismiss the approval this workflow gave once it no longer does, since the
 * repository keeps approvals across pushes. The pull request is read through
 * the API and never checked out. Answers what it did.
 *
 * @type {(options: { readonly token: string, readonly eventPath: string }, request?: typeof fetch) => Promise<'approved' | 'kept' | 'dismissed' | 'left'>}
 */
export const reviewPersonalNotes = async ({ token, eventPath }, request = fetch) => {
    if (!token) { throw new Error('The Actions token is required to review personal notes.') }
    const event = JSON.parse(await readFile(eventPath, 'utf8'))
    const repository = event.repository?.full_name
    const number = event.pull_request?.number
    const author = event.pull_request?.user?.login
    if (typeof repository !== 'string' || !Number.isInteger(number) || typeof author !== 'string') {
        throw new Error('The event is not a pull request.')
    }
    const base = `https://api.github.com/repos/${repository}`
    const headers = /** @type {const} */ ({
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    /** @type {(path: string, method?: string, body?: unknown) => Promise<any>} */
    const call = async (path, method = 'GET', body = undefined) => {
        const response = await request(`${base}${path}`, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        if (!response.ok) { throw new Error(`${method} ${path} failed (HTTP ${response.status}).`) }
        return response.json()
    }
    /** @type {(path: string) => Promise<readonly any[]>} */
    const all = async path => {
        /** @type {any[]} */
        const items = []
        for (let page = 1; ; page += 1) {
            /** @type {readonly any[]} */
            const next = await call(`${path}?per_page=100&page=${page}`)
            items.push(...next)
            if (next.length < 100) { return items }
        }
    }
    const { permission } = await call(`/collaborators/${encodeURIComponent(author)}/permission`)
    const { changed_files: changedFiles } = await call(`/pulls/${number}`)
    const files = await all(`/pulls/${number}/files`)
    const ours = (await all(`/pulls/${number}/reviews`))
        .filter(review => review.user?.login === bot && review.state === 'APPROVED')
    const prefix = notesPrefix(author)
    if (onlyPersonalNotes(author, permission, files, changedFiles)) {
        if (ours.length !== 0) { return 'kept' }
        await call(`/pulls/${number}/reviews`, 'POST', {
            event: 'APPROVE',
            body: `Every changed file is under \`${prefix}\`, the personal notes of its author.`,
        })
        return 'approved'
    }
    for (const review of ours) {
        await call(`/pulls/${number}/reviews/${review.id}/dismissals`, 'PUT', {
            event: 'DISMISS',
            message: `The pull request is no longer only the personal notes under \`${prefix}\`.`,
        })
    }
    return ours.length === 0 ? 'left' : 'dismissed'
}
