/**
 * Page bounds, refusal policy, worker limits, and visible load information are
 * ordinary-data decisions. No host clock, fetch, DOM, or scheduler is needed.
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import {
    checkFailure, finishedNote, hasNextLink, listFailure, pageRequest, pageStep,
    refusalDecision, refusalNote, refreshStart, responseMessages, transportFailure,
    unavailableLabel, unavailableMessage, workerCount,
} from './module.f.mjs'

const ordinary = /** @type {const} */ ({
    status: 500,
    remaining: null,
    retryAfter: null,
    reset: null,
    now: 10_000,
    retryDateMillis: null,
})

const noFailures = /** @type {const} */ ({ count: 0, first: '' })

export const proof = {
    responseMessages: () => assertStructurallySame(responseMessages, {
        invalidJson: 'GitHub returned invalid JSON. Try Refresh again.',
        unsupported: 'GitHub returned an unsupported response. View the results on GitHub.',
    }),
    unavailableMessage: () => assertEq(unavailableMessage, 'GitHub is unavailable. Try Refresh again.'),
    unavailableLabel: () => assertEq(unavailableLabel, 'Unavailable'),
    pageRequest: {
        plain: () => assertEq(pageRequest('commits/abc/status', 2), 'commits/abc/status?per_page=100&page=2'),
        query: () => assertEq(pageRequest('pulls?state=open', 1), 'pulls?state=open&per_page=100&page=1'),
    },
    pageStep: {
        nextPage: () => assertStructurallySame(pageStep(1, [1], [2], true, null),
            { tag: 'next', page: 2, items: [1, 2] }),
        lastAllowedPage: () => assertStructurallySame(pageStep(9, [1], [2], true, 2),
            { tag: 'next', page: 10, items: [1, 2] }),
        completeUncounted: () => assertStructurallySame(pageStep(2, [1], [2], false, null),
            { tag: 'done', items: [1, 2] }),
        completeCounted: () => assertStructurallySame(pageStep(10, [1], [2], false, 2),
            { tag: 'done', items: [1, 2] }),
        empty: () => assertStructurallySame(pageStep(1, [], [], false, 0),
            { tag: 'done', items: [] }),
        incomplete: () => assertStructurallySame(pageStep(1, [1], [2], false, 3), {
            tag: 'error', message: 'GitHub returned an incomplete set of checks. View the checks on GitHub.',
        }),
        tooManyPages: () => assertStructurallySame(pageStep(10, [1], [2], true, null), {
            tag: 'error', message: 'GitHub returned more than 10 pages. View the complete results on GitHub.',
        }),
        nextDespiteCount: () => assertStructurallySame(pageStep(1, [], [1], true, 1),
            { tag: 'next', page: 2, items: [1] }),
        inputsUnchanged: () => {
            const accumulated = [1]
            const received = [2]
            assertStructurallySame(pageStep(1, accumulated, received, false, 2),
                { tag: 'done', items: [1, 2] })
            assertStructurallySame(accumulated, [1])
            assertStructurallySame(received, [2])
        },
    },
    hasNextLink: {
        absent: () => assertEq(hasNextLink(null), false),
        empty: () => assertEq(hasNextLink(''), false),
        noRelation: () => assertEq(hasNextLink('<https://provider.test/next>'), false),
        previous: () => assertEq(hasNextLink('<https://provider.test/>; rel="prev"'), false),
        next: () => assertEq(hasNextLink('<https://provider.test/anything>; rel="next"'), true),
        multiple: () => assertEq(hasNextLink('<https://provider.test/1>; rel="prev", <https://untrusted.test/2>; type="json"; rel="next"'), true),
        urlCannotActAsRelation: () => assertEq(hasNextLink('rel="next"; rel="last"'), false),
    },
    refusalDecision: {
        ordinaryFailure: () => assertStructurallySame(refusalDecision(ordinary), {
            blocked: false, reason: 'GitHub request failed (HTTP 500).', retryAt: null,
        }),
        unauthorized: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 401 }), {
            blocked: true, reason: 'GitHub request failed (HTTP 401).', retryAt: null,
        }),
        forbidden: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 403 }), {
            blocked: true, reason: 'GitHub request failed (HTTP 403).', retryAt: null,
        }),
        tooManyRequests: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 429 }), {
            blocked: true, reason: 'GitHub API rate limit reached.', retryAt: null,
        }),
        exhaustedRemaining: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 403, remaining: '0' }), {
            blocked: true, reason: 'GitHub API rate limit reached.', retryAt: null,
        }),
        numericRetryAfter: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 403, retryAfter: '3', reset: '30' }), {
            blocked: true, reason: 'GitHub API rate limit reached.', retryAt: 13_000,
        }),
        parsedDateRetryAfter: () => assertStructurallySame(refusalDecision({ ...ordinary, retryAfter: 'host-parsed date', retryDateMillis: 12_000 }), {
            blocked: false, reason: 'GitHub API rate limit reached.', retryAt: 12_000,
        }),
        invalidDateRetryAfter: () => assertEq(refusalDecision({ ...ordinary, retryAfter: 'invalid date' }).retryAt, null),
        nonfiniteParsedDate: () => assertEq(refusalDecision({ ...ordinary, retryAfter: 'invalid date', retryDateMillis: NaN }).retryAt, null),
        infiniteParsedDate: () => assertEq(refusalDecision({ ...ordinary, retryAfter: 'invalid date', retryDateMillis: Infinity }).retryAt, null),
        expiredParsedDate: () => assertEq(refusalDecision({ ...ordinary, retryAfter: 'host-parsed date', retryDateMillis: 9000 }).retryAt, null),
        immediateRetry: () => assertEq(refusalDecision({ ...ordinary, retryAfter: '0' }).retryAt, null),
        negativeRetry: () => assertEq(refusalDecision({ ...ordinary, retryAfter: '-1' }).retryAt, null),
        numericOverflow: () => assertEq(refusalDecision({ ...ordinary, retryAfter: '1e308' }).retryAt, null),
        rateLimitReset: () => assertStructurallySame(refusalDecision({ ...ordinary, status: 429, reset: '30' }), {
            blocked: true, reason: 'GitHub API rate limit reached.', retryAt: 30_000,
        }),
        expiredReset: () => assertEq(refusalDecision({ ...ordinary, status: 429, reset: '9' }).retryAt, null),
        invalidReset: () => assertEq(refusalDecision({ ...ordinary, status: 429, reset: 'invalid' }).retryAt, null),
        infiniteReset: () => assertEq(refusalDecision({ ...ordinary, status: 429, reset: 'Infinity' }).retryAt, null),
        resetWithoutRateLimit: () => assertStructurallySame(refusalDecision({ ...ordinary, reset: '30' }), {
            blocked: false, reason: 'GitHub request failed (HTTP 500).', retryAt: null,
        }),
    },
    refusalNote: {
        noRetryTime: () => assertEq(refusalNote(refusalDecision(ordinary), ''),
            'GitHub request failed (HTTP 500). Try Refresh again later.'),
        futureRetry: () => assertEq(refusalNote(refusalDecision({ ...ordinary, status: 429, reset: '30' }), 'host-formatted time'),
            'GitHub API rate limit reached. Try Refresh after host-formatted time.'),
    },
    workerCount: () => {
        assertEq(workerCount(0), 0)
        assertEq(workerCount(1), 1)
        assertEq(workerCount(2), 2)
        assertEq(workerCount(3), 3)
        assertEq(workerCount(100), 3)
    },
    refreshStart: () => {
        assertEq(refreshStart(true, false), null)
        assertEq(refreshStart(true, true), null)
        assertEq(refreshStart(false, false), 'Loading pull requests and checks…')
        assertEq(refreshStart(false, true), 'Refreshing pull requests and checks…')
    },
    checkFailure: () => {
        const first = checkFailure(noFailures, 'first reason')
        assertStructurallySame(first, { count: 1, first: 'first reason' })
        assertStructurallySame(checkFailure(first, 'second reason'), { count: 2, first: 'first reason' })
        assertStructurallySame(noFailures, { count: 0, first: '' })
    },
    finishedNote: {
        empty: () => assertEq(finishedNote(0, noFailures, 'time'), 'No open pull requests. Updated time.'),
        one: () => assertEq(finishedNote(1, noFailures, 'time'), '1 open pull request. Updated time.'),
        many: () => assertEq(finishedNote(3, noFailures, 'time'), '3 open pull requests. Updated time.'),
        oneUnavailable: () => assertEq(finishedNote(2, { count: 1, first: 'reason' }, 'time'),
            '2 open pull requests. Updated time. Checks unavailable for 1 pull request. reason'),
        multipleUnavailable: () => assertEq(finishedNote(2, { count: 2, first: 'reason' }, 'time'),
            '2 open pull requests. Updated time. Checks unavailable for 2 pull requests. reason'),
    },
    listFailure: {
        initial: () => assertStructurallySame(listFailure(false, 'reason'), {
            stale: false, note: 'Could not load pull requests. reason',
        }),
        stale: () => assertStructurallySame(listFailure(true, 'reason'), {
            stale: true, note: 'Could not refresh. Showing previous results, which may be stale. reason',
        }),
    },
    transportFailure: () => {
        assertEq(transportFailure(true), 'The GitHub request timed out. Try Refresh again.')
        assertEq(transportFailure(false), 'GitHub request failed. Check your connection and try Refresh again.')
    },
}
