/** Host proofs for the personal-notes REST boundary. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { reviewPersonalNotes } from './github.mjs'

const token = /** @type {const} */ ('test-actions-token')
const base = /** @type {const} */ ('https://api.github.com/repos/owner/repo')
const event = /** @type {const} */ ({
    repository: { full_name: 'owner/repo' },
    pull_request: { number: 7, user: { login: 'sasha-gil' } },
})

/** @type {(payload: unknown, run: (eventPath: string) => Promise<void>) => Promise<void>} */
const withEvent = async (payload, run) => {
    const directory = await mkdtemp(join(tmpdir(), 'functionalscript-personal-notes-proof-'))
    const path = join(directory, 'event.json')
    try {
        await writeFile(path, JSON.stringify(payload))
        await run(path)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

/**
 * A REST API that answers the permission, the files and the reviews, and
 * records every write.
 *
 * @type {(permission: string, files: readonly unknown[], reviews: readonly unknown[], writes: string[]) => typeof fetch}
 */
const api = (permission, files, reviews, writes) => async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (method !== 'GET') {
        writes.push(`${method} ${url.slice(base.length)} ${String(init?.body)}`)
        return Response.json({})
    }
    if (url === `${base}/collaborators/sasha-gil/permission`) { return Response.json({ permission }) }
    if (url === `${base}/pulls/7/files?per_page=100&page=1`) { return Response.json(files) }
    if (url === `${base}/pulls/7/reviews?per_page=100&page=1`) { return Response.json(reviews) }
    return new Response('', { status: 404 })
}

const notes = [{ filename: 'doc/sasha-gil/wasm/README.md' }]
const ours = { id: 5, state: 'APPROVED', user: { login: 'github-actions[bot]' } }

export const proof = /** @type {const} */ ({
    approvesNotes: async () => withEvent(event, async eventPath => {
        /** @type {string[]} */
        const writes = []
        assertEq(await reviewPersonalNotes({ token, eventPath }, api('write', notes, [], writes)), 'approved')
        assertStructurallySame(writes, [
            'POST /pulls/7/reviews {"event":"APPROVE","body":"Every changed file is under `doc/sasha-gil/`, the personal notes of its author."}',
        ])
    }),
    keepsItsApproval: async () => withEvent(event, async eventPath => {
        /** @type {string[]} */
        const writes = []
        assertEq(await reviewPersonalNotes({ token, eventPath }, api('admin', notes, [ours], writes)), 'kept')
        assertEq(writes.length, 0)
    }),
    dismissesWhenCodeChanges: async () => withEvent(event, async eventPath => {
        /** @type {string[]} */
        const writes = []
        const files = [...notes, { filename: 'AGENTS.md' }]
        const people = { id: 6, state: 'APPROVED', user: { login: 'sergey-shandar' } }
        assertEq(await reviewPersonalNotes({ token, eventPath }, api('write', files, [ours, people], writes)), 'dismissed')
        assertStructurallySame(writes, [
            'PUT /pulls/7/reviews/5/dismissals {"event":"DISMISS","message":"The pull request is no longer only the personal notes under `doc/sasha-gil/`."}',
        ])
    }),
    leavesOthersToPeople: async () => withEvent(event, async eventPath => {
        /** @type {string[]} */
        const writes = []
        assertEq(await reviewPersonalNotes({ token, eventPath }, api('read', notes, [], writes)), 'left')
        assertEq(writes.length, 0)
    }),
    pagesThroughFiles: async () => withEvent(event, async eventPath => {
        /** @type {string[]} */
        const writes = []
        const full = Array.from({ length: 100 }, (_, i) => ({ filename: `doc/sasha-gil/${i}.md` }))
        /** @type {typeof fetch} */
        const request = async (input, init) => String(input) === `${base}/pulls/7/files?per_page=100&page=2`
            ? Response.json([{ filename: 'fjs/a.mjs' }])
            : api('write', full, [], writes)(input, init)
        assertEq(await reviewPersonalNotes({ token, eventPath }, request), 'left')
    }),
    refusesWithoutToken: async () => withEvent(event, async eventPath => {
        let message = ''
        try { await reviewPersonalNotes({ token: '', eventPath }) } catch (e) { message = e instanceof Error ? e.message : '' }
        assertEq(message, 'The Actions token is required to review personal notes.')
    }),
    refusesOtherEvents: async () => withEvent({ repository: { full_name: 'owner/repo' } }, async eventPath => {
        let message = ''
        try { await reviewPersonalNotes({ token, eventPath }) } catch (e) { message = e instanceof Error ? e.message : '' }
        assertEq(message, 'The event is not a pull request.')
    }),
    reportsHttpFailure: async () => withEvent(event, async eventPath => {
        let message = ''
        try {
            await reviewPersonalNotes({ token, eventPath }, async () => new Response('', { status: 403 }))
        } catch (e) { message = e instanceof Error ? e.message : '' }
        assertEq(message, 'GET /collaborators/sasha-gil/permission failed (HTTP 403).')
    }),
})
