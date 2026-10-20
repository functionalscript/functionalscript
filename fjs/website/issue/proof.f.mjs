/**
 * @import { DemoEvent } from '../demo/types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { header, isIssue, priorities, statuses } from './module.f.js'
import { demo, everyPriority, everyStatus, shown } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'

/** @type {(priority: string, status: string) => string} */
const issue = (priority, status) => `## Title\n\n**Priority:** ${priority}\n**Status:** ${status}\n\n### Problem\n`

export const proof = {
    values: () => {
        assertStructurallySame(statuses, ['wip', 'open', 'blocked', 'on-hold', 'done', 'irrelevant', "won't fix"])
        assertStructurallySame(priorities, ['P1', 'P2', 'P3', 'P4', 'P5'])
    },
    isIssue: () => {
        assertEq(isIssue('open.md'), true)
        // A `README.md` documents its directory.
        assertEq(isIssue('README.md'), false)
        // A `todo/` may hold a module the suite runs.
        assertEq(isIssue('proof.f.mjs'), false)
    },
    header: {
        plain: () => assertStructurallySame(
            header(issue('P2', 'open')),
            ['ok', { status: 'open', priority: 'P2' }]),
        everyStatus: () => statuses.forEach(s =>
            assertStructurallySame(header(issue('P3', s)), ['ok', { status: s, priority: 'P3' }])),
        // The note after ` — ` is not read, on either field, and may run on.
        note: () => assertStructurallySame(
            header(issue('P2 — shipped code is outside the subset', 'done — kept as the record; cited by\n  `spec/README.md`')),
            ['ok', { status: 'done', priority: 'P2' }]),
        // The first line that opens with the field is the field.
        firstLine: () => assertStructurallySame(
            header(`${issue('P1', 'wip')}\n**Status:** opne\n`),
            ['ok', { status: 'wip', priority: 'P1' }]),
        trailingSpace: () => assertStructurallySame(
            header(issue('P4 ', 'blocked\r')),
            ['ok', { status: 'blocked', priority: 'P4' }]),
        refused: {
            noStatus: () => assertStructurallySame(
                header('## Title\n\n**Priority:** P3\n'),
                ['error', 'no `**Status:**` line']),
            noPriority: () => assertStructurallySame(
                header('## Title\n\n**Status:** open\n'),
                ['error', 'no `**Priority:**` line']),
            // A typo is refused rather than shown as a plausible value.
            unknownStatus: () => assertStructurallySame(
                header(issue('P3', 'opne')),
                ['error', 'unknown status `opne`']),
            unknownPriority: () => assertStructurallySame(
                header(issue('P0', 'open')),
                ['error', 'unknown priority `P0`']),
            // A note needs its separator: a period is part of the value.
            periodIsNotASeparator: () => assertStructurallySame(
                header(issue('P3', 'wip. Unaffected')),
                ['error', 'unknown status `wip. Unaffected`']),
        },
    },
    demo: {
        // Every status is drawn, in the order a page lists them.
        everyStatus: () => {
            const html = htmlToString(everyStatus)
            const at = statuses.map(status => html.indexOf(`data-issue-status="${status}"`))
            assert(at.every(i => i >= 0), html)
            assertStructurallySame(at, at.toSorted((a, b) => a - b))
        },
        // Every priority is drawn, most urgent first.
        everyPriority: () => {
            const html = htmlToString(everyPriority)
            const at = priorities.map(priority => html.indexOf(`<span data-priority="${priority}">${priority}</span>`))
            assert(at.every(i => i >= 0), html)
            assertStructurallySame(at, at.toSorted((a, b) => a - b))
        },
        // A header is drawn as a page's entry; one that cannot be read is
        // refused with the reader's own message.
        shown: () => {
            assertEq(
                htmlToString(shown(issue('P1', 'blocked'))),
                '<!DOCTYPE html><ul data-links=""><li><span data-priority="P1">P1</span> <a href="#" data-kind="issue" data-issue-status="blocked">issue.md</a></li></ul>')
            const refused = htmlToString(shown(issue('P3', 'opne')))
            assert(refused.includes('Refused:'), refused)
            assert(refused.includes('unknown status `opne`'), refused)
        },
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'issue', value: 'x' })(''), 'x')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        // The first view reads the initial header, and every example does.
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="issue"'), html)
            assert(html.includes('<span data-priority="P3">P3</span> <a href="#" data-kind="issue" data-issue-status="wip">issue.md</a>'), html)
        },
    },
}
