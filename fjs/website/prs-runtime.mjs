/**
 * Browser boundary for the public pull-request page: fetch GitHub JSON,
 * admit it through the page's schemas, and render its FunctionalScript rows.
 * Loading limits and feedback come from the pure prs/load policy; this
 * adapter drives requests, listeners, clocks and DOM updates.
 *
 * The initial load runs once. Further loads require the Refresh button; the
 * request deadline never schedules a refresh, and failed requests are not retried.
 *
 * @import { ValidationError } from '../rtti/common/types.ts'
 * @import { Unknown } from '../rtti/ts/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { CheckLabel } from './prs/types.ts'
 * @import { Failures } from './prs/load/types.ts'
 */

import { toDom } from '../media/html/module.mjs'
import { parse } from '../rtti/parse/module.f.mjs'
import { checksSchema, checkSummary, pullsSchema, row, statusesSchema } from './prs/module.f.mjs'
import { checkFailure, finishedNote, hasNextLink, listFailure, pageRequest, pageStep, refreshStart, refusalDecision, refusalNote, responseMessages, transportFailure, unavailableLabel, unavailableMessage, workerCount } from './prs/load/module.f.mjs'

const api = 'https://api.github.com/repos/functionalscript/functionalscript'
const parsePulls = parse(pullsSchema)
const parseChecks = parse(checksSchema)
const parseStatuses = parse(statusesSchema)

/** @type {WeakMap<Element, Promise<void>>} */
const started = new WeakMap()

/** A host error's readable message, without exposing arbitrary thrown values. */
/** @type {(error: unknown) => string} */
const message = error => error instanceof Error
    ? error.message
    : unavailableMessage

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
        const loadingNote = refreshStart(busy, loaded)
        if (loadingNote === null) { return }
        busy = true
        button.disabled = true
        root.setAttribute('aria-busy', 'true')
        note.textContent = loadingNote
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
                throw new Error(transportFailure(timedOut))
            }
            if (!response.ok) {
                const retryAfter = response.headers.get('retry-after')
                const decision = refusalDecision({
                    status: response.status,
                    remaining: response.headers.get('x-ratelimit-remaining'),
                    retryAfter,
                    reset: response.headers.get('x-ratelimit-reset'),
                    now: now(),
                    retryDateMillis: retryAfter === null ? null : Date.parse(retryAfter),
                })
                const formattedRetry = decision.retryAt === null ? '' : new Date(decision.retryAt).toLocaleString()
                const error = new Error(refusalNote(decision, formattedRetry))
                if (decision.blocked) { blocked = error }
                throw error
            }
            let value
            try {
                value = await response.json()
            } catch {
                throw new Error(responseMessages.invalidJson)
            }
            const [tag, admitted] = read(value)
            if (tag === 'error') { throw new Error(responseMessages.unsupported) }
            return { value: admitted, next: hasNextLink(response.headers.get('link')) }
        }

        /**
         * Drive pure paging decisions against actual responses. Each decision
         * supplies another locally numbered page, a complete result, or a refusal.
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
            /** @type {readonly Item[]} */
            let items = []
            let page = 1
            while (true) {
                const { value, next } = await request(pageRequest(path, page), read)
                const decision = pageStep(page, items, select(value), next, total(value))
                if (decision.tag === 'error') { throw new Error(decision.message) }
                if (decision.tag === 'done') { return decision.items }
                items = decision.items
                page = decision.page
            }
        }

        try {
            const pulls = await pages('pulls?state=open', parsePulls, value => value, () => null)
            const elements = pulls.map(pr => toDom(root.ownerDocument, row(pr, 'Loading')))
            rows.replaceChildren(...elements)
            root.removeAttribute('data-pr-stale')
            loaded = true
            let nextPull = 0
            /** @type {Failures} */
            let failures = { count: 0, first: '' }
            const worker = async () => {
                while (nextPull < pulls.length) {
                    const index = nextPull
                    nextPull += 1
                    const pr = pulls[index]
                    const sha = encodeURIComponent(pr.head.sha)
                    /** @type {CheckLabel} */
                    let label = unavailableLabel
                    try {
                        const checks = await pages(`commits/${sha}/check-runs?filter=latest`, parseChecks,
                            value => value.check_runs, value => value.total_count)
                        const statuses = await pages(`commits/${sha}/status`, parseStatuses,
                            value => value.statuses, value => value.total_count)
                        label = checkSummary(checks, statuses)
                    } catch (error) {
                        failures = checkFailure(failures, message(error))
                    }
                    rows.replaceChild(toDom(root.ownerDocument, row(pr, label)), elements[index])
                }
            }
            await Promise.all(Array.from({ length: workerCount(pulls.length) }, worker))
            note.textContent = finishedNote(pulls.length, failures, new Date(now()).toLocaleString())
        } catch (error) {
            const failure = listFailure(loaded, message(error))
            if (failure.stale) { root.setAttribute('data-pr-stale', '') }
            note.textContent = failure.note
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
