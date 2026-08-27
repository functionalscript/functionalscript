/**
 * The browser proof application: link the proof modules, run them through the
 * shared emergent-testing core, and answer one serializable report.
 *
 * **It performs no browser operation of its own.** Linking a module, reading
 * the clock, executing a proof body and recording a result are all operations
 * (`./types.ts`), so this program is exactly as runnable from a proof with a
 * stand-in interpreter as it is from a page. What is genuinely the browser's —
 * the DOM, the published promise, the completion event — lives in the impure
 * adapter beside it, [`./module.mjs`](./module.mjs).
 *
 * **It owns no proof semantics either.** Discovering zero-argument leaves,
 * walking a returned tree, the structural `throw` expectation, resolving real
 * promises and counting results are `../module.f.mjs`'s, the same module `fjs t`
 * runs through — this file only decides what a *run* is: load, run, report.
 *
 * @module
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { Module } from '../../effects/common/types.ts'
 * @import { IoChannel, Import } from '../../effects/common/types.ts'
 * @import { TestResult } from '../types.ts'
 * @import { BrowserOp, BrowserProgram, BrowserTestReport, ReportStatus, _Loaded } from './types.ts'
 */

import { allOk, errorMessage, import_, now } from '../../effects/common/module.f.mjs'
import { history, historyStep, mapStep, pureOk, resultMapStep, step } from '../../effects/module.f.mjs'
import { recordingReporter, reported, runModuleMap } from '../module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'

/**
 * Builds the report from the results a run recorded. Totals are counted here
 * rather than reported separately, so they cannot disagree with `results`.
 *
 * @type {(status: ReportStatus, browser: string, duration: number, results: readonly TestResult[]) => BrowserTestReport}
 */
export const reportOf = (status, browser, duration, results) => {
    const failed = results.filter(result => result.status === 'failed').length
    return {
        status,
        browser,
        totals: { tests: results.length, passed: results.length - failed, failed },
        duration,
        results,
    }
}

/**
 * The result standing for something that went wrong outside any proof: a module
 * that would not link, or an operation the runner does not implement.
 *
 * It is counted as a failed result rather than left out. Totals that disagreed
 * with `results` would tell an automated consumer the suite was empty rather
 * than broken.
 *
 * @type {(module: string, message: string) => TestResult}
 */
const infrastructureResult = (module, message) =>
    ({ module, path: '', status: 'failed', duration: 0, message, stack: '' })

/**
 * Links one source, keeping the failure rather than propagating it: a run
 * reports *every* module that would not link, and the first one would
 * short-circuit the rest away.
 *
 * @type {(source: string) => Effect<Import, _Loaded, never>}
 */
const loadOne = source => resultMapStep(import_(source), r => {
    /** @type {_Loaded} */
    const loaded = [source, r]
    return ok(loaded)
})

/** @type {(results: readonly TestResult[]) => ReportStatus} */
const statusOf = results =>
    results.some(result => result.status === 'failed') ? 'failed' : 'passed'

/** @internal What a run answers before it is timed and packaged. */
/** @typedef {readonly[ReportStatus, readonly TestResult[]]} _Outcome */

/**
 * Runs the modules that linked, or reports the ones that did not.
 *
 * A module that never linked has no tests to run, so the run stops at the first
 * broken graph rather than reporting a partial suite as a complete one.
 *
 * @type {(loaded: readonly _Loaded[]) => Effect<BrowserOp, _Outcome, IoChannel>}
 */
const runLoaded = loaded => {
    const linked = loaded.flatMap(([source, r]) =>
        r[0] === 'ok' ? [/** @type {const} */ ([source, r[1]])] : [])
    if (linked.length !== loaded.length) {
        /** @type {_Outcome} */
        const broken = ['infrastructure-error', loaded.flatMap(([source, r]) =>
            r[0] === 'error' ? [infrastructureResult(source, errorMessage(r[1]))] : [])]
        return pureOk(broken)
    }
    const ran = runModuleMap(recordingReporter)(fromEntries(linked))
    const collected = step(ran, () => reported())
    return mapStep(collected, results => {
        /** @type {_Outcome} */
        const outcome = [statusOf(results), results]
        return outcome
    })
}

/** @type {(sources: readonly string[]) => Effect<BrowserOp, _Outcome, IoChannel>} */
const runSources = sources =>
    step(allOk(...sources.map(loadOne)), runLoaded)

/**
 * A run that could not finish, reported as one infrastructure error against the
 * run itself.
 *
 * This is what makes {@link BrowserProgram}'s empty error channel true: a
 * runner that cannot dispatch `sandbox`, `now` or `report` leaves the program
 * with nothing to answer, and a page waiting on the run has nowhere to put a
 * failure it never receives.
 *
 * @type {(browser: string, message: string) => BrowserTestReport}
 */
const failedRun = (browser, message) =>
    reportOf('infrastructure-error', browser, 0, [infrastructureResult('', message)])

/**
 * The application: link every source, run the proofs that linked, and answer
 * the report.
 *
 * @type {BrowserProgram}
 */
export const main = ({ browser, sources }) => {
    const started = history(now())
    const outcome = historyStep(started, () => runSources(sources))
    const ended = historyStep(outcome, () => now())
    const report = mapStep(ended, ([end, [status, results], start]) =>
        reportOf(status, browser, end - start, results))
    return resultMapStep(report, r =>
        ok(r[0] === 'error' ? failedRun(browser, errorMessage(r[1])) : r[1]))
}
