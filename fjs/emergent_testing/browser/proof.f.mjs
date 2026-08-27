/**
 * Proofs for the browser proof application.
 *
 * The application performs only operations, so a state-threading stand-in
 * interpreter is enough to drive every path from Node — no browser, no DOM, and
 * no globals for these proofs to install and unset. `sandbox` is the same
 * pass-through the virtual Node runner uses: a fixture returns the
 * `SandboxResult` it wants reported, so outcomes are dictated rather than
 * measured.
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { MemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { Module, SandboxResult } from '../../effects/common/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { TestResult } from '../types.ts'
 * @import { BrowserOp, BrowserTestReport } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/common/module.f.mjs'
import { notImplemented } from '../../effects/module.f.mjs'
import { run as mockRun } from '../../effects/mock/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { main } from './module.f.mjs'

/**
 * @typedef {{
 *     readonly time: number,
 *     readonly clock: boolean,
 *     readonly results: readonly TestResult[],
 *     readonly modules: StringMap<Module>,
 * }} _State
 */

/** @type {MemOperationMap<BrowserOp, _State>} */
const map = {
    all: (...a) => state => {
        /** @type {readonly Result<unknown, unknown>[]} */
        let e = []
        for (const i of a) {
            const [ns, ei] = browser(state)(i)
            state = ns
            e = [...e, ei]
        }
        return [state, ok(e)]
    },
    await: p => state => [state, ok([p])],
    fetch: () => state => [state, error(ioError({ message: 'no network' }))],
    import: source => state => {
        const module = state.modules[source]
        return [
            state,
            module === undefined
                ? error(ioError({ code: 'ENOENT', message: `cannot link ${source}` }))
                : ok(module),
        ]
    },
    // A clock that ticks once per read, so a run's duration is the number of
    // reads between its ends and never a real elapsed time.
    now: () => state => [
        { ...state, time: state.time + 1 },
        state.clock ? ok(state.time) : error(notImplemented('now')),
    ],
    sandbox: f => state => [state, ok(/** @type {SandboxResult<unknown>} */ (f()))],
    report: result => state => [{ ...state, results: [...state.results, result] }, ok(undefined)],
    reported: () => state => [state, ok(state.results)],
}

/** @type {RunInstance<BrowserOp, _State>} */
const browser = mockRun(map)

/** @type {(sources: readonly string[], modules: StringMap<Module>, clock?: boolean) => BrowserTestReport} */
const run = (sources, modules, clock = true) => {
    /** @type {_State} */
    const state = { time: 100, clock, results: [], modules }
    const [, report] = browser(state)(main({ browser: 'proof', sources }))
    return unwrap(report)
}

/** A leaf that passes, taking 2 ms.
 *
 * @type {() => unknown}
 */
const pass = () => ({ result: ok(undefined), duration: 2 })

/** A leaf that fails with an `Error`.
 *
 * @type {() => unknown}
 */
const fail = () => ({ result: error(new Error('oops')), duration: 3 })

export const proof = {
    passing: () => {
        const report = run(['a'], { a: { proof: { x: pass } } })
        assertEq(report.status, 'passed')
        assertEq(report.browser, 'proof')
        assertEq(report.totals.tests, 1)
        assertEq(report.totals.passed, 1)
        assertEq(report.totals.failed, 0)
        // Two clock reads bracket the run, and the stand-in ticks once per read.
        assertEq(report.duration, 1)
        assertEq(report.results[0]?.module, 'a')
        assertEq(report.results[0]?.path, '.x')
        assertEq(report.results[0]?.duration, 2)
    },
    failing: () => {
        const report = run(['a'], { a: { proof: { x: pass, y: fail } } })
        assertEq(report.status, 'failed')
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        const failed = report.results.filter(r => r.status === 'failed')
        assertEq(failed[0]?.path, '.y')
        assertEq(failed[0]?.message, 'oops')
    },
    // The proof tree a leaf returns is walked by the same shared core `fjs t`
    // uses, so a sub-test is a result of its own with a call boundary in its
    // path.
    subTree: () => {
        const report = run(['a'], {
            a: { proof: { outer: () => ({ result: ok({ inner: pass }), duration: 0 }) } },
        })
        assertEq(report.totals.tests, 2)
        assertEq(report.results[1]?.path, '.outer().inner')
    },
    expectedThrow: () => {
        const report = run(['a'], { a: { proof: { throw: { boom: fail, quiet: pass } } } })
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        const failed = report.results.filter(r => r.status === 'failed')
        assertEq(failed[0]?.path, '.throw.quiet')
        assertEq(failed[0]?.message, 'Expected the proof to throw')
    },
    // A module without a `proof` export contributes no tests, and an empty run
    // still answers a report rather than nothing.
    withoutProof: () => {
        const report = run(['a'], { a: {} })
        assertEq(report.status, 'passed')
        assertEq(report.totals.tests, 0)
    },
    // One module that would not link stops the run: the suite never ran, so its
    // status is not the one a failing suite gets, and every rejected source is
    // still counted as a failed result.
    unlinkable: () => {
        const report = run(['a', 'missing'], { a: { proof: { x: pass } } })
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.totals.tests, 1)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[0]?.module, 'missing')
        assertEq(report.results[0]?.path, '')
        assertEq(report.results[0]?.message, 'cannot link missing')
    },
    // A runner missing an operation the application needs is reported the same
    // way, which is what makes the program's empty error channel true: a page
    // waiting on the run always receives a report.
    incompleteRunner: () => {
        const report = run(['a'], { a: { proof: { x: pass } } }, false)
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.duration, 0)
        assertEq(report.results[0]?.message, 'operation not implemented: now')
        assert(report.results.length === 1, report.results)
    },
}
