/**
 * Host proofs for the PR page's requested browser boundary: actual Response
 * JSON, fetch failures and pagination, DOM rendering, and manual button events.
 * FunctionalScript cannot fetch, await a response, or observe a DOM listener.
 * The recording document implements only the operations this adapter uses.
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { startPrs } from './prs-runtime.mjs'

/** A recording HTML document, with one manually activated Refresh button. */
/** @type {() => any} */
const dom = () => {
    /** @type {(() => Promise<void>)[]} */
    const listeners = []
    /** @type {(value: string) => any} */
    const text = value => ({ nodeType: 3, data: value, textContent: value })
    /** @type {any} */
    const document = {
        createTextNode: text,
        createElementNS: (/** @type {string} */ namespaceURI, /** @type {string} */ tag) => element(tag, namespaceURI),
        defaultView: {
            setTimeout: () => { throw new Error('A PR refresh must not be scheduled by a timer.') },
            setInterval: () => { throw new Error('A PR refresh must not be scheduled by a timer.') },
        },
    }
    /** @type {(tag: string, namespaceURI?: string) => any} */
    const element = (tag, namespaceURI = 'http://www.w3.org/1999/xhtml') => {
        /** @type {any[]} */
        let children = []
        /** @type {Map<string, string>} */
        const attributes = new Map()
        /** @type {any} */
        const self = {
            nodeType: 1,
            localName: tag,
            namespaceURI,
            ownerDocument: document,
            disabled: false,
            get childNodes() { return children },
            get textContent() { return children.map(c => c.textContent).join('') },
            set textContent(/** @type {string} */ value) { children = [text(value)] },
            set innerHTML(/** @type {string} */ _) { throw new Error('PR data must be rendered as nodes, not parsed markup.') },
            getAttribute: (/** @type {string} */ name) => attributes.get(name) ?? null,
            setAttribute: (/** @type {string} */ name, /** @type {string} */ value) => { attributes.set(name, value) },
            removeAttribute: (/** @type {string} */ name) => { attributes.delete(name) },
            appendChild: (/** @type {any} */ child) => { children.push(child); return child },
            replaceChildren: (/** @type {any[]} */ ...nodes) => {
                children = nodes.map(node => typeof node === 'string' ? text(node) : node)
            },
            replaceChild: (/** @type {any} */ next, /** @type {any} */ previous) => {
                assert(children.includes(previous))
                children = children.map(c => c === previous ? next : c)
            },
            addEventListener: (/** @type {string} */ kind, /** @type {() => Promise<void>} */ listener) => {
                assertEq(kind, 'click')
                listeners.push(listener)
            },
        }
        return self
    }
    const button = element('button')
    const note = element('p')
    const rows = element('tbody')
    const root = element('section')
    root.querySelector = (/** @type {string} */ selector) => {
        if (selector === '[data-pr-refresh]') { return button }
        if (selector === '[data-pr-note]') { return note }
        if (selector === '[data-pr-rows]') { return rows }
        return null
    }
    return { root, button, note, rows, listeners, click: () => Promise.all(listeners.map(f => f())) }
}

/** Real JSON responses exercise the admission boundary, including extra API fields. */
/** @type {(value: unknown, headers?: Record<string, string>) => Response} */
const json = (value, headers = {}) => new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json', ...headers },
})

/** @type {(number: number, draft?: boolean, author?: string) => unknown} */
const pull = (number, draft = false, author = 'octocat') => ({
    number, draft, user: { login: author, id: 42 }, head: { sha: `sha-${number}` }, title: 'An unused API field',
})

const passed = { total_count: 1, check_runs: [{ status: 'completed', conclusion: 'success' }] }
const failed = { total_count: 1, check_runs: [{ status: 'completed', conclusion: 'failure' }] }
const noStatuses = { total_count: 0, statuses: [] }
const now = () => Date.UTC(2026, 9, 10, 12)

/** A strict response queue records every URL and rejects unexpected extra requests. */
/** @type {(responses: readonly (Response | (() => Response | Promise<Response>))[]) => { readonly fetch: typeof fetch, readonly urls: string[], readonly options: (RequestInit | undefined)[], readonly remaining: () => number }} */
const queue = responses => {
    const urls = /** @type {string[]} */ ([])
    const options = /** @type {(RequestInit | undefined)[]} */ ([])
    let next = 0
    const fetch = /** @type {typeof globalThis.fetch} */ (async (input, init) => {
        urls.push(String(input))
        options.push(init)
        assert(next < responses.length, 'unexpected GitHub request')
        const response = responses[next]
        next += 1
        return typeof response === 'function' ? response() : response
    })
    return { fetch, urls, options, remaining: () => responses.length - next }
}

/** All generated anchor nodes, so the proof reads actual attributes and text nodes. */
/** @type {(node: any) => readonly any[]} */
const anchors = node => node.nodeType === 3 ? []
    : [...(node.localName === 'a' ? [node] : []), ...node.childNodes.flatMap(anchors)]

export const proof = {
    initialLoadAndManualRefresh: async () => {
        const page = dom()
        const net = queue([
            json([pull(42, false, '<script>alert(1)</script>')]), json(passed), json(noStatuses),
            json([pull(42, true, '<script>alert(1)</script>')]), json(failed), json(noStatuses),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        assertEq(page.rows.childNodes.length, 1)
        assert(page.rows.textContent.includes('Open'))
        assert(page.rows.textContent.includes('Passing'))
        assert(page.rows.textContent.includes('<script>alert(1)</script>'))
        const links = anchors(page.rows)
        assert(links.some(a => a.getAttribute('href') === 'https://github.com/functionalscript/functionalscript/pull/42'))
        assert(links.some(a => a.getAttribute('href') === 'https://github.com/%3Cscript%3Ealert(1)%3C%2Fscript%3E'))
        assertEq(page.listeners.length, 1)
        await startPrs(page.root, { fetch: net.fetch, now })
        await Promise.resolve()
        assertEq(net.urls.length, 3)
        assertEq(page.listeners.length, 1)
        await page.click()
        assert(page.rows.textContent.includes('Draft'))
        assert(page.rows.textContent.includes('Failing'))
        assertEq(net.urls.length, 6)
        assertEq(net.remaining(), 0)
        assertEq(page.button.disabled, false)
        for (const options of net.options) {
            assertEq(options?.credentials, 'omit')
            assertEq(options?.cache, 'no-store')
            assert(options?.signal instanceof AbortSignal)
            assertEq(new Headers(options?.headers).get('Authorization'), null)
        }
    },
    ignoresClicksDuringLoad: async () => {
        const page = dom()
        /** @type {(value: Response) => void} */
        let resolve = () => {}
        const waiting = new Promise((/** @type {(value: Response) => void} */ done) => { resolve = done })
        const net = queue([() => waiting])
        const initial = startPrs(page.root, { fetch: net.fetch, now })
        assertEq(page.button.disabled, true)
        assertEq(page.root.getAttribute('aria-busy'), 'true')
        await page.click()
        assertEq(net.urls.length, 1)
        resolve(json([]))
        await initial
        assertEq(page.rows.childNodes.length, 0)
        assert(page.note.textContent.includes('No open pull requests'))
        assertEq(page.button.disabled, false)
        assertEq(page.root.getAttribute('aria-busy'), null)
    },
    paginatesLocallyConstructedUrls: async () => {
        const page = dom()
        const next = { Link: '<https://malicious.invalid/never-fetch>; rel="next"' }
        const net = queue([
            json([pull(1)], next), json([pull(2)]),
            json(passed, next), json(passed),
            json(passed), json(noStatuses), json(noStatuses),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        assertEq(page.rows.childNodes.length, 2)
        assert(page.rows.childNodes.every((/** @type {any} */ r) => r.textContent.includes('Passing')))
        assert(net.urls.every(url => url.startsWith('https://api.github.com/repos/functionalscript/functionalscript/')))
        assert(net.urls.includes('https://api.github.com/repos/functionalscript/functionalscript/pulls?state=open&per_page=100&page=2'))
        assert(net.urls.some(url => url.includes('/check-runs?filter=latest&per_page=100&page=2')))
        assertEq(net.remaining(), 0)
    },
    includesLaterStatusPagesInTheSummary: async () => {
        const page = dom()
        const net = queue([
            json([pull(9)]), json(passed),
            json({ total_count: 2, statuses: [{ state: 'success' }] }, {
                Link: '<https://malicious.invalid/never-fetch>; rel="next"',
            }),
            json({ total_count: 2, statuses: [{ state: 'failure' }] }),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        assert(page.rows.textContent.includes('Failing'))
        assertEq(net.urls[3], 'https://api.github.com/repos/functionalscript/functionalscript/commits/sha-9/status?per_page=100&page=2')
        assertEq(net.remaining(), 0)
    },
    listFailureKeepsExplicitlyStaleRows: async () => {
        const page = dom()
        const net = queue([
            json([pull(5)]), json(passed), json(noStatuses), new Response('', { status: 500 }),
            json([pull(6)]), json(passed), json(noStatuses),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        const previous = page.rows.childNodes[0]
        await page.click()
        assertEq(page.rows.childNodes[0], previous)
        assertEq(page.root.getAttribute('data-pr-stale'), '')
        assert(page.note.textContent.includes('previous results, which may be stale'))
        assert(page.note.textContent.includes('HTTP 500'))
        assertEq(page.button.disabled, false)
        await page.click()
        assertEq(page.root.getAttribute('data-pr-stale'), null)
        assert(page.rows.textContent.includes('#6'))
        assertEq(net.remaining(), 0)
    },
    checkFailureReplacesPreviousPassingResult: async () => {
        const page = dom()
        const net = queue([
            json([pull(5)]), json(passed), json(noStatuses), json([pull(5)]),
            json(passed), new Response('', { status: 502 }),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        await page.click()
        assert(page.rows.textContent.includes('Unavailable'))
        assert(!page.rows.textContent.includes('Passing'))
        assert(page.note.textContent.includes('Checks unavailable for 1 pull request'))
        assert(page.note.textContent.includes('HTTP 502'))
        assertEq(net.remaining(), 0)
    },
    rateLimitStopsFurtherRequests: async () => {
        const page = dom()
        const limit = new Response('', {
            status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' },
        })
        // Three workers can already be in flight when the first refusal
        // arrives. The fourth PR and all status requests must stay unstarted.
        const net = queue([json([pull(1), pull(2), pull(3), pull(4)]), limit,
            new Response('', { status: 429 }), new Response('', { status: 429 })])
        await startPrs(page.root, { fetch: net.fetch, now })
        assertEq(net.urls.length, 4)
        assert(!net.urls.some(url => url.includes('sha-4') || url.includes('/status?')))
        assert(page.rows.childNodes.every((/** @type {any} */ r) => r.textContent.includes('Unavailable')))
        assert(page.note.textContent.includes('GitHub API rate limit reached'))
        assert(page.note.textContent.includes('Try Refresh after'))
        assertEq(page.button.disabled, false)
    },
    dateRetryAfterUsesBrowserFormatting: async () => {
        const page = dom()
        const retryAt = now() + 60_000
        const net = queue([new Response('', {
            status: 429, headers: { 'Retry-After': new Date(retryAt).toUTCString() },
        })])
        await startPrs(page.root, { fetch: net.fetch, now })
        assert(page.note.textContent.includes(`Try Refresh after ${new Date(retryAt).toLocaleString()}.`))
        assertEq(net.urls.length, 1)
        assertEq(page.button.disabled, false)
    },
    manualRefreshRecoversFromRateLimit: async () => {
        const page = dom()
        const net = queue([
            json([pull(5)]), new Response('', { status: 429 }),
            json([pull(6)]), json(passed), json(noStatuses),
        ])
        await startPrs(page.root, { fetch: net.fetch, now })
        assert(page.rows.textContent.includes('Unavailable'))
        await page.click()
        assert(page.rows.textContent.includes('#6'))
        assert(page.rows.textContent.includes('Passing'))
        assert(!page.note.textContent.includes('Checks unavailable'))
        assertEq(net.remaining(), 0)
        assertEq(page.button.disabled, false)
    },
    boundsListPagination: async () => {
        const page = dom()
        const net = queue(Array.from({ length: 10 }, () => json([pull(1)], { Link: '<https://api.github.com/anything>; rel="next"' })))
        await startPrs(page.root, { fetch: net.fetch, now })
        assertEq(net.urls.length, 10)
        assertEq(page.rows.childNodes.length, 0)
        assert(page.note.textContent.includes('more than 10 pages'))
        assertEq(page.button.disabled, false)
    },
    refusesIncompleteChecks: async () => {
        const page = dom()
        const net = queue([json([pull(8)]), json({ ...passed, total_count: 101 })])
        await startPrs(page.root, { fetch: net.fetch, now })
        assert(page.rows.textContent.includes('Unavailable'))
        assert(page.note.textContent.includes('incomplete set of checks'))
        assertEq(net.urls.length, 2)
    },
    boundsConcurrentCheckRequests: async () => {
        const page = dom()
        let active = 0
        let maximum = 0
        const fetch = /** @type {typeof globalThis.fetch} */ (async input => {
            const url = String(input)
            if (url.includes('/pulls?')) { return json([pull(1), pull(2), pull(3), pull(4), pull(5)]) }
            active += 1
            maximum = Math.max(maximum, active)
            await Promise.resolve()
            active -= 1
            return url.includes('/check-runs?') ? json(passed) : json(noStatuses)
        })
        await startPrs(page.root, { fetch, now })
        assertEq(maximum, 3)
        assertEq(active, 0)
        assertEq(page.rows.childNodes.length, 5)
        assert(page.rows.childNodes.every((/** @type {any} */ r) => r.textContent.includes('Passing')))
    },
    networkAndAdmissionFailuresRemainVisible: async () => {
        const cases = [
            { response: () => Promise.reject(new TypeError('fetch failed')), text: 'Check your connection' },
            { response: () => Promise.reject(new DOMException('deadline', 'TimeoutError')), text: 'timed out' },
            { response: new Response('{'), text: 'invalid JSON' },
            { response: json([{ number: 'wrong type' }]), text: 'unsupported response' },
            { response: new Response('', { status: 403, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(now() / 1000 + 60) } }), text: 'Try Refresh after' },
        ]
        for (const { response, text } of cases) {
            const page = dom()
            const net = queue([response])
            await startPrs(page.root, { fetch: net.fetch, now })
            assert(page.note.textContent.includes(text))
            assertEq(page.rows.childNodes.length, 0)
            assertEq(page.button.disabled, false)
            assertStructurallySame(net.urls, ['https://api.github.com/repos/functionalscript/functionalscript/pulls?state=open&per_page=100&page=1'])
        }
    },
}
