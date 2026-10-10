/**
 * Browser boundary for the public pull-request page: fetch GitHub JSON,
 * admit it through the page's schemas, and render its FunctionalScript rows.
 *
 * The initial load runs once. Further loads require the Refresh button; the
 * request deadline never schedules a refresh, and failed requests are not retried.
 *
 * @import { ValidationError } from '../rtti/common/types.ts'
 * @import { Unknown } from '../rtti/ts/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { CheckLabel } from './prs/types.ts'
 */

import { toDom } from '../media/html/module.mjs'
import { parse } from '../rtti/parse/module.f.mjs'
import { checksSchema, checkSummary, pullsSchema, row, statusesSchema } from './prs/module.f.mjs'

const api = 'https://api.github.com/repos/functionalscript/functionalscript'
const maxPages = 10
const parsePulls = parse(pullsSchema)
const parseChecks = parse(checksSchema)
const parseStatuses = parse(statusesSchema)

/** @type {WeakMap<Element, Promise<void>>} */
const started = new WeakMap()

/** A host error's readable message, without exposing arbitrary thrown values. */
/** @type {(error: unknown) => string} */
const message = error => error instanceof Error
    ? error.message
    : 'GitHub is unavailable. Try Refresh again.'

/**
 * Read only the relation from GitHub's pagination header. Every request URL
 * is constructed locally; a Link URL is never followed.
 */
/** @type {(response: Response) => boolean} */
const hasNext = response => (response.headers.get('link') ?? '').split(',')
    .some(link => link.split(';').slice(1).some(part => part.trim() === 'rel="next"'))

/**
 * Explain a refusal and, when supplied, the time GitHub says to try again.
 * The user's browser supplies the locale and time zone for the displayed time.
 */
/** @type {(response: Response, now: () => number) => string} */
const refusal = (response, now) => {
    const retry = response.headers.get('retry-after')
    const reset = response.headers.get('x-ratelimit-reset')
    const limited = response.status === 429
        || response.headers.get('x-ratelimit-remaining') === '0'
        || retry !== null
    let after = NaN
    if (retry !== null) {
        const seconds = Number(retry)
        after = Number.isFinite(seconds) ? now() + seconds * 1000 : Date.parse(retry)
    } else if (limited && reset !== null) {
        after = Number(reset) * 1000
    }
    const reason = limited ? 'GitHub API rate limit reached.' : `GitHub request failed (HTTP ${response.status}).`
    return Number.isFinite(after) && after > now()
        ? `${reason} Try Refresh after ${new Date(after).toLocaleString()}.`
        : `${reason} Try Refresh again later.`
}

/**
 * Bind one page and perform its initial load. A duplicate call neither loads
 * again nor registers another listener. Optional host functions let the proof
 * drive actual Response JSON and a recording DOM without live API requests.
 *
 * A refresh replaces the list only after every pull-list page succeeds. CI
 * failures replace that row's result with Unavailable; a failed list refresh
 * keeps the previous rows and explicitly identifies them as stale.
 *
 * @type {(root: Element, host?: { readonly fetch?: typeof fetch, readonly now?: () => number }) => Promise<void>}
 */
export const startPrs = (root, host = {}) => {
    const existing = started.get(root)
    if (existing !== undefined) { return existing }
    const button = /** @type {HTMLButtonElement | null} */ (root.querySelector('[data-pr-refresh]'))
    const note = root.querySelector('[data-pr-note]')
    const rows = root.querySelector('[data-pr-rows]')
    if (button === null || note === null || rows === null) {
        return Promise.reject(new Error('Pull-request page is missing its controls.'))
    }
    const fetchRequest = host.fetch ?? globalThis.fetch
    const now = host.now ?? Date.now
    let busy = false
    let loaded = false

    const refresh = async () => {
        if (busy) { return }
        busy = true
        button.disabled = true
        root.setAttribute('aria-busy', 'true')
        note.textContent = loaded ? 'Refreshing pull requests and checks…' : 'Loading pull requests and checks…'
        // A rate-limit refusal stops all remaining requests in this load,
        // including the workers that have not started their next PR yet.
        /** @type {Error | null} */
        let blocked = null

        /**
         * Fetch and admit one response. JSON creates plain host data; parse
         * constructs only the fields the FunctionalScript model declares.
         *
         * @template Value
         * @param {string} path
         * @param {(value: Unknown) => Result<Value, ValidationError>} read
         * @returns {Promise<{ readonly value: Value, readonly next: boolean }>}
         */
        const request = async (path, read) => {
            if (blocked !== null) { throw blocked }
            let response
            try {
                response = await fetchRequest(`${api}/${path}`, {
                    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
                    credentials: 'omit',
                    cache: 'no-store',
                    redirect: 'error',
                    signal: AbortSignal.timeout(15_000),
                })
            } catch (error) {
                const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
                throw new Error(timedOut
                    ? 'The GitHub request timed out. Try Refresh again.'
                    : 'GitHub request failed. Check your connection and try Refresh again.')
            }
            if (!response.ok) {
                const error = new Error(refusal(response, now))
                if (response.status === 403 || response.status === 429) { blocked = error }
                throw error
            }
            let value
            try {
                value = await response.json()
            } catch {
                throw new Error('GitHub returned invalid JSON. Try Refresh again.')
            }
            const [tag, admitted] = read(value)
            if (tag === 'error') { throw new Error('GitHub returned an unsupported response. View the results on GitHub.') }
            return { value: admitted, next: hasNext(response) }
        }

        /**
         * Load a bounded set of locally numbered API pages. An endpoint's
         * total_count also catches GitHub's own check-run pagination limit.
         *
         * @template Value
         * @template Item
         * @param {string} path
         * @param {(value: Unknown) => Result<Value, ValidationError>} read
         * @param {(value: Value) => readonly Item[]} select
         * @param {(value: Value) => number | null} total
         * @returns {Promise<readonly Item[]>}
         */
        const pages = async (path, read, select, total) => {
            /** @type {Item[]} */
            const items = []
            for (let page = 1; page <= maxPages; page += 1) {
                const separator = path.includes('?') ? '&' : '?'
                const { value, next } = await request(`${path}${separator}per_page=100&page=${page}`, read)
                items.push(...select(value))
                if (!next) {
                    const count = total(value)
                    if (count !== null && items.length < count) {
                        throw new Error('GitHub returned an incomplete set of checks. View the checks on GitHub.')
                    }
                    return items
                }
            }
            throw new Error(`GitHub returned more than ${maxPages} pages. View the complete results on GitHub.`)
        }

        try {
            const pulls = await pages('pulls?state=open', parsePulls, value => value, () => null)
            const elements = pulls.map(pr => toDom(root.ownerDocument, row(pr, 'Loading')))
            rows.replaceChildren(...elements)
            root.removeAttribute('data-pr-stale')
            loaded = true
            let nextPull = 0
            let failures = 0
            let firstFailure = ''
            const worker = async () => {
                while (nextPull < pulls.length) {
                    const index = nextPull
                    nextPull += 1
                    const pr = pulls[index]
                    const sha = encodeURIComponent(pr.head.sha)
                    /** @type {CheckLabel} */
                    let label = 'Unavailable'
                    try {
                        const checks = await pages(`commits/${sha}/check-runs?filter=latest`, parseChecks,
                            value => value.check_runs, value => value.total_count)
                        const statuses = await pages(`commits/${sha}/status`, parseStatuses,
                            value => value.statuses, value => value.total_count)
                        label = checkSummary(checks, statuses)
                    } catch (error) {
                        failures += 1
                        if (firstFailure === '') { firstFailure = message(error) }
                    }
                    rows.replaceChild(toDom(root.ownerDocument, row(pr, label)), elements[index])
                }
            }
            await Promise.all(Array.from({ length: Math.min(3, pulls.length) }, worker))
            const count = pulls.length === 0 ? 'No open pull requests.' : `${pulls.length} open pull request${pulls.length === 1 ? '' : 's'}.`
            const partial = failures === 0 ? '' : ` Checks unavailable for ${failures} pull request${failures === 1 ? '' : 's'}. ${firstFailure}`
            note.textContent = `${count} Updated ${new Date(now()).toLocaleString()}.${partial}`
        } catch (error) {
            if (loaded) { root.setAttribute('data-pr-stale', '') }
            note.textContent = `${loaded ? 'Could not refresh. Showing previous results, which may be stale.' : 'Could not load pull requests.'} ${message(error)}`
        } finally {
            busy = false
            button.disabled = false
            root.removeAttribute('aria-busy')
        }
    }
    button.addEventListener('click', refresh)
    const initial = refresh()
    started.set(root, initial)
    return initial
}
