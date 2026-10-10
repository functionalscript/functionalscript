/**
 * The open pull-request page: public GitHub response schemas, a combined
 * check outcome, and the three columns a reader sees.
 *
 * Fetching and DOM updates belong to the browser adapter. This module only
 * describes the page and the rows, so their interpretation is independently
 * proven and every provider-supplied word renders as text.
 *
 * @module
 *
 * @import { Element } from '../../media/html/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Build } from '../page/types.ts'
 * @import { CheckLabel, CheckRun, CheckSummary, CommitStatus, Pull } from './types.ts'
 */

import { array, boolean, number, open, or, string } from '../../rtti/module.f.mjs'
import { pageTitle, repository, shell } from '../page/module.f.mjs'

/**
 * Only the fields the page reads, open at every object boundary so additional
 * GitHub fields do not change what the page accepts.
 */
export const pullsSchema = array(open({
    number,
    user: or(open({ login: string }), null),
    draft: boolean,
    head: open({ sha: string }),
}))

/** One page of check runs; the runtime reads every page before summarizing. */
export const checksSchema = open({
    total_count: number,
    check_runs: array(open({ status: string, conclusion: or(string, null) })),
})

/** Current commit statuses, separate from the Checks API's check runs. */
export const statusesSchema = open({
    total_count: number,
    statuses: array(open({ state: string })),
})

/** @type {readonly string[]} */
const failedConclusions = [
    'failure', 'timed_out', 'cancelled', 'action_required', 'stale', 'startup_failure',
]

/** @type {readonly string[]} */
const passedConclusions = ['success', 'neutral', 'skipped']

/** @type {readonly string[]} */
const pendingStatuses = ['queued', 'in_progress', 'requested', 'waiting', 'pending']

/** @type {(check: CheckRun) => CheckSummary} */
const checkOutcome = ({ status, conclusion }) => {
    if (status !== 'completed') {
        return pendingStatuses.includes(status) ? 'Pending' : 'Unknown'
    }
    if (conclusion === null) { return 'Unknown' }
    if (failedConclusions.includes(conclusion)) { return 'Failing' }
    return passedConclusions.includes(conclusion) ? 'Passing' : 'Unknown'
}

/** @type {(status: CommitStatus) => CheckSummary} */
const statusOutcome = ({ state }) => {
    if (state === 'failure' || state === 'error') { return 'Failing' }
    if (state === 'pending') { return 'Pending' }
    return state === 'success' ? 'Passing' : 'Unknown'
}

/**
 * The head commit's observed CI outcome. A failure stays visible even when
 * another provider is pending or unfamiliar; an unfamiliar outcome prevents
 * a passing label. No entries means no checks, rather than passing.
 *
 * @type {(checks: readonly CheckRun[], statuses: readonly CommitStatus[]) => CheckSummary}
 */
export const checkSummary = (checks, statuses) => {
    const outcomes = [...checks.map(checkOutcome), ...statuses.map(statusOutcome)]
    if (outcomes.length === 0) { return 'No checks' }
    if (outcomes.includes('Failing')) { return 'Failing' }
    if (outcomes.includes('Unknown')) { return 'Unknown' }
    return outcomes.includes('Pending') ? 'Pending' : 'Passing'
}

/**
 * The three columns for one pull request. Links are derived from the known
 * repository and an encoded author name, rather than taken from provider URLs.
 * A deleted author stays visible as plain text without a profile link.
 *
 * @type {(pull: Pull, checks: CheckLabel) => Element}
 */
export const row = ({ number: prNumber, user, draft }, checks) => ['tr',
    ['td', ['a', { href: `${repository}/pull/${prNumber}` }, `#${prNumber}`]],
    ['td', user === null
        ? 'Unknown author'
        : ['a', { href: `https://github.com/${encodeURIComponent(user.login)}` }, user.login]],
    ['td',
        ['span', { 'data-pr-state': draft ? 'draft' : 'open' }, draft ? 'Draft' : 'Open'],
        ' · ',
        ['span', { 'data-pr-check': checks }, checks]],
]

/**
 * The dedicated page, with a GitHub fallback and a browser adapter that reads
 * only when the reader clicks Refresh. Opening the page makes no API requests.
 *
 * @type {(build: Build) => Vec}
 */
export const prsPage = build => shell(build)(pageTitle('Pull requests'))(['main', { 'data-prs': '' },
    ['h1', 'Pull requests'],
    ['p', ['a', { href: `${repository}/pulls` }, 'View pull requests on GitHub']],
    ['button', { type: 'button', 'data-pr-refresh': '' }, 'Refresh'],
    ['p', { 'data-pr-note': '', role: 'status', 'aria-live': 'polite' }, 'Press Refresh to load pull requests and checks.'],
    ['noscript', ['p', 'JavaScript is needed to load this list. Follow the GitHub link above to view pull requests.']],
    ['table',
        ['caption', 'Open pull requests'],
        ['thead', ['tr',
            ['th', { scope: 'col' }, 'PR'],
            ['th', { scope: 'col' }, 'Author'],
            ['th', { scope: 'col' }, 'Status']]],
        ['tbody', { 'data-pr-rows': '' }]],
    ['script', { type: 'module' },
        `import { startPrs } from '/fjs/website/prs-runtime.mjs'

const root = document.querySelector('[data-prs]')
if (root instanceof HTMLElement) { startPrs(root) }
`],
])
