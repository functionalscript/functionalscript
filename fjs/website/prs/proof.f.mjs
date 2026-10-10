/**
 * The response fields, check interpretation and page markup, without network
 * or DOM effects. The host adapter proves those boundaries separately.
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { element } from '../../media/html/module.f.mjs'
import { parse } from '../../rtti/parse/module.f.mjs'
import { utf8ToString } from '../../text/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { checkSummary, checksSchema, prsPage, pullsSchema, row, statusesSchema } from './module.f.mjs'

/** The values are literal so the proof pins the provider's vocabulary. */
const pull = /** @type {const} */ ({
    number: 42,
    user: { login: 'author' },
    draft: false,
    head: { sha: 'abc' },
})

const local = /** @type {const} */ ({ commit: null, branch: null, funding: [] })

export const proof = {
    schemas: {
        pulls: () => assertStructurallySame(assertOk(parse(pullsSchema)([
            { ...pull, title: 'Extra GitHub field', user: { ...pull.user, id: 1 }, head: { ...pull.head, ref: 'main' } },
        ])), [pull]),
        noPulls: () => assertStructurallySame(assertOk(parse(pullsSchema)([])), []),
        deletedAuthor: () => assertStructurallySame(
            assertOk(parse(pullsSchema)([{ ...pull, user: null }])),
            [{ ...pull, user: null }]),
        invalidPulls: () => {
            assertError(parse(pullsSchema)([{ ...pull, number: '42' }]))
            assertError(parse(pullsSchema)([{ ...pull, user: {} }]))
            assertError(parse(pullsSchema)([{ ...pull, draft: null }]))
            assertError(parse(pullsSchema)([{ ...pull, head: {} }]))
            assertError(parse(pullsSchema)({}))
        },
        checks: () => assertStructurallySame(assertOk(parse(checksSchema)({
            total_count: 2,
            check_runs: [
                { status: 'completed', conclusion: 'success', id: 1 },
                { status: 'queued', conclusion: null, id: 2 },
            ],
            extra: true,
        })), {
            total_count: 2,
            check_runs: [
                { status: 'completed', conclusion: 'success' },
                { status: 'queued', conclusion: null },
            ],
        }),
        invalidChecks: () => {
            assertError(parse(checksSchema)({ total_count: '1', check_runs: [] }))
            assertError(parse(checksSchema)({ total_count: 1, check_runs: [{ status: 'completed' }] }))
            assertError(parse(checksSchema)({ total_count: 1, check_runs: [{ status: 'completed', conclusion: 1 }] }))
        },
        statuses: () => assertStructurallySame(assertOk(parse(statusesSchema)({
            total_count: 1,
            statuses: [{ state: 'success', context: 'CI' }],
            state: 'success',
        })), { total_count: 1, statuses: [{ state: 'success' }] }),
        invalidStatuses: () => {
            assertError(parse(statusesSchema)({ total_count: 1, statuses: [{}] }))
            assertError(parse(statusesSchema)({ total_count: 1, statuses: [{ state: false }] }))
        },
    },
    summaries: {
        none: () => assertEq(checkSummary([], []), 'No checks'),
        successfulConclusions: () => ['success', 'neutral', 'skipped'].forEach(conclusion =>
            assertEq(checkSummary([{ status: 'completed', conclusion }], []), 'Passing')),
        failedConclusions: () => [
            'failure', 'timed_out', 'cancelled', 'action_required', 'stale', 'startup_failure',
        ].forEach(conclusion => assertEq(checkSummary([{ status: 'completed', conclusion }], []), 'Failing')),
        pendingChecks: () => ['queued', 'in_progress', 'requested', 'waiting', 'pending'].forEach(status =>
            assertEq(checkSummary([{ status, conclusion: null }], []), 'Pending')),
        unfamiliarCheckStatus: () => assertEq(checkSummary([{ status: 'future', conclusion: 'success' }], []), 'Unknown'),
        unfamiliarConclusion: () => assertEq(checkSummary([{ status: 'completed', conclusion: 'future' }], []), 'Unknown'),
        missingConclusion: () => assertEq(checkSummary([{ status: 'completed', conclusion: null }], []), 'Unknown'),
        successfulStatus: () => assertEq(checkSummary([], [{ state: 'success' }]), 'Passing'),
        failedStatuses: () => ['failure', 'error'].forEach(state =>
            assertEq(checkSummary([], [{ state }]), 'Failing')),
        pendingStatus: () => assertEq(checkSummary([], [{ state: 'pending' }]), 'Pending'),
        unfamiliarStatus: () => assertEq(checkSummary([], [{ state: 'future' }]), 'Unknown'),
        failureTakesPriority: () => {
            assertEq(checkSummary([
                { status: 'in_progress', conclusion: null },
                { status: 'completed', conclusion: 'failure' },
            ], [{ state: 'future' }]), 'Failing')
            assertEq(checkSummary([{ status: 'future', conclusion: null }], [{ state: 'failure' }]), 'Failing')
        },
        unknownTakesPriority: () => assertEq(checkSummary([
            { status: 'in_progress', conclusion: null },
            { status: 'completed', conclusion: 'success' },
        ], [{ state: 'future' }]), 'Unknown'),
        pendingTakesPriority: () => assertEq(checkSummary([
            { status: 'completed', conclusion: 'success' },
        ], [{ state: 'pending' }]), 'Pending'),
        allPassing: () => assertEq(checkSummary([
            { status: 'completed', conclusion: 'success' },
        ], [{ state: 'success' }]), 'Passing'),
    },
    rows: {
        open: () => assertStructurallySame(row(pull, 'Passing'), ['tr',
            ['td', ['a', { href: 'https://github.com/functionalscript/functionalscript/pull/42' }, '#42']],
            ['td', ['a', { href: 'https://github.com/author' }, 'author']],
            ['td', ['span', { 'data-pr-state': 'open' }, 'Open'], ' · ', ['span', { 'data-pr-check': 'Passing' }, 'Passing']],
        ]),
        deletedAuthor: () => {
            const html = concat(element(row({ ...pull, user: null }, 'Passing')))
            assert(html.includes('<td>Unknown author</td>'), html)
            assertEq(html.split('<a href=').length - 1, 1)
        },
        draft: () => {
            const html = concat(element(row({ ...pull, draft: true }, 'Pending')))
            assert(html.includes('data-pr-state="draft">Draft</span>'), html)
            assert(html.includes('data-pr-check="Pending">Pending</span>'), html)
        },
        hostStates: () => ['Loading', 'Unavailable'].forEach(checks => {
            // The two values are pinned by separate calls below; here the
            // rendered words are checked without a type assertion.
            const node = checks === 'Loading' ? row(pull, 'Loading') : row(pull, 'Unavailable')
            assert(concat(element(node)).includes(`>${checks}</span>`), checks)
        }),
        safeAuthor: () => {
            const login = 'a/b?<script>"&'
            const html = concat(element(row({ ...pull, user: { login } }, 'Unknown')))
            assert(html.includes(`href="https://github.com/${encodeURIComponent(login)}"`), html)
            assert(html.includes('a/b?&lt;script&gt;&quot;&amp;'), html)
            assert(!html.includes('<script>'), html)
        },
    },
    page: () => {
        const html = utf8ToString(prsPage(local))
        assert(html.includes('<title>Pull requests · FunctionalScript</title>'), html)
        assert(html.includes('<body><header><nav aria-label="Site">'), html)
        assert(html.includes('<main data-prs="">'), html)
        assert(html.includes('<a href="https://github.com/functionalscript/functionalscript/pulls">'), html)
        assert(html.includes('<button type="button" data-pr-refresh="">Refresh</button>'), html)
        assert(html.includes('data-pr-note="" role="status" aria-live="polite"'), html)
        assert(html.includes('<noscript>'), html)
        assert(html.includes('<caption>Open pull requests</caption>'), html)
        assert(html.includes('<th scope="col">PR</th><th scope="col">Author</th><th scope="col">Status</th>'), html)
        assertEq(html.split('<th scope="col">').length - 1, 3)
        assert(html.includes('<tbody data-pr-rows=""></tbody>'), html)
        assert(html.includes("import { startPrs } from '/fjs/website/prs-runtime.mjs'"), html)
        assert(html.includes('if (root instanceof HTMLElement) { startPrs(root) }'), html)
    },
}
