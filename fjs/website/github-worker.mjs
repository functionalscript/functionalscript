/**
 * A stateless Cloudflare boundary for GitHub's authorization-code exchange.
 * No user sessions, cookies, database, or token persistence are required.
 * The registered callback and client credentials come only from bindings;
 * all GitHub API reads happen directly in the user's browser.
 *
 * @module
 *
 * @import { ExchangeFailure, WorkerEnv, WorkerHost } from './github/types.ts'
 */

import { parse } from '../rtti/parse/module.f.mjs'
import { exchangeSchema, providerErrorSchema, providerErrorReason, providerTokenSchema, validVerifier } from './github/module.f.mjs'

const readExchange = parse(exchangeSchema)
const readProviderToken = parse(providerTokenSchema)
const readProviderError = parse(providerErrorSchema)

/** All authorization responses are excluded from caches, including refusals. */
/** @type {(value: unknown, status?: number, headers?: Record<string, string>) => Response} */
const json = (value, status = 200, headers = {}) => Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
})

/** Provider details are replaced by fixed reasons that contain no credentials. */
/** @type {(reason: ExchangeFailure['reason'], status: number) => Response} */
const signInFailure = (reason, status) => json({ error: 'GitHub sign-in failed. Try again.', reason }, status)

/** URL parsing and transport safety belong to this host boundary. */
/** @type {(value: string | undefined) => URL | null} */
const callback = value => {
    if (value === undefined) { return null }
    try {
        const url = new URL(value)
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        const secure = url.protocol === 'https:' || (url.protocol === 'http:' && loopback)
        return secure && url.pathname === '/prs/' && url.search === '' && url.hash === ''
            && url.username === '' && url.password === '' ? url : null
    } catch {
        return null
    }
}

/**
 * Serve the two explicit auth routes and delegate all other paths to assets.
 * The fetch override proves the real HTTP boundary without live credentials.
 *
 * @type {(request: Request, env: WorkerEnv, host?: WorkerHost) => Promise<Response>}
 */
export const handleGithubRequest = async (request, env, host = {}) => {
    const url = new URL(request.url)
    const config = url.pathname === '/auth/github/config'
    const exchange = url.pathname === '/auth/github/token'
    if (!config && !exchange) {
        if (url.pathname.startsWith('/auth/github/')) { return json({ error: 'Not found.' }, 404) }
        return env.ASSETS === undefined ? new Response('Not found.', { status: 404 }) : env.ASSETS.fetch(request)
    }
    const method = config ? 'GET' : 'POST'
    if (request.method !== method) { return json({ error: 'Method not allowed.' }, 405, { Allow: method }) }
    const redirect = callback(env.GITHUB_REDIRECT_URI)
    if (redirect === null || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        if (!config) { return json({ error: 'GitHub login is not configured.' }, 503) }
        const bindingNames = /** @type {const} */ ([
            'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI',
        ])
        return json({
            error: 'GitHub login is not configured.',
            missingBindings: bindingNames.filter(name => env[name] === undefined || env[name] === ''),
            invalidRedirectUri: env.GITHUB_REDIRECT_URI !== undefined && env.GITHUB_REDIRECT_URI !== '' && redirect === null,
        }, 503)
    }
    if (url.origin !== redirect.origin) { return json({ error: 'GitHub login is unavailable on this origin.' }, 403) }
    if (config) { return json({ clientId: env.GITHUB_CLIENT_ID, redirectUri: redirect.href }) }
    if (request.headers.get('Origin') !== url.origin) { return json({ error: 'Origin not allowed.' }, 403) }
    const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'application/json') { return json({ error: 'JSON is required.' }, 415) }

    let body
    try {
        const text = await request.text()
        if (text.length > 4_096) { return json({ error: 'Invalid sign-in request.' }, 400) }
        body = JSON.parse(text)
    } catch {
        return json({ error: 'Invalid sign-in request.' }, 400)
    }
    const [tag, admitted] = readExchange(body)
    if (tag === 'error') { return json({ error: 'Invalid sign-in request.' }, 400) }
    const { code, verifier } = admitted
    if (code.length === 0 || code.length > 1_024 || !validVerifier(verifier)) {
        return json({ error: 'Invalid sign-in request.' }, 400)
    }
    const fetchRequest = host.fetch ?? globalThis.fetch
    let response
    try {
        response = await fetchRequest('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                redirect_uri: redirect.href,
                code,
                code_verifier: verifier,
            }),
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.timeout(15_000),
        })
    } catch {
        return signInFailure('network_error', 502)
    }
    // Workers supports manual redirects; never forward app credentials or
    // accept an authorization response from a redirected endpoint.
    if (response.status >= 300 && response.status < 400) {
        return signInFailure('provider_error', 502)
    }
    let value
    try {
        value = await response.json()
    } catch {
        return signInFailure('provider_error', 502)
    }
    const [errorTag, providerError] = readProviderError(value)
    if (errorTag === 'ok') {
        return signInFailure(providerErrorReason(providerError.error), response.status >= 500 ? 502 : 400)
    }
    if (!response.ok) { return signInFailure('provider_error', response.status >= 500 ? 502 : 400) }
    const [tokenTag, token] = readProviderToken(value)
    if (tokenTag === 'error' || token.access_token === '') {
        return signInFailure('provider_error', 400)
    }
    if (token.scope !== '') { return signInFailure('unexpected_scope', 400) }
    return json({ access_token: token.access_token, token_type: token.token_type })
}

/** Cloudflare's ExecutionContext is not part of the optional proof host. */
export default /** @type {const} */ ({
    /** @type {(request: Request, env: WorkerEnv) => Promise<Response>} */
    fetch: (request, env) => handleGithubRequest(request, env),
})
