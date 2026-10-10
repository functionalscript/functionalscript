/**
 * Host proofs for GitHub login's requested browser boundary: WebCrypto PKCE,
 * tab-local pending state, callback URL cleanup, actual fetch responses, and
 * manual login/logout events. FunctionalScript cannot observe this browser
 * session or complete asynchronous HTTP and DOM operations.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { startGitHubLogin } from './github-runtime.mjs'

const origin = /** @type {const} */ ('https://functionalscript.test')
const callback = /** @type {const} */ (`${origin}/prs/`)
const pendingKey = /** @type {const} */ ('functionalscript.github.login')
const now = () => Date.UTC(2026, 9, 10, 12)
const pending = /** @type {const} */ ({ state: 'pending-state', verifier: 'a'.repeat(43), createdAt: now() })
const config = /** @type {const} */ ({ clientId: 'client-id', redirectUri: callback })
const token = /** @type {const} */ ({ access_token: 'test-token', token_type: 'bearer' })

/**
 * The recording Window implements only the browser operations login needs.
 * Its history updates the URL synchronously, so fetch can observe whether
 * authorization data was removed before the first request.
 *
 * @type {(href?: string, stored?: string | null) => any}
 */
const dom = (href = callback, stored = null) => {
    let current = new URL(href)
    /** @type {Map<string, string>} */
    const storage = new Map(stored === null ? [] : [[pendingKey, stored]])
    /** @type {string[]} */
    const redirects = []
    /** @type {string[]} */
    const history = []
    /** @type {[string, string, string | null][]} */
    const writes = []
    /** @type {(() => void)[]} */
    const pageHides = []
    /** @type {(kind: string) => any} */
    const element = kind => {
        /** @type {(() => void | Promise<void>)[]} */
        const listeners = []
        /** @type {Map<string, string>} */
        const attributes = new Map()
        return {
            localName: kind,
            disabled: false,
            hidden: false,
            textContent: '',
            get href() { return attributes.get('href') ?? '' },
            set href(/** @type {string} */ value) { attributes.set('href', value) },
            getAttribute: (/** @type {string} */ name) => attributes.get(name) ?? null,
            setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => { attributes.set(name, value) },
            removeAttribute: (/** @type {string} */ name) => { attributes.delete(name) },
            addEventListener: (/** @type {string} */ name, /** @type {() => void | Promise<void>} */ listener) => {
                assertEq(name, 'click')
                listeners.push(listener)
            },
            listeners,
            click: () => Promise.all(listeners.map(listener => listener())),
        }
    }
    const login = element('button')
    const logout = element('button')
    const account = element('strong')
    const user = element('a')
    const note = element('p')
    const window = /** @type {const} */ ({
        addEventListener: (/** @type {string} */ kind, /** @type {() => void} */ listener) => {
            assertEq(kind, 'pagehide')
            pageHides.push(listener)
        },
        location: {
            get href() { return current.href },
            get origin() { return current.origin },
            get pathname() { return current.pathname },
            get search() { return current.search },
            get hash() { return current.hash },
            assign: (/** @type {string | URL} */ url) => { redirects.push(String(url)) },
        },
        history: {
            replaceState: (/** @type {unknown} */ _data, /** @type {string} */ _unused, /** @type {string | URL} */ url) => {
                current = new URL(String(url), current)
                history.push(current.href)
            },
        },
        crypto: globalThis.crypto,
        btoa: globalThis.btoa,
        sessionStorage: {
            getItem: (/** @type {string} */ key) => storage.get(key) ?? null,
            setItem: (/** @type {string} */ key, /** @type {string} */ value) => {
                storage.set(key, value)
                writes.push(['set', key, value])
            },
            removeItem: (/** @type {string} */ key) => {
                storage.delete(key)
                writes.push(['remove', key, null])
            },
        },
    })
    const root = /** @type {const} */ ({
        ownerDocument: { defaultView: window },
        querySelector: (/** @type {string} */ selector) => {
            if (selector === '[data-github-login]') { return login }
            if (selector === '[data-github-logout]') { return logout }
            if (selector === '[data-github-account]') { return account }
            if (selector === '[data-github-user]') { return user }
            if (selector === '[data-github-note]') { return note }
            return null
        },
    })
    return {
        root, login, logout, account, user, note, window, storage, writes, redirects, history,
        current: () => new URL(current),
        pagehide: () => { pageHides.forEach(listener => listener()) },
    }
}

/** @type {(value: unknown, status?: number) => Response} */
const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' },
})

/**
 * A strict response queue observes the URL at each network boundary and
 * records request options without making live API requests.
 *
 * @type {(page: any, responses: readonly (Response | (() => Response | Promise<Response>))[], callback?: boolean) => { readonly fetch: typeof fetch, readonly urls: URL[], readonly options: (RequestInit | undefined)[], readonly remaining: () => number }}
 */
const queue = (page, responses, callback = false) => {
    /** @type {URL[]} */
    const urls = []
    /** @type {(RequestInit | undefined)[]} */
    const options = []
    let next = 0
    const fetch = /** @type {typeof globalThis.fetch} */ (async (input, init) => {
        if (callback) {
            assert(!page.current().searchParams.has('code'))
            assert(!page.current().searchParams.has('state'))
            assert(!page.current().searchParams.has('error'))
            assert(!page.current().searchParams.has('error_description'))
        }
        urls.push(new URL(String(input), page.current().origin))
        options.push(init)
        assert(next < responses.length, 'unexpected authentication request')
        const response = responses[next]
        next += 1
        return typeof response === 'function' ? response() : response
    })
    return { fetch, urls, options, remaining: () => responses.length - next }
}

/** @type {(query?: string, stored?: string | null) => any} */
const returning = (query = 'code=github-code&state=pending-state', stored = JSON.stringify(pending)) =>
    dom(`${callback}?keep=1&${query}#section`, stored)

/** PKCE's URL-safe base64 encoding, observed independently of the runtime. */
/** @type {(bytes: ArrayBuffer) => string} */
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .split('+').join('-').split('/').join('_').split('=').join('')

/** @type {(page: any) => void} */
const assertNoPersistedToken = page => {
    assert([...page.storage.values()].every(value => !value.includes('test-token')))
    assert(page.writes.every((/** @type {[string, string, string | null]} */ write) =>
        write[1] === pendingKey && !String(write[2]).includes('test-token')))
    assert(!page.note.textContent.includes('test-token'))
    assert(!page.account.textContent.includes('test-token'))
    assert(!page.user.textContent.includes('test-token'))
    assert(!String(page.user.getAttribute('href')).includes('test-token'))
    assert(page.redirects.every((/** @type {string} */ value) => !value.includes('test-token')))
    assert(page.history.every((/** @type {string} */ value) => !value.includes('test-token')))
}

/** @type {(page: any) => void} */
const assertLoggedOut = page => {
    assertEq(page.account.textContent, 'Not logged in to GitHub.')
    assertEq(page.user.hidden, true)
    assertEq(page.user.textContent, '')
    assertEq(page.user.getAttribute('href'), null)
}

/** @type {(page: any) => void} */
const assertOctocat = page => {
    assertEq(page.account.textContent, 'Logged in as')
    assertEq(page.user.hidden, false)
    assertEq(page.user.textContent, '@octocat')
    assertEq(page.user.getAttribute('href'), 'https://github.com/octocat')
}

export const proof = /** @type {const} */ ({
    loginUsesGitHubAndPkce: async () => {
        const page = dom()
        const net = queue(page, [json(config)])
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.disabled, false)
        await page.login.click()
        assertEq(page.redirects.length, 1)
        const target = new URL(page.redirects[0])
        assertEq(target.origin, 'https://github.com')
        assertEq(target.pathname, '/login/oauth/authorize')
        assertEq(target.searchParams.get('client_id'), config.clientId)
        assertEq(target.searchParams.get('redirect_uri'), callback)
        assertEq(target.searchParams.get('prompt'), 'select_account')
        assertEq(target.searchParams.get('code_challenge_method'), 'S256')
        assert(!target.searchParams.has('scope'))
        assert(!target.searchParams.has('client_secret'))
        assert(!target.searchParams.has('access_token'))
        assert(!target.searchParams.has('code_verifier'))
        const saved = JSON.parse(page.storage.get(pendingKey))
        assertStructurallySame(Object.keys(saved).sort(), ['createdAt', 'state', 'verifier'])
        assertEq(saved.createdAt, now())
        assertEq(saved.verifier.length, 43)
        assert(saved.verifier.split('').every((/** @type {string} */ char) =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.includes(char)))
        assert(saved.state.length >= 32)
        assert(!target.href.includes(saved.verifier))
        assertEq(target.searchParams.get('state'), saved.state)
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(saved.verifier))
        assertEq(target.searchParams.get('code_challenge'), base64url(digest))
        assertEq(net.urls[0].pathname, '/auth/github/config')
        assertEq(net.remaining(), 0)
        assertNoPersistedToken(page)
    },
    loginReturnsToProductionAndPreviewSites: async () => {
        const sites = /** @type {const} */ ([
            'https://functionalscript.functionalscript.workers.dev',
            'https://functionalscript.com',
            'https://codex-github-login-previews-functionalscript.functionalscript.workers.dev',
            'https://codex-github-login-functionalscript.functionalscript.workers.dev',
        ])
        for (const site of sites) {
            const redirectUri = `${site}/prs/`
            const siteConfig = { clientId: config.clientId, redirectUri }
            const page = dom(redirectUri)
            const net = queue(page, [json(siteConfig)])
            await startGitHubLogin(page.root, { fetch: net.fetch, now })
            await page.login.click()
            assertEq(page.redirects.length, 1)
            const authorize = new URL(page.redirects[0])
            assertEq(authorize.origin, 'https://github.com')
            assertEq(authorize.pathname, '/login/oauth/authorize')
            assertEq(authorize.searchParams.get('redirect_uri'), redirectUri)
            assertEq(authorize.searchParams.get('prompt'), 'select_account')
            assertEq(net.urls[0].href, `${site}/auth/github/config`)
            const saved = JSON.parse(page.storage.get(pendingKey))
            assertEq(authorize.searchParams.get('state'), saved.state)
            assert(!authorize.href.includes(saved.verifier))
            assertNoPersistedToken(page)

            const returned = dom(`${redirectUri}?code=github-code&state=${saved.state}`, JSON.stringify(saved))
            const callbackNet = queue(returned, [json(siteConfig), json(token), json({ login: 'octocat' })], true)
            const session = await startGitHubLogin(returned.root, { fetch: callbackNet.fetch, now })
            assertEq(session.token(), token.access_token)
            assertOctocat(returned)
            assertEq(returned.current().href, redirectUri)
            assertEq(callbackNet.urls[1].href, `${site}/auth/github/token`)
            assertEq(returned.storage.get(pendingKey), undefined)
            assertEq(net.remaining(), 0)
            assertEq(callbackNet.remaining(), 0)
            assertNoPersistedToken(returned)
        }
    },
    cachedPageCanStartLoginAgainAfterLeavingForGitHub: async () => {
        const page = dom()
        const net = queue(page, [json(config)])
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        await page.login.click()
        assertEq(page.redirects.length, 1)
        assertEq(page.login.disabled, true)
        const first = new URL(page.redirects[0])
        page.pagehide()
        assertEq(session.token(), null)
        assertEq(page.login.disabled, false)
        assertLoggedOut(page)
        await page.login.click()
        assertEq(page.redirects.length, 2)
        const second = new URL(page.redirects[1])
        assertEq(second.origin, 'https://github.com')
        assertEq(second.pathname, '/login/oauth/authorize')
        assertEq(second.searchParams.get('client_id'), config.clientId)
        assertEq(second.searchParams.get('prompt'), 'select_account')
        assert(first.searchParams.get('state') !== second.searchParams.get('state'))
        assertEq(JSON.parse(page.storage.get(pendingKey)).state, second.searchParams.get('state'))
        assertEq(net.remaining(), 0)
        assertNoPersistedToken(page)
    },
    callbackExchangesThenReadsIdentity: async () => {
        const page = returning()
        const net = queue(page, [json(config), json(token), json({ login: 'octocat' })], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), 'test-token')
        assertOctocat(page)
        assert(!page.note.textContent.includes('octocat'))
        assertEq(page.storage.get(pendingKey), undefined)
        assertEq(page.current().href, `${callback}?keep=1#section`)
        assertStructurallySame(net.urls.map(url => url.pathname), ['/auth/github/config', '/auth/github/token', '/user'])
        assertEq(net.options[1]?.method, 'POST')
        assertStructurallySame(JSON.parse(String(net.options[1]?.body)), { code: 'github-code', verifier: pending.verifier })
        assertEq(new Headers(net.options[1]?.headers).get('content-type'), 'application/json')
        assertEq(net.urls[2].origin, 'https://api.github.com')
        assertEq(new Headers(net.options[2]?.headers).get('authorization'), 'Bearer test-token')
        assertEq(net.remaining(), 0)
        assertNoPersistedToken(page)
        await page.logout.click()
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.disabled, false)
        assertNoPersistedToken(page)
    },
    leavingPageClearsMemoryEvenWhenBrowserCachesIt: async () => {
        const page = returning()
        const net = queue(page, [json(config), json(token), json({ login: 'octocat' })], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), 'test-token')
        assertOctocat(page)
        page.pagehide()
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.hidden, false)
        assertEq(page.logout.hidden, true)
        assertNoPersistedToken(page)
    },
    identityResponseAfterPagehideCannotRestoreLogin: async () => {
        const page = returning()
        /** @type {(response: Response) => void} */
        let finish = () => {}
        /** @type {Promise<Response>} */
        const blocked = new Promise(resolve => { finish = resolve })
        /** @type {() => void} */
        let reached = () => {}
        /** @type {Promise<void>} */
        const requested = new Promise(resolve => { reached = resolve })
        const net = queue(page, [json(config), json(token), () => {
            reached()
            return blocked
        }], true)
        const initial = startGitHubLogin(page.root, { fetch: net.fetch, now })
        await requested
        page.pagehide()
        finish(json({ login: 'octocat' }))
        const session = await initial
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.hidden, false)
        assertEq(page.logout.hidden, true)
        assertEq(net.remaining(), 0)
        assertNoPersistedToken(page)
    },
    callbackKeepsLoginDisabledUntilTokenAndIdentityRequestsFinish: async () => {
        const stages = /** @type {const} */ (['token', 'user'])
        for (const stage of stages) {
            const page = returning()
            /** @type {(response: Response) => void} */
            let finish = () => {}
            /** @type {Promise<Response>} */
            const blocked = new Promise(resolve => { finish = resolve })
            /** @type {() => void} */
            let reached = () => {}
            /** @type {Promise<void>} */
            const requested = new Promise(resolve => { reached = resolve })
            const response = () => { reached(); return blocked }
            const responses = stage === 'token'
                ? [json(config), response]
                : [json(config), json(token), response]
            const net = queue(page, responses, true)
            const initial = startGitHubLogin(page.root, { fetch: net.fetch, now })
            await requested
            assertEq(page.login.disabled, true)
            assertEq(page.storage.get(pendingKey), undefined)
            await page.login.click()
            assertEq(page.redirects.length, 0)
            finish(new Response('', { status: 502 }))
            const session = await initial
            assertEq(session.token(), null)
            assertEq(page.login.disabled, false)
            assertLoggedOut(page)
            assertEq(net.remaining(), 0)
            assertNoPersistedToken(page)
        }
    },
    stateIsConsumedBeforeExchangeAndCannotBeReplayed: async () => {
        const page = returning()
        const net = queue(page, [json(config), () => {
            assertEq(page.storage.get(pendingKey), undefined)
            return json(token)
        }, json({ login: 'octocat' })], true)
        await startGitHubLogin(page.root, { fetch: net.fetch, now })
        const replay = returning(undefined, page.storage.get(pendingKey) ?? null)
        const retry = queue(replay, [json(config)], true)
        const session = await startGitHubLogin(replay.root, { fetch: retry.fetch, now })
        assertEq(session.token(), null)
        assert(retry.urls.every(url => url.pathname !== '/auth/github/token'))
        assertEq(replay.storage.get(pendingKey), undefined)
        assert(replay.note.textContent.length > 0)
    },
    rejectsMissingMismatchedAndDuplicateCallbackParameters: async () => {
        const cases = /** @type {const} */ ([
            'code=github-code&state=wrong-state',
            'code=github-code',
            'state=pending-state',
            'code=&state=pending-state',
            'code=github-code&state=',
            'code=github-code&code=other-code&state=pending-state',
            'code=github-code&state=pending-state&state=other-state',
        ])
        for (const query of cases) {
            const page = returning(query)
            const net = queue(page, [json(config)], true)
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assert(net.urls.every(url => url.pathname !== '/auth/github/token'))
            assertEq(page.storage.get(pendingKey), undefined)
            assertEq(page.current().href, `${callback}?keep=1#section`)
            assert(page.note.textContent.length > 0)
            assertNoPersistedToken(page)
        }
    },
    rejectsAbsentMalformedExpiredAndFuturePendingState: async () => {
        const cases = /** @type {const} */ ([
            null,
            '{',
            JSON.stringify({ ...pending, createdAt: now() - 600_001 }),
            JSON.stringify({ ...pending, createdAt: now() + 1 }),
            JSON.stringify({ ...pending, createdAt: 'today' }),
            JSON.stringify({ ...pending, verifier: 'short' }),
        ])
        for (const stored of cases) {
            const page = returning(undefined, stored)
            const net = queue(page, [json(config)], true)
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assert(net.urls.every(url => url.pathname !== '/auth/github/token'))
            assertEq(page.storage.get(pendingKey), undefined)
            assert(page.note.textContent.length > 0)
        }
    },
    acceptsPendingStateAtItsMaximumAge: async () => {
        const page = returning(undefined, JSON.stringify({ ...pending, createdAt: now() - 600_000 }))
        const net = queue(page, [json(config), json(token), json({ login: 'octocat' })], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), 'test-token')
        assertOctocat(page)
        assertNoPersistedToken(page)
        session.clear()
        assertEq(session.token(), null)
        assertLoggedOut(page)
    },
    cancellationNeverEchoesProviderDescriptions: async () => {
        const page = returning('error=access_denied&error_description=SENSITIVE_PROVIDER_DETAIL&state=pending-state')
        const net = queue(page, [json(config)], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assert(net.urls.every(url => url.pathname !== '/auth/github/token'))
        assertEq(page.storage.get(pendingKey), undefined)
        assertEq(page.current().href, `${callback}?keep=1#section`)
        assert(page.note.textContent.toLowerCase().includes('cancel'))
        assert(!page.note.textContent.includes('SENSITIVE_PROVIDER_DETAIL'))
    },
    configurationFailuresLeavePublicPageUsable: async () => {
        const cases = /** @type {const} */ ([
            () => Promise.reject(new TypeError('SENSITIVE_NETWORK_DETAIL')),
            new Response('', { status: 503 }),
            new Response('{'),
            json({ clientId: 123, redirectUri: callback }),
            json({ ...config, redirectUri: 'https://untrusted.invalid/prs/' }),
            json({ ...config, redirectUri: `${origin}/other/` }),
        ])
        for (const response of cases) {
            const page = dom()
            const net = queue(page, [response])
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assertEq(page.login.disabled, true)
            assertEq(page.storage.size, 0)
            assertEq(page.redirects.length, 0)
            assert(page.note.textContent.length > 0)
            assert(!page.note.textContent.includes('SENSITIVE_NETWORK_DETAIL'))
        }
    },
    tokenExchangeFailuresDoNotExposeCredentials: async () => {
        const cases = /** @type {const} */ ([
            () => Promise.reject(new TypeError('SENSITIVE_NETWORK_DETAIL')),
            new Response('', { status: 502 }),
            new Response('{'),
            json({ error: 'bad_verification_code', error_description: 'SENSITIVE_PROVIDER_DETAIL' }),
            json({ access_token: '', token_type: 'bearer' }),
            json({ access_token: 'test-token', token_type: 'unexpected' }),
        ])
        for (const response of cases) {
            const page = returning()
            const net = queue(page, [json(config), response], true)
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assertEq(page.storage.get(pendingKey), undefined)
            assert(net.urls.every(url => url.pathname !== '/user'))
            assert(page.note.textContent.length > 0)
            assert(!page.note.textContent.includes('SENSITIVE_NETWORK_DETAIL'))
            assert(!page.note.textContent.includes('SENSITIVE_PROVIDER_DETAIL'))
            assertNoPersistedToken(page)
        }
    },
    rejectedSiteCredentialsExplainTheExchangeFailureAndAllowRetry: async () => {
        const page = returning()
        const net = queue(page, [json(config), json({
            reason: 'incorrect_client_credentials',
            error_description: 'SENSITIVE_PROVIDER_DETAIL',
            access_token: 'test-token',
        }, 502)], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.disabled, false)
        assertEq(page.note.textContent,
            "GitHub rejected this site's credentials. Check the GitHub OAuth App configuration. (HTTP 502)")
        assertEq(page.storage.get(pendingKey), undefined)
        assert(net.urls.every(url => url.pathname !== '/user'))
        assertNoPersistedToken(page)

        await page.login.click()
        assertEq(page.redirects.length, 1)
        const redirect = new URL(page.redirects[0])
        assertEq(redirect.origin, 'https://github.com')
        assertEq(redirect.pathname, '/login/oauth/authorize')
        const saved = JSON.parse(page.storage.get(pendingKey))
        assertEq(redirect.searchParams.get('state'), saved.state)
        assert(saved.state !== pending.state)
        assertEq(net.remaining(), 0)

        const retry = returning(`code=retry-code&state=${saved.state}`, JSON.stringify(saved))
        const retryNet = queue(retry, [json(config), json(token), json({ login: 'octocat' })], true)
        const completed = await startGitHubLogin(retry.root, { fetch: retryNet.fetch, now })
        assertEq(completed.token(), 'test-token')
        assertOctocat(retry)
        assertEq(retryNet.remaining(), 0)
        assertNoPersistedToken(retry)
    },
    unexpectedScopeGivesFixedRevocationMessageAndAllowsRetry: async () => {
        const page = returning()
        const net = queue(page, [json(config), json({
            reason: 'unexpected_scope', scope: 'SENSITIVE_SCOPE_DETAILS',
            access_token: 'test-token', error_description: 'SENSITIVE_PROVIDER_DETAIL',
        }, 400)], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assertLoggedOut(page)
        assertEq(page.login.disabled, false)
        assertEq(page.note.textContent,
            'GitHub returned permissions this page does not need. Revoke this app in GitHub’s authorized OAuth apps, then log in again. (HTTP 400)')
        assert(!page.note.textContent.includes('SENSITIVE_SCOPE_DETAILS'))
        assert(!page.note.textContent.includes('SENSITIVE_PROVIDER_DETAIL'))
        assert(net.urls.every(url => url.pathname !== '/user'))
        assertNoPersistedToken(page)
        await page.login.click()
        assertEq(page.redirects.length, 1)
        const saved = JSON.parse(page.storage.get(pendingKey))
        assert(saved.state !== pending.state)
        const redirect = new URL(page.redirects[0])
        assertEq(redirect.origin, 'https://github.com')
        assertEq(redirect.searchParams.get('state'), saved.state)
        assertEq(net.remaining(), 0)
        const retry = returning(`code=retry-code&state=${saved.state}`, JSON.stringify(saved))
        const retryNet = queue(retry, [json(config), json(token), json({ login: 'octocat' })], true)
        const completed = await startGitHubLogin(retry.root, { fetch: retryNet.fetch, now })
        assertEq(completed.token(), 'test-token')
        assertOctocat(retry)
        assertEq(retryNet.remaining(), 0)
        assertNoPersistedToken(retry)
    },
    unknownOrMalformedExchangeFailuresExposeOnlyTheHttpStatus: async () => {
        const cases = /** @type {const} */ ([
            [json({ reason: 'SENSITIVE_PROVIDER_DETAIL', access_token: 'test-token' }, 502), 502],
            [json({ reason: 42, error_description: 'SENSITIVE_PROVIDER_DETAIL' }, 503), 503],
            [json({ error_description: 'SENSITIVE_PROVIDER_DETAIL' }, 429), 429],
            [json(['SENSITIVE_PROVIDER_DETAIL', 'test-token'], 500), 500],
            [new Response('SENSITIVE_PROVIDER_DETAIL test-token', { status: 502 }), 502],
            [new Response('{', { status: 503 }), 503],
        ])
        for (const [response, status] of cases) {
            const page = returning()
            const net = queue(page, [json(config), response], true)
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assertEq(page.note.textContent,
                `Could not exchange the GitHub login code. Please try again. (HTTP ${status})`)
            assertEq(page.login.disabled, false)
            assertEq(page.storage.get(pendingKey), undefined)
            assert(net.urls.every(url => url.pathname !== '/user'))
            assertEq(net.remaining(), 0)
            assertLoggedOut(page)
            assertNoPersistedToken(page)
        }
    },
    identityRefusalHasADistinctSafeMessageAndAllowsRetry: async () => {
        const page = returning()
        const net = queue(page, [json(config), json(token), json({
            message: 'SENSITIVE_IDENTITY_DETAIL',
            access_token: 'test-token',
        }, 401)], true)
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assertEq(page.note.textContent,
            'Could not verify your GitHub account. Please try again. (HTTP 401)')
        assertEq(page.login.disabled, false)
        assertLoggedOut(page)
        assertNoPersistedToken(page)
        await page.login.click()
        assertEq(page.redirects.length, 1)
        assertEq(new URL(page.redirects[0]).origin, 'https://github.com')
        assertEq(net.remaining(), 0)
    },
    unavailableConfigurationReportsOnlyItsStatus: async () => {
        const page = dom()
        const net = queue(page, [json({
            message: 'SENSITIVE_PROVIDER_DETAIL',
            access_token: 'test-token',
        }, 503)])
        const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
        assertEq(session.token(), null)
        assertEq(page.note.textContent, 'GitHub login is unavailable on this site. (HTTP 503)')
        assertEq(page.login.disabled, true)
        assertEq(page.redirects.length, 0)
        assertEq(net.remaining(), 0)
        assertLoggedOut(page)
        assertNoPersistedToken(page)
    },
    failedIdentityReadClearsTheUnverifiedToken: async () => {
        const cases = /** @type {const} */ ([
            () => Promise.reject(new TypeError('SENSITIVE_IDENTITY_DETAIL')),
            new Response('', { status: 401 }),
            new Response('{'),
            json({ login: 42 }),
        ])
        for (const response of cases) {
            const page = returning()
            const net = queue(page, [json(config), json(token), response], true)
            const session = await startGitHubLogin(page.root, { fetch: net.fetch, now })
            assertEq(session.token(), null)
            assert(!page.note.textContent.includes('SENSITIVE_IDENTITY_DETAIL'))
            assertLoggedOut(page)
            assertNoPersistedToken(page)
        }
    },
})
