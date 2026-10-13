/**
 * @import { Event, File, Thresholds } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { quiet as quietIn } from './module.f.mjs'

const quiet = quietIn('/repo')

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
const summary = { type: 'test:diagnostic', data: { message: 'tests 1' } }

/** @type {(file: string) => Event} */
const checkpoint = file => ({ type: 'test:diagnostic', data: { message: 'checkpoint', file, line: 3, column: 1 } })

/**
 * The same diagnostic with the test's location, as `at` spells it, before
 * the message.
 *
 * @type {(file: string, at: string) => Event}
 */
const checkpointAt = (file, at) => ({ type: 'test:diagnostic', data: { message: `${at}:3:1: checkpoint`, file, line: 3, column: 1 } })

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
    aSummaryDiagnosticIsKeptAsIs: () => {
        assertEq(quiet(summary), summary)
    },
    aTestDiagnosticIsLocated: () => {
        assertStructurallySame(quiet(checkpoint('/repo/a/proof.mjs')), checkpointAt('/repo/a/proof.mjs', 'a/proof.mjs'))
        assertStructurallySame(quietIn('C:\\repo')(checkpoint('C:\\repo\\a.mjs')), checkpointAt('C:\\repo\\a.mjs', 'a.mjs'))
    },
    aTestDiagnosticOutsideTheDirectoryKeepsItsPath: () => {
        assertStructurallySame(quiet(checkpoint('/elsewhere/a.mjs')), checkpointAt('/elsewhere/a.mjs', '/elsewhere/a.mjs'))
        assertStructurallySame(quiet(checkpoint('/repository/a.mjs')), checkpointAt('/repository/a.mjs', '/repository/a.mjs'))
    },
    aLogNamesItsTest: () => {
        assertStructurallySame(
            quiet({ type: 'test:log', data: { name: 'talker', message: 'hello' } }),
            { type: 'test:log', data: { name: 'talker', message: 'talker: hello' } })
    },
    coverageKeepsTheFilesMissingAThreshold: () => {
        assertStructurallySame(quiet(report(all, files)), report(all, files.slice(1)))
    },
    coverageWithoutThresholdsKeepsNoFile: () => {
        assertStructurallySame(quiet(report(none, files)), report(none, []))
    },
}
