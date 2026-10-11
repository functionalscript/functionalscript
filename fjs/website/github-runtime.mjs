/**
 * GitHub login's browser boundary. Only the pending, single-use PKCE login
 * lives in sessionStorage; the access token stays in this page's memory.
 * GitHub API calls go directly to GitHub, never through a session backend.
 *
 * @import { Unknown } from '../rtti/ts/types.ts'
 * @import { ValidationError } from '../rtti/common/types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { parse } from '../rtti/parse/module.f.mjs'
import { configSchema, exchangeFailureMessage, exchangeFailureSchema, pendingSchema, tokenSchema, userSchema, validPending } from './github/module.f.mjs'

/** @type {string} */
const pendingKey = 'functionalscript.github.login'
const readConfig = parse(configSchema)
const readPending = parse(pendingSchema)
const readToken = parse(tokenSchema)
const readUser = parse(userSchema)
const readExchangeFailure = parse(exchangeFailureSchema)

/** @type {WeakMap<Element, Promise<{ readonly token: () => string | null, readonly clear: () => void }>>} */
const started = new WeakMap()

/**
 * Bind the page's login controls and consume an OAuth callback, if present.
 * Failure leaves the public PR list usable. A reload or navigation ends login.
 *
 * @type {(root: Element, host?: { readonly fetch?: typeof fetch, readonly now?: () => number }) => Promise<{ readonly token: () => string | null, readonly clear: () => void }>}
 */
export const startGitHubLogin = (root, host = {}) => {
    const existing = started.get(root)
    if (existing !== undefined) { return existing }
    const start = async () => {
        const view = root.ownerDocument.defaultView
        const login = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-github-login]'))
        const logout = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-github-logout]'))
        const account = root.querySelector('[data-github-account]')
        const userLink = /** @type {HTMLAnchorElement | null} */ (root.querySelector('[data-github-user]'))
        const note = root.querySelector('[data-github-note]')
        if (view === null || login === null || logout === null || account === null || userLink === null || note === null) {
            throw new Error('GitHub login is missing its browser controls.')
        }
        const fetchRequest = host.fetch ?? globalThis.fetch
        const now = host.now ?? Date.now
        /** @type {string | null} */
        let token = null
        let active = true
        let available = false
        const clear = () => {
            token = null
            login.disabled = !available
            logout.hidden = true
            login.hidden = false
            account.textContent = 'Not logged in to GitHub.'
            userLink.hidden = true
            userLink.removeAttribute('href')
            userLink.textContent = ''
            note.textContent = 'Logged out. Refresh to read public GitHub results.'
        }
        const auth = /** @type {const} */ ({ token: () => token, clear })
        login.disabled = true
        logout.hidden = true
        account.textContent = 'Not logged in to GitHub.'
        userLink.hidden = true
        logout.addEventListener('click', clear)
        // Back/forward caching must not preserve a login after leaving.
        // Restore the enabled login control before the browser caches the page.
        view.addEventListener('pagehide', () => { active = false; clear() })

        /**
         * Admission happens immediately after JSON crosses the host boundary.
         * Fixed errors keep provider bodies and credentials out of the page.
         *
         * @template Value
         * @param {string} url
         * @param {RequestInit} options
         * @param {(value: Unknown) => Result<Value, ValidationError>} read
         * @returns {Promise<Value>}
         */
        const request = async (url, options, read) => {
            const response = await fetchRequest(url, {
                ...options,
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'error',
                signal: AbortSignal.timeout(15_000),
            })
            if (!response.ok) {
                if (url === '/auth/github/token') {
                    try {
                        const [tag, rejected] = readExchangeFailure(await response.json())
                        if (tag === 'ok') { failure = exchangeFailureMessage(rejected.reason) }
                    } catch {
                        // Unrecognized or malformed bodies never become UI messages.
                    }
                }
                failure = `${failure} (HTTP ${response.status})`
                throw new Error('GitHub login request failed.')
            }
            const [tag, value] = read(await response.json())
            if (tag === 'error') { throw new Error('GitHub login response was invalid.') }
            return value
        }

        const url = new URL(view.location.href)
        const params = url.searchParams
        const callback = params.has('code') || params.has('state') || params.has('error')
        // Remove credentials before any asynchronous request or UI update.
        // The page's referrer meta also protects its initial subresource loads.
        if (callback) {
            const clean = new URL(url)
            for (const key of ['code', 'state', 'error', 'error_description', 'error_uri']) {
                clean.searchParams.delete(key)
            }
            view.history.replaceState(null, '', clean.href)
        }

        let failure = 'GitHub login is unavailable on this site.'
        try {
            // Consume a pending login even when GitHub declined authorization.
            const pendingText = callback ? view.sessionStorage.getItem(pendingKey) : null
            if (callback) { view.sessionStorage.removeItem(pendingKey) }
            const config = await request('/auth/github/config', {}, readConfig)
            const redirect = new URL(config.redirectUri)
            if (config.clientId === '' || redirect.href !== `${url.origin}/prs/`) {
                throw new Error('GitHub login configuration does not match this site.')
            }
            available = true
            login.disabled = false
            note.textContent = 'Log in to use your GitHub API rate limit.'

            /** Base64url is a host encoding; the randomness comes from Web Crypto. */
            /** @type {(bytes: Uint8Array) => string} */
            const base64url = bytes => view.btoa(String.fromCharCode(...bytes))
                .split('+').join('-').split('/').join('_').split('=').join('')

            login.addEventListener('click', async () => {
                if (login.disabled) { return }
                login.disabled = true
                note.textContent = 'Opening GitHub login…'
                try {
                    const state = base64url(view.crypto.getRandomValues(new Uint8Array(32)))
                    const verifier = base64url(view.crypto.getRandomValues(new Uint8Array(32)))
                    const challenge = base64url(new Uint8Array(await view.crypto.subtle.digest(
                        'SHA-256', new TextEncoder().encode(verifier))))
                    view.sessionStorage.setItem(pendingKey, JSON.stringify({ state, verifier, createdAt: now() }))
                    const authorize = new URL('https://github.com/login/oauth/authorize')
                    authorize.search = new URLSearchParams({
                        client_id: config.clientId,
                        redirect_uri: config.redirectUri,
                        prompt: 'select_account',
                        state,
                        code_challenge: challenge,
                        code_challenge_method: 'S256',
                    }).toString()
                    view.location.assign(authorize.href)
                } catch {
                    login.disabled = false
                    note.textContent = 'Could not open GitHub login. Allow browser session storage and try again.'
                }
            })

            if (!callback) { return auth }
            failure = 'GitHub login details could not be verified. Please log in again.'
            if (params.has('error')) {
                note.textContent = 'GitHub login was cancelled or denied. You can try again.'
                return auth
            }
            const [tag, pending] = readPending(JSON.parse(pendingText ?? 'null'))
            const codes = params.getAll('code')
            const states = params.getAll('state')
            if (tag === 'error' || codes.length !== 1 || codes[0] === ''
                || states.length !== 1 || !validPending(pending, states[0], now())) {
                note.textContent = 'GitHub login expired or could not be verified. Please log in again.'
                return auth
            }
            note.textContent = 'Completing GitHub login…'
            login.disabled = true
            failure = 'Could not exchange the GitHub login code. Please try again.'
            const result = await request('/auth/github/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codes[0], verifier: pending.verifier }),
            }, readToken)
            if (result.access_token === '') { throw new Error('GitHub returned no token.') }
            failure = 'Could not verify your GitHub account. Please try again.'
            const user = await request('https://api.github.com/user', {
                headers: {
                    Authorization: `Bearer ${result.access_token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            }, readUser)
            if (user.login === '') { throw new Error('GitHub returned no user.') }
            if (!active) { return auth }
            token = result.access_token
            login.hidden = true
            logout.hidden = false
            account.textContent = 'Logged in as'
            userLink.textContent = `@${user.login}`
            userLink.setAttribute('href', `https://github.com/${encodeURIComponent(user.login)}`)
            userLink.hidden = false
            note.textContent = 'Login lasts until you reload or leave this page.'
        } catch {
            note.textContent = failure
        } finally {
            login.disabled = !available
        }
        return auth
    }
    const initial = start()
    started.set(root, initial)
    return initial
}
