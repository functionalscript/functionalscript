/**
 * Pull-request loading decisions over ordinary immutable data. The browser
 * adapter performs the effects this policy describes: locally numbered pages,
 * bounded workers, refusal handling, and explicit stale or partial results.
 *
 * @module
 *
 * @import { Failures, ListFailure, PageStep, RefusalDecision, RefusalInput } from './types.ts'
 */

const maxPages = 10

/** Messages for failures observed at the host's JSON and admission boundary. */
export const responseMessages = /** @type {const} */ ({
    invalidJson: 'GitHub returned invalid JSON. Try Refresh again.',
    unsupported: 'GitHub returned an unsupported response. View the results on GitHub.',
})

/** An arbitrary thrown host value never supplies a provider-facing message. */
export const unavailableMessage = 'GitHub is unavailable. Try Refresh again.'

/** A failed check request replaces any previous summary with this label. */
export const unavailableLabel = 'Unavailable'

/** Every page URL is constructed locally; provider-supplied URLs are ignored. */
/** @type {(path: string, page: number) => string} */
export const pageRequest = (path, page) =>
    `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`

/**
 * Continue up to ten pages, or finish only when an advertised check count is
 * complete. A partial provider response is never reported as complete.
 *
 * @template Item
 * @param {number} page
 * @param {readonly Item[]} accumulated
 * @param {readonly Item[]} received
 * @param {boolean} next
 * @param {number | null} total
 * @returns {PageStep<Item>}
 */
export const pageStep = (page, accumulated, received, next, total) => {
    const items = [...accumulated, ...received]
    if (!next) {
        return total !== null && items.length < total
            ? { tag: 'error', message: 'GitHub returned an incomplete set of checks. View the checks on GitHub.' }
            : { tag: 'done', items }
    }
    return page < maxPages
        ? { tag: 'next', page: page + 1, items }
        : { tag: 'error', message: `GitHub returned more than ${maxPages} pages. View the complete results on GitHub.` }
}

/** Read only pagination's next relation, never its URL. */
/** @type {(header: string | null) => boolean} */
export const hasNextLink = header => (header ?? '').split(',')
    .some(link => link.split(';').slice(1).some(part => part.trim() === 'rel="next"'))

/**
 * Whether a number is finite: not `NaN`, which alone is unequal to itself,
 * and neither infinity. `Number.isFinite` spelled with the operators, which
 * the compiler accepts where the namespace member is not admitted yet.
 *
 * @type {(n: number) => boolean}
 */
const isFinite = n => n === n && n !== Infinity && n !== -Infinity

/**
 * Interpret refusal headers without consulting a clock or parsing a date.
 * A finite future Retry-After time wins over the primary rate-limit reset.
 *
 * @type {(input: RefusalInput) => RefusalDecision}
 */
export const refusalDecision = input => {
    const status = input.status
    const retryAfter = input.retryAfter
    const now = input.now
    const limited = status === 429 || input.remaining === '0' || retryAfter !== null
    const seconds = Number(retryAfter)
    const after = retryAfter !== null
        ? isFinite(seconds) ? now + seconds * 1000 : input.retryDateMillis
        : limited && input.reset !== null ? Number(input.reset) * 1000 : null
    return {
        blocked: status === 401 || status === 403 || status === 429,
        reason: limited ? 'GitHub API rate limit reached.' : `GitHub request failed (HTTP ${status}).`,
        retryAt: after !== null && isFinite(after) && after > now ? after : null,
    }
}

/** The host supplies the user's locale-formatted future retry time. */
/** @type {(decision: RefusalDecision, formattedRetry: string) => string} */
export const refusalNote = (decision, formattedRetry) => decision.retryAt === null
    ? `${decision.reason} Try Refresh again later.`
    : `${decision.reason} Try Refresh after ${formattedRetry}.`

/** No requests for an empty list, at most three concurrent check workers. */
/** @type {(pullCount: number) => number} */
export const workerCount = pullCount => pullCount < 3 ? pullCount : 3

/** A busy load refuses another start, including repeated button clicks. */
/** @type {(busy: boolean, loaded: boolean) => string | null} */
export const refreshStart = (busy, loaded) => busy ? null : loaded
    ? 'Refreshing pull requests and checks…'
    : 'Loading pull requests and checks…'

/** Count unavailable CI summaries and keep the first readable explanation. */
/** @type {(previous: Failures, message: string) => Failures} */
export const checkFailure = (previous, message) => ({
    count: previous.count + 1,
    first: previous.first === '' ? message : previous.first,
})

/** Complete and partial CI loads both name the time supplied by the host. */
/** @type {(pullCount: number, failures: Failures, formattedTime: string) => string} */
export const finishedNote = (pullCount, failures, formattedTime) => {
    const count = failures.count
    const first = failures.first
    const pulls = pullCount === 0 ? 'No open pull requests.'
        : `${pullCount} open pull request${pullCount === 1 ? '' : 's'}.`
    const partial = count === 0 ? ''
        : ` Checks unavailable for ${count} pull request${count === 1 ? '' : 's'}. ${first}`
    return `${pulls} Updated ${formattedTime}.${partial}`
}

/** Preserve a previous list and identify it as stale after a failed refresh. */
/** @type {(loaded: boolean, message: string) => ListFailure} */
export const listFailure = (loaded, message) => ({
    stale: loaded,
    note: `${loaded ? 'Could not refresh. Showing previous results, which may be stale.' : 'Could not load pull requests.'} ${message}`,
})

/** Explain transport failure without automatically retrying the request. */
/** @type {(timedOut: boolean) => string} */
export const transportFailure = timedOut => timedOut
    ? 'The GitHub request timed out. Try Refresh again.'
    : 'GitHub request failed. Check your connection and try Refresh again.'
