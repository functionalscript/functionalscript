/** Host proofs for GitHub event files and the comment REST boundary. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'

import { assert, assertEq } from '../asserts/module.f.js'
import { commentPreview, uploadPreviewWithComment } from './github-preview-comment.mjs'

const event = /** @type {const} */ ({
    number: 42,
    repository: { full_name: 'owner/repo' },
    pull_request: { head: { repo: { full_name: 'owner/repo' } } },
})
const token = /** @type {const} */ ('test-actions-token')
const previewUrl = /** @type {const} */ ('https://actions-feature-worker.example.workers.dev/')
const commentMarker = /** @type {const} */ ('<!-- functionalscript-website-preview -->')

/** @type {(payload: unknown, run: (eventPath: string) => Promise<void>) => Promise<void>} */
const withEvent = async (payload, run) => {
    const directory = await mkdtemp(join(tmpdir(), 'functionalscript-preview-comment-proof-'))
    const path = join(directory, 'event.json')
    try {
        await writeFile(path, JSON.stringify(payload))
        await run(path)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

export const proof = /** @type {const} */ ({
    publishesWranglerReportedAliasAndCleansOutput: async () => withEvent(event, async eventPath => {
        let outputPath = ''
        let published = ''
        const code = await uploadPreviewWithComment(['wrangler', 'versions', 'upload'], { token, eventPath }, async (args, env) => {
            assertEq(args.join(' '), 'wrangler versions upload')
            assert(typeof env?.WRANGLER_OUTPUT_FILE_PATH === 'string')
            outputPath = env.WRANGLER_OUTPUT_FILE_PATH
            assert(isAbsolute(outputPath))
            await writeFile(outputPath, JSON.stringify({ type: 'wrangler-session' }) + '\n'
                + JSON.stringify({ type: 'version-upload', preview_alias_url: previewUrl, preview_url: 'https://other-version.example.com' }) + '\n')
            return 0
        }, async (_input, init) => {
            if (init?.method === 'POST') { published = JSON.parse(String(init.body)).body }
            return Response.json(init?.method === 'POST' ? {} : [])
        })
        assertEq(code, 0)
        assert(published.includes(previewUrl))
        assert(!published.includes('other-version'))
        assert(!existsSync(outputPath))
        assert(!existsSync(dirname(outputPath)))
    }),
    failedUploadDoesNotReadOutputOrPublish: async () => withEvent(event, async eventPath => {
        let outputPath = ''
        let published = false
        const code = await uploadPreviewWithComment([], { token, eventPath }, async (_args, env) => {
            assert(typeof env?.WRANGLER_OUTPUT_FILE_PATH === 'string')
            outputPath = env.WRANGLER_OUTPUT_FILE_PATH
            return 7
        }, async () => { published = true; return Response.json([]) })
        assertEq(code, 7)
        assertEq(published, false)
        assert(!existsSync(dirname(outputPath)))
    }),
    cleansOutputAfterMissingAliasOrCommentFailure: async () => withEvent(event, async eventPath => {
        for (const output of [
            null,
            { type: 'version-upload' },
            { type: 'version-upload', preview_alias_url: '' },
            { type: 'version-upload', preview_alias_url: previewUrl },
        ]) {
            let outputPath = ''
            const failure = await uploadPreviewWithComment([], { token, eventPath }, async (_args, env) => {
                assert(typeof env?.WRANGLER_OUTPUT_FILE_PATH === 'string')
                outputPath = env.WRANGLER_OUTPUT_FILE_PATH
                if (output !== null) { await writeFile(outputPath, JSON.stringify(output)) }
                return 0
            }, async () => new Response(token, { status: 403 }))
                .then(() => null, (/** @type {unknown} */ error) => error)
            assert(failure instanceof Error)
            assert(!failure.message.includes(token))
            assert(!existsSync(outputPath))
            assert(!existsSync(dirname(outputPath)))
        }
    }),
    createsCommentAndLeavesUserCommentUntouched: async () => withEvent(event, async eventPath => {
        let calls = 0
        /** @type {typeof fetch} */
        const request = async (input, init) => {
            calls += 1
            assertEq(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`)
            if (calls === 1) {
                assertEq(String(input), 'https://api.github.com/repos/owner/repo/issues/42/comments?per_page=100&page=1')
                return Response.json([{ id: 1, body: commentMarker, user: { login: 'reviewer' } }])
            }
            assertEq(String(input), 'https://api.github.com/repos/owner/repo/issues/42/comments')
            assertEq(init?.method, 'POST')
            assertEq(JSON.parse(String(init?.body)).body, `${commentMarker}\nWebsite preview: [Open preview](${previewUrl})`)
            return Response.json({ id: 2 }, { status: 201 })
        }
        await commentPreview(previewUrl, { token, eventPath }, request)
        assertEq(calls, 2)
    }),
    updatesOwnCommentBeyondFirstPage: async () => withEvent(event, async eventPath => {
        let calls = 0
        /** @type {typeof fetch} */
        const request = async (input, init) => {
            calls += 1
            if (calls === 1) {
                return Response.json(Array.from({ length: 100 }, (_, id) => ({ id, body: 'unrelated', user: { login: 'reviewer' } })))
            }
            if (calls === 2) {
                assert(String(input).endsWith('page=2'))
                return Response.json([{ id: 101, body: `${commentMarker}\nOld URL`, user: { login: 'github-actions[bot]' } }])
            }
            assertEq(String(input), 'https://api.github.com/repos/owner/repo/issues/comments/101')
            assertEq(init?.method, 'PATCH')
            assertEq(JSON.parse(String(init?.body)).body, `${commentMarker}\nWebsite preview: [Open preview](${previewUrl})`)
            return Response.json({ id: 101 })
        }
        await commentPreview(previewUrl, { token, eventPath }, request)
        assertEq(calls, 3)
    }),
    refusesUnavailableTokenOrUntrustedEvent: async () => {
        for (const [configuredToken, payload] of /** @type {const} */ ([
            ['', event],
            [token, {}],
            [token, { ...event, number: '42' }],
            [token, { ...event, pull_request: { head: { repo: { full_name: 'fork/repo' } } } }],
        ])) {
            await withEvent(payload, async eventPath => {
                let called = false
                const failure = await commentPreview(previewUrl, { token: configuredToken, eventPath }, async () => {
                    called = true
                    return Response.json([])
                }).then(() => null, (/** @type {unknown} */ error) => error)
                assert(failure instanceof Error)
                assert(!failure.message.includes(token))
                assertEq(called, false)
            })
        }
    },
    refusesNonHttpsUrl: async () => withEvent(event, async eventPath => {
        let called = false
        const failure = await commentPreview('http://example.com', { token, eventPath }, async () => {
            called = true
            return Response.json([])
        }).then(() => null, (/** @type {unknown} */ error) => error)
        assert(failure instanceof Error)
        assertEq(called, false)
    }),
    reportsReadAndWriteFailuresWithoutResponseContents: async () => {
        for (const failRead of [true, false]) {
            await withEvent(event, async eventPath => {
                let calls = 0
                const failure = await commentPreview(previewUrl, { token, eventPath }, async () => {
                    calls += 1
                    return calls === 1 && !failRead
                        ? Response.json([])
                        : new Response(token, { status: 403 })
                }).then(() => null, (/** @type {unknown} */ error) => error)
                assert(failure instanceof Error)
                assert(failure.message.includes('HTTP 403'))
                assert(!failure.message.includes(token))
                assertEq(calls, failRead ? 1 : 2)
            })
        }
    },
})
