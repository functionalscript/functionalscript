import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { header, isIssue, priorities, statuses } from './module.f.mjs'

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
}
