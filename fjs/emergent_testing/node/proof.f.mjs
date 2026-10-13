/**
 * @import { EventData } from 'node:test'
 * @import { TestEvent } from 'node:test/reporters'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { quiet } from './module.f.mjs'

/**
 * A file's coverage row with the three percentages a threshold is checked
 * against; the counts behind them are not what the filter reads.
 *
 * @type {(path: string, line: number, branch: number, fn: number) =>
 *     Extract<TestEvent, { readonly type: 'test:coverage' }>['data']['summary']['files'][number]}
 */
const file = (path, line, branch, fn) => ({
    path,
    totalLineCount: 0,
    totalBranchCount: 0,
    totalFunctionCount: 0,
    coveredLineCount: 0,
    coveredBranchCount: 0,
    coveredFunctionCount: 0,
    coveredLinePercent: line,
    coveredBranchPercent: branch,
    coveredFunctionPercent: fn,
    functions: [],
    branches: [],
    lines: [],
})

const files = [
    file('full', 100, 100, 100),
    file('lines', 99, 100, 100),
    file('branches', 100, 99, 100),
    file('functions', 100, 100, 99),
]

/** @type {(thresholds: { readonly line: number, readonly branch: number, readonly function: number }) => TestEvent} */
const report = thresholds => ({
    type: 'test:coverage',
    data: {
        nesting: 0,
        summary: {
            workingDirectory: '/',
            files,
            totals: {
                totalLineCount: 0,
                totalBranchCount: 0,
                totalFunctionCount: 0,
                coveredLineCount: 0,
                coveredBranchCount: 0,
                coveredFunctionCount: 0,
                coveredLinePercent: 100,
                coveredBranchPercent: 100,
                coveredFunctionPercent: 100,
            },
            thresholds,
        },
    },
})

/**
 * Node declares a failure's `error` with a required `cause`, which `Error`
 * leaves optional; the cast states that this one has one.
 */
const error = /** @type {EventData.Error} */ (/** @type {unknown} */ (new Error('boom', { cause: 'the proof' })))

/** @type {TestEvent} */
const fail = {
    type: 'test:fail',
    data: { name: 'a', nesting: 0, testNumber: 1, details: { duration_ms: 1, error } },
}

/** @type {TestEvent} */
const summary = { type: 'test:diagnostic', data: { nesting: 0, message: 'tests 1', level: 'info' } }

export const proof = {
    aStartIsDropped: () => {
        assertEq(quiet({ type: 'test:start', data: { name: 'a', nesting: 0 } }), null)
    },
    aPassIsDropped: () => {
        assertEq(quiet({ type: 'test:pass', data: { name: 'a', nesting: 0, testNumber: 1, details: { duration_ms: 1 } } }), null)
    },
    aFailIsKeptAsIs: () => {
        assertEq(quiet(fail), fail)
    },
    aDiagnosticIsKeptAsIs: () => {
        assertEq(quiet(summary), summary)
    },
    coverageKeepsTheFilesMissingAThreshold: () => {
        const kept = quiet(report({ line: 100, branch: 100, function: 100 }))
        if (kept?.type !== 'test:coverage') { throw kept }
        assertStructurallySame(kept.data.summary.files.map(f => f.path), ['lines', 'branches', 'functions'])
        assertEq(kept.data.summary.totals.coveredLinePercent, 100)
    },
    coverageWithoutThresholdsKeepsOnlyTheTotals: () => {
        const kept = quiet(report({ line: 0, branch: 0, function: 0 }))
        if (kept?.type !== 'test:coverage') { throw kept }
        assertStructurallySame(kept.data.summary.files, [])
    },
}
