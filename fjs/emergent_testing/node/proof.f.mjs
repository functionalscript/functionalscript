/**
 * @import { Event, File, Thresholds } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { quiet } from './module.f.mjs'

/** @type {(line: number, branch: number, fn: number) => File} */
const file = (line, branch, fn) => ({
    coveredLinePercent: line,
    coveredBranchPercent: branch,
    coveredFunctionPercent: fn,
})

/** One file meeting every threshold of 100, then one missing each. */
const files = [file(100, 100, 100), file(99, 100, 100), file(100, 99, 100), file(100, 100, 99)]

/** @type {(thresholds: Thresholds, files: readonly File[]) => Event} */
const report = (thresholds, files) => ({ type: 'test:coverage', data: { summary: { files, thresholds } } })

/** @type {Thresholds} */
const all = { line: 100, branch: 100, function: 100 }

/** @type {Thresholds} */
const none = { line: 0, branch: 0, function: 0 }

/** @type {Event} */
const skipped = { type: 'test:pass', data: { skip: 'not here' } }

/** @type {Event} */
const todo = { type: 'test:pass', data: { todo: true } }

/** @type {Event} */
const fail = { type: 'test:fail' }

/** @type {Event} */
const summary = { type: 'test:diagnostic' }

export const proof = {
    aStartIsDropped: () => {
        assertEq(quiet({ type: 'test:start' }), null)
    },
    aPassIsDropped: () => {
        assertEq(quiet({ type: 'test:pass', data: {} }), null)
    },
    aSkippedTestIsKeptAsIs: () => {
        assertEq(quiet(skipped), skipped)
    },
    aTodoTestIsKeptAsIs: () => {
        assertEq(quiet(todo), todo)
    },
    aFailIsKeptAsIs: () => {
        assertEq(quiet(fail), fail)
    },
    aDiagnosticIsKeptAsIs: () => {
        assertEq(quiet(summary), summary)
    },
    coverageKeepsTheFilesMissingAThreshold: () => {
        assertStructurallySame(quiet(report(all, files)), report(all, files.slice(1)))
    },
    coverageWithoutThresholdsKeepsNoFile: () => {
        assertStructurallySame(quiet(report(none, files)), report(none, []))
    },
}
