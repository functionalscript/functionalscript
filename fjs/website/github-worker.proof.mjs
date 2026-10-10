/**
 * Host proofs for the requested Cloudflare boundary: real Request/Response
 * bodies, origin and method refusals, fixed GitHub exchange parameters, and
 * asset delegation. FunctionalScript cannot observe fetch or HTTP headers.
 * Provider responses are supplied locally; no live credentials are used.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import worker, { handleGithubRequest } from './github-worker.mjs'

/** @type {string} */
const origin = 'https://functionalscript.example'
const env = /** @type {const} */ ({
    GITHUB_CLIENT_ID: 'public-client-id',
    GITHUB_CLIENT_SECRET: 'worker-only-secret',
    GITHUB_REDIRECT_URI: `${origin}/prs/`,
})
const verifier = 'a'.repeat(43)
const exchange = /** @type {const} */ ({ code: 'temporary-code', verifier })
const token = /** @type {const} */ ({ access_token: 'browser-only-token', token_type: 'bearer' })

/** @type {(value: unknown, status?: number) => Response} */
const json = (value, status = 200) => Response.json(value, { status })

/** @type {(body?: unknown, headers?: Record<string, string>) => Request} */
const request = (body = exchange, headers = {}) => new Request(`${origin}/auth/github/token`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
})

/** A refusal must not leak provider text or permit a cross-origin browser read. */
/** @type {(response: Response, status: number) => Promise<void>} */
const refused = async (response, status) => {
    assertEq(response.status, status)
    assertEq(response.headers.get('Cache-Control'), 'no-store')
    assertEq(response.headers.get('Access-Control-Allow-Origin'), null)
    const text = await response.text()
    assert(!text.includes('worker-only-secret'))
    assert(!text.includes('private-provider-detail'))
    assert(!text.includes('private-provider-uri'))
    assert(!text.includes('browser-only-token'))
    assert(!text.includes('temporary-code'))
}

/** Token exchange exposes only a fixed failure category and local message. */
/** @type {(response: Response, status: number, reason: string) => Promise<void>} */
const exchangeRefused = async (response, status, reason) => {
    await refused(response.clone(), status)
    const body = await response.json()
    assertStructurallySame(Object.keys(body).sort(), ['error', 'reason'])
    assertEq(typeof body.error, 'string')
    assertEq(body.reason, reason)
}

/** The admission boundary must refuse bad browser input before contacting GitHub. */
const noNetwork = /** @type {const} */ ({
    fetch: /** @type {typeof fetch} */ (() => { throw new Error('Invalid input reached the provider.') }),
})

export const proof = /** @type {const} */ ({
    publicConfiguration: async () => {
        const response = await worker.fetch(new Request(`${origin}/auth/github/config`), env)
        assertEq(response.status, 200)
        assertEq(response.headers.get('Cache-Control'), 'no-store')
        assertStructurallySame(await response.json(), { clientId: 'public-client-id', redirectUri: `${origin}/prs/` })
        assertEq(response.headers.get('Set-Cookie'), null)
    },
    configurationDiagnosticsNameOnlyMissingBindings: async () => {
        const cases = /** @type {const} */ ([
            { configured: {}, missing: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'] },
            { configured: { ...env, GITHUB_CLIENT_ID: '' }, missing: ['GITHUB_CLIENT_ID'] },
            { configured: { ...env, GITHUB_CLIENT_SECRET: '' }, missing: ['GITHUB_CLIENT_SECRET'] },
            { configured: { ...env, GITHUB_REDIRECT_URI: '' }, missing: ['GITHUB_REDIRECT_URI'] },
            { configured: { GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID }, missing: ['GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'] },
        ])
        for (const { configured, missing } of cases) {
            const response = await handleGithubRequest(new Request(`${origin}/auth/github/config`), configured, noNetwork)
            await refused(response.clone(), 503)
            assertStructurallySame(await response.json(), {
                error: 'GitHub login is not configured.', missingBindings: missing, invalidRedirectUri: false,
            })
        }
    },
    configurationDiagnosticsIdentifyInvalidCallbackWithoutValues: async () => {
        const redirects = /** @type {const} */ ([
            'invalid', 'http://untrusted.example/prs/', `${origin}/elsewhere/`,
            `${origin}/prs/?query=true`, `${origin}/prs/#fragment`,
            'https://user:password@functionalscript.example/prs/',
        ])
        for (const redirect of redirects) {
            const response = await handleGithubRequest(new Request(`${origin}/auth/github/config`), {
                ...env, GITHUB_CLIENT_ID: 'private-client-detail',
                GITHUB_CLIENT_SECRET: 'private-secret-detail', GITHUB_REDIRECT_URI: redirect,
            }, noNetwork)
            await refused(response.clone(), 503)
            const text = await response.clone().text()
            assert(!text.includes('private-client-detail'))
            assert(!text.includes('private-secret-detail'))
            assert(!text.includes(JSON.stringify(redirect)))
            assertStructurallySame(await response.json(), {
                error: 'GitHub login is not configured.', missingBindings: [], invalidRedirectUri: true,
            })
        }
        const mixed = await handleGithubRequest(new Request(`${origin}/auth/github/config`), {
            ...env, GITHUB_CLIENT_ID: '', GITHUB_REDIRECT_URI: 'invalid',
        }, noNetwork)
        await refused(mixed.clone(), 503)
        assertStructurallySame(await mixed.json(), {
            error: 'GitHub login is not configured.', missingBindings: ['GITHUB_CLIENT_ID'], invalidRedirectUri: true,
        })
    },
    tokenConfigurationFailuresKeepGenericShape: async () => {
        const cases = /** @type {const} */ ([
            {}, { ...env, GITHUB_CLIENT_SECRET: '' }, { ...env, GITHUB_REDIRECT_URI: 'invalid' },
        ])
        for (const configured of cases) {
            const response = await handleGithubRequest(request(), configured, noNetwork)
            await refused(response.clone(), 503)
            assertStructurallySame(await response.json(), { error: 'GitHub login is not configured.' })
        }
    },
    exchangesOnlyThroughConfiguredProvider: async () => {
        /** @type {RequestInit | undefined} */
        let options
        const fetch = /** @type {typeof globalThis.fetch} */ (async (input, init) => {
            assertEq(input, 'https://github.com/login/oauth/access_token')
            options = init
            return json({ ...token, scope: '', refresh_token: 'not-returned', extra: true })
        })
        const response = await handleGithubRequest(request(), env, { fetch })
        assertEq(response.status, 200)
        assertStructurallySame(await response.json(), token)
        assertEq(response.headers.get('Cache-Control'), 'no-store')
        assertEq(response.headers.get('X-Content-Type-Options'), 'nosniff')
        assertEq(response.headers.get('Set-Cookie'), null)
        assertEq(response.headers.get('Access-Control-Allow-Origin'), null)
        assertEq(options?.method, 'POST')
        assertEq(new Headers(options?.headers).get('Accept'), 'application/json')
        assertEq(new Headers(options?.headers).get('Content-Type'), 'application/x-www-form-urlencoded')
        assertStructurallySame(Object.fromEntries(new URLSearchParams(String(options?.body))), {
            client_id: 'public-client-id', client_secret: 'worker-only-secret',
            redirect_uri: `${origin}/prs/`, code: 'temporary-code', code_verifier: verifier,
        })
        assertEq(options?.redirect, 'manual')
        assertEq(options?.credentials, 'omit')
        assertEq(options?.cache, 'no-store')
        assert(options?.signal instanceof AbortSignal)
    },
    refusesProviderRedirectsWithoutFollowingOrAcceptingTokens: async () => {
        for (const status of [302, 307]) {
            let calls = 0
            const response = await handleGithubRequest(request(), env, {
                fetch: /** @type {typeof fetch} */ (async (input, options) => {
                    calls += 1
                    assertEq(input, 'https://github.com/login/oauth/access_token')
                    assertEq(options?.redirect, 'manual')
                    return new Response(JSON.stringify({ ...token, scope: '' }), {
                        status,
                        headers: {
                            'Content-Type': 'application/json',
                            Location: 'https://unrelated.example/private-provider-uri',
                        },
                    })
                }),
            })
            assertEq(calls, 1)
            await exchangeRefused(response, 502, 'provider_error')
        }
    },
    unavailableWithoutTrustedConfiguration: async () => {
        for (const configured of [
            {}, { ...env, GITHUB_CLIENT_SECRET: '' }, { ...env, GITHUB_CLIENT_ID: '' },
            { ...env, GITHUB_REDIRECT_URI: 'invalid' },
            { ...env, GITHUB_REDIRECT_URI: 'http://untrusted.example/prs/' },
            { ...env, GITHUB_REDIRECT_URI: `${origin}/elsewhere/` },
            { ...env, GITHUB_REDIRECT_URI: `${origin}/prs/?query=true` },
            { ...env, GITHUB_REDIRECT_URI: `${origin}/prs/#fragment` },
            { ...env, GITHUB_REDIRECT_URI: 'https://user:password@functionalscript.example/prs/' },
        ]) {
            await refused(await handleGithubRequest(request(), configured, noNetwork), 503)
        }
        await refused(await handleGithubRequest(new Request('https://preview.example/auth/github/config'), env, noNetwork), 403)
        await refused(await handleGithubRequest(new Request('https://preview.example/auth/github/token', {
            method: 'POST', headers: { Origin: 'https://preview.example' },
        }), env, noNetwork), 403)
    },
    allowsExplicitLoopbackDevelopment: async () => {
        for (const local of ['http://localhost:8787', 'http://127.0.0.1:8787', 'http://[::1]:8787']) {
            const response = await handleGithubRequest(new Request(`${local}/auth/github/config`), {
                ...env, GITHUB_REDIRECT_URI: `${local}/prs/`,
            }, noNetwork)
            assertEq(response.status, 200)
            assertStructurallySame(await response.json(), { clientId: 'public-client-id', redirectUri: `${local}/prs/` })
        }
    },
    refusesWrongMethodsAndOrigins: async () => {
        for (const [path, method, allow] of [
            ['config', 'POST', 'GET'], ['token', 'GET', 'POST'], ['token', 'OPTIONS', 'POST'],
        ]) {
            const response = await handleGithubRequest(new Request(`${origin}/auth/github/${path}`, { method }), env, noNetwork)
            assertEq(response.headers.get('Allow'), allow)
            await refused(response, 405)
        }
        for (const value of ['https://untrusted.example', 'null', `${origin}.untrusted.example`]) {
            await refused(await handleGithubRequest(request(exchange, { Origin: value }), env, noNetwork), 403)
        }
        const missingOrigin = new Request(`${origin}/auth/github/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exchange),
        })
        await refused(await handleGithubRequest(missingOrigin, env, noNetwork), 403)
    },
    refusesMalformedBodiesAndCallbackOverrides: async () => {
        for (const body of [
            null, [], {}, { code: 'temporary-code' }, { ...exchange, code: 1 },
            { ...exchange, code: '' }, { ...exchange, code: 'x'.repeat(1_025) },
            { ...exchange, verifier: 'short' }, { ...exchange, verifier: `${'a'.repeat(42)}=` },
            { ...exchange, redirect_uri: 'https://untrusted.example/prs/' },
            { ...exchange, client_secret: 'untrusted' }, 'x'.repeat(4_097),
        ]) {
            await refused(await handleGithubRequest(request(body), env, noNetwork), 400)
        }
        await refused(await handleGithubRequest(new Request(`${origin}/auth/github/token`, {
            method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{',
        }), env, noNetwork), 400)
        await refused(await handleGithubRequest(request(exchange, { 'Content-Type': 'text/plain' }), env, noNetwork), 415)
        const response = await handleGithubRequest(request(exchange, { 'Content-Type': 'application/json; charset=utf-8' }), env, {
            fetch: /** @type {typeof fetch} */ (async () => json({ ...token, scope: '' })),
        })
        assertEq(response.status, 200)
    },
    refusesMissingMalformedAndNonemptyProviderScopes: async () => {
        const cases = /** @type {const} */ ([
            { value: token, reason: 'provider_error' },
            { value: { ...token, scope: null }, reason: 'provider_error' },
            { value: { ...token, scope: 42 }, reason: 'provider_error' },
            { value: { ...token, scope: ['repo'] }, reason: 'provider_error' },
            { value: { ...token, scope: 'repo' }, reason: 'unexpected_scope' },
            { value: { ...token, scope: 'read:user,user:email' }, reason: 'unexpected_scope' },
            { value: { ...token, scope: 'private-provider-detail worker-only-secret' }, reason: 'unexpected_scope' },
            { value: { ...token, scope: ' ' }, reason: 'unexpected_scope' },
        ])
        for (const { value, reason } of cases) {
            await exchangeRefused(await handleGithubRequest(request(), env, {
                fetch: /** @type {typeof fetch} */ (async () => json(value)),
            }), 400, reason)
        }
    },
    identifiesDocumentedOAuthFailuresWithoutProviderDetails: async () => {
        const reasons = /** @type {const} */ ([
            'incorrect_client_credentials', 'redirect_uri_mismatch',
            'bad_verification_code', 'unverified_user_email',
        ])
        for (const reason of reasons) {
            // GitHub can return OAuth error JSON with an HTTP 200 response.
            for (const status of [200, 400]) {
                const response = await handleGithubRequest(request(), env, {
                    fetch: /** @type {typeof fetch} */ (async () => json({
                        error: reason,
                        error_description: 'private-provider-detail',
                        error_uri: 'https://github.com/private-provider-uri',
                        client_secret: env.GITHUB_CLIENT_SECRET,
                        code: exchange.code,
                        access_token: token.access_token,
                    }, status)),
                })
                await exchangeRefused(response, 400, reason)
            }
        }
    },
    sanitizesProviderFailures: async () => {
        for (const { value, status } of [
            { value: json({
                error: 'private-provider-detail', error_description: 'private-provider-detail',
                error_uri: 'https://github.com/private-provider-uri',
                client_secret: env.GITHUB_CLIENT_SECRET, code: exchange.code,
            }), status: 400 },
            { value: json({ error: ['incorrect_client_credentials'], error_description: 'private-provider-detail' }), status: 400 },
            { value: json(null), status: 400 },
            { value: json(['private-provider-detail']), status: 400 },
            { value: json({ ...token, access_token: '', scope: '' }), status: 400 },
            { value: json({ ...token, token_type: 'different', scope: '' }), status: 400 },
            { value: json({ error_description: 'private-provider-detail' }, 400), status: 400 },
            { value: json({ error_description: 'private-provider-detail' }, 500), status: 502 },
            { value: new Response('{'), status: 502 },
        ]) {
            await exchangeRefused(await handleGithubRequest(request(), env, {
                fetch: /** @type {typeof fetch} */ (async () => value),
            }), status, 'provider_error')
        }
        await exchangeRefused(await handleGithubRequest(request(), env, {
            fetch: /** @type {typeof fetch} */ (async () => { throw new Error('private-provider-detail worker-only-secret') }),
        }), 502, 'network_error')
        await exchangeRefused(await handleGithubRequest(request(), env, {
            fetch: /** @type {typeof fetch} */ (async () => { throw new DOMException('private-provider-detail', 'TimeoutError') }),
        }), 502, 'network_error')
    },
    delegatesOnlyNonAuthPathsToAssets: async () => {
        const page = new Request(`${origin}/prs/`)
        const expected = new Response('static page')
        let calls = 0
        const assets = /** @type {const} */ ({
            fetch: async (/** @type {Request} */ incoming) => {
                calls += 1
                assertEq(incoming, page)
                return expected
            },
        })
        assertEq(await worker.fetch(page, { ASSETS: assets }), expected)
        assertEq(calls, 1)
        await refused(await handleGithubRequest(new Request(`${origin}/auth/github/unknown`), { ASSETS: assets }), 404)
        assertEq(calls, 1)
        assertEq((await handleGithubRequest(page, {})).status, 404)
    },
})
