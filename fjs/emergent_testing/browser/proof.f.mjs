/**
 * The browser runner's orchestration, driven by runners that are not browsers.
 *
 * Every proof here runs [`./module.f.mjs`](./module.f.mjs) on a mock runner,
 * which is the whole point of the move: what used to be an `async` function
 * building its own interpreter is now an effect, so a proof chooses the runner
 * and the run's *own* failure becomes reachable. A runner that declares
 * `report` and does not implement it answers `notImplemented` through the error
 * channel — the failure a page meets when its own reporting breaks, produced
 * with nothing injected and nothing global touched.
 *
 * @import { MemOperationMap, RunInstance } from '../../effects/mock/types.ts'
 * @import { SandboxResult } from '../../effects/common/types.ts'
 * @import { Commands } from '../../effects/types.ts'
 * @import { _BrowserOp, _Rows } from './private.ts'
 * @import { TestStatus, _BrowserTestResult } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { loadProofs, reportOf, runProofs } from './module.f.mjs'
import { partialRun, run as mockRun } from '../../effects/mock/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'

/**
 * The handlers a working page supplies. `catch` cannot really catch — a pure
 * runner has no `try` — which is the same bargain `../../effects/node/virtual`
 * makes, so the fixtures here are benign and the hostile ones stay with the
 * runner that has a real one.
 *
 * @type {MemOperationMap<_BrowserOp, _Rows>}
 */
const handlers = {
    sandbox: f => rows => [rows, ok(/** @type {SandboxResult<unknown>} */ (f()))],
    catch: f => rows => [rows, ok(ok(f()))],
    // A source resolves to a module whose `proof` names it, so a proof can see
    // *which* source produced what. `bad:` is the one that will not load.
    // A module namespace, not a proof tree: `proof` beside another export, so
    // a walk handed the *module* is visibly different from one handed its
    // `proof`.
    import: path => rows => [
        rows,
        path.startsWith('bad:')
            ? error(ioError({ message: `cannot load ${path}` }))
            : ok({
                extra: () => ({ result: ok(undefined), duration: 0 }),
                proof: { [path]: () => ({ result: ok(undefined), duration: 0 }) },
            }),
    ],

    report: event => rows => [[...rows, event], ok(undefined)],
}

/** @type {RunInstance<_BrowserOp, _Rows>} */
const working = mockRun(handlers)

/**
 * A runner that has every operation but `report`. `partialRun` answers
 * `notImplemented` for it through the ordinary continuation, which is exactly
 * what a page whose reporting is broken hands the orchestration.
 *
 * @type {RunInstance<_BrowserOp, _Rows>}
 */
const mute = partialRun(/** @type {Commands<_BrowserOp>} */ (
    ['catch', 'import', 'report', 'sandbox']))({
    sandbox: handlers.sandbox,
    catch: handlers.catch,
    import: handlers.import,
})

/**
 * A runner without `catch` at all. Reading a user value is then impossible
 * rather than merely dangerous, and `attempt` folds the refusal into the same
 * answer a throw would give — which is what these proofs use to reach the
 * describing paths a pure runner can never reach by throwing (it has no `try`,
 * so a hostile fixture panics instead).
 *
 * @type {RunInstance<_BrowserOp, _Rows>}
 */
const blind = partialRun(/** @type {Commands<_BrowserOp>} */ (
    ['catch', 'import', 'report', 'sandbox']))({
    sandbox: handlers.sandbox,
    report: handlers.report,
})

/**
 * A runner that can neither read a user value nor report a row: the module
 * failure the first refusal produces cannot even be announced, so the run ends
 * on the second.
 *
 * @type {RunInstance<_BrowserOp, _Rows>}
 */
const deaf = partialRun(/** @type {Commands<_BrowserOp>} */ (
    ['catch', 'import', 'report', 'sandbox']))({
    sandbox: handlers.sandbox,
})

/** @type {() => unknown} */
const pass = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 0 })
/** @type {(value: unknown) => () => unknown} */
const failWith = value => () => ({ result: /** @type {const} */ (['error', value]), duration: 0 })
/** @type {() => unknown} */
const fail = () => ({ result: /** @type {const} */ (['error', 'oops']), duration: 0 })

/** @type {(status: TestStatus, duration: number) => _BrowserTestResult} */
const leaf = (status, duration) => ({
    module: 'a', path: '.x', name: 'import("a").proof.x()', status, duration,
})

/**
 * The settled rows among what a run reported, which is what most proofs here
 * are about. The announcements are asserted where they are the subject.
 *
 * @type {(events: _Rows) => readonly _BrowserTestResult[]}
 */
const settled = events => events.flatMap(e => e[0] === 'result' ? [e[1]] : [])

/**
 * The sources a run announced as loaded, in the order it announced them.
 *
 * @type {(events: _Rows) => readonly string[]}
 */
const announced = events => events.flatMap(e => e[0] === 'loading' ? [e[1]] : [])

export const proof = {
    loadProofs: {
        // Every source loads: the walk answers the modules to run, paired with
        // the source that produced each, in the order they were asked for
        // rather than the order they arrived.
        ready: () => {
            const [, answered] = working([])(loadProofs(['a', 'b']))
            assertEq(answered[0], 'ok')
            const outcome = answered[1]
            assert(outcome[0] === 'ready', outcome)
            assertEq(outcome[1].length, 2)
            assertEq(outcome[1][0]?.[0], 'a')
            assertEq(outcome[1][1]?.[0], 'b')
        },
        /**
         * **What is carried is the module's `proof`, not the module.**
         *
         * Handing the namespace on instead is not a naming slip: the traversal
         * walks whatever it is given, so every other zero-argument export gets
         * *run* as a test and the real proofs land under an extra `proof`
         * level. Nothing else here would notice — the totals come out the same
         * when a fixture has one extra export and one proof — which is why this
         * asserts the value rather than a count.
         */
        readyCarriesTheProofExport: () => {
            const [, answered] = working([])(loadProofs(['a']))
            const outcome = answered[1]
            assert(outcome[0] === 'ready', outcome)
            const [, tree] = outcome[1][0] ?? []
            assertStructurallySame(
                Object.keys(/** @type {Record<string, unknown>} */ (tree)),
                ['a'])
        },
        // One module that will not link stops the suite — it has no tests to
        // run — and every failed source is named, because a report listing one
        // of two broken modules sends a reader to fix half the problem.
        failedNamesEverySource: () => {
            const [, answered] = working([])(loadProofs(['bad:one', 'a', 'bad:two']))
            const outcome = answered[1]
            assert(outcome[0] === 'failed', outcome)
            assertEq(outcome[1].length, 2)
            assertEq(outcome[1][0]?.module, 'bad:one')
            assertEq(outcome[1][1]?.module, 'bad:two')
            // The row carries the channel's own sentence, which is what a
            // reader needs and what a tuple spelled out is not.
            assertEq(outcome[1][0]?.message, 'cannot load bad:one')
        },
        // Nothing to load is not a failure: an empty suite is a suite.
        noSources: () => {
            const [, answered] = working([])(loadProofs([]))
            const outcome = answered[1]
            assert(outcome[0] === 'ready', outcome)
            assertEq(outcome[1].length, 0)
        },
        /**
         * **Each module is announced as it lands**, which is what a page counts
         * to render `3/141`.
         *
         * The announcement is asserted rather than assumed: the page's counter
         * increments on this event's tag, so a walk that announced under
         * another name would leave a suite sitting at `Loading 0/N` for its
         * whole run with every gate green. Nothing else here would notice — the
         * outcome and the rows are the same either way.
         *
         * No result rows: a module arriving is not a test landing.
         */
        announcesEachModule: () => {
            const [events, answered] = working([])(loadProofs(['a', 'b']))
            assertEq(answered[0], 'ok')
            assertStructurallySame(announced(events), ['a', 'b'])
            assertEq(settled(events).length, 0)
        },
        /**
         * **A page that cannot be told stops the walk, and says so instead of
         * the modules.**
         *
         * A run whose reporting is broken cannot describe the failed modules
         * either, so a list assembled for nobody to see would be the wrong
         * answer — and the row names the runner rather than a module, because
         * no module is to blame.
         */
        refusedReportEndsLoading: () => {
            const [rows, answered] = mute([])(loadProofs(['bad:one', 'a']))
            assertEq(rows.length, 0)
            const outcome = answered[1]
            assert(outcome[0] === 'failed', outcome)
            assertEq(outcome[1].length, 1)
            assertEq(outcome[1][0]?.module, 'the browser runner')
        },
    },
    reportOf: {
        // The status the results decide: any failure fails the run.
        folds: () => {
            const results = [leaf('passed', 1), leaf('failed', 2)]
            const r = reportOf('a browser', 12, results, null)
            assertEq(r.status, 'failed')
            assertEq(r.totals.tests, 2)
            assertEq(r.totals.passed, 1)
            assertEq(r.totals.failed, 1)
            // **The results themselves survive the fold**, which nothing else
            // here says: every assertion above reads a count or a status, and a
            // report that answered `[]` for `results` would satisfy all of
            // them. The rows are what a reader of the page — and a controller
            // reading the published report — actually consumes.
            assertStructurallySame(r.results, results)
        },
        allPassed: () => {
            assertEq(reportOf('a browser', 0, [leaf('passed', 1)], null).status, 'passed')
        },
        // A run with no results at all passed: there was nothing to fail. The
        // *reason* a suite is empty is a status the caller overrides with.
        empty: () => {
            const r = reportOf('a browser', 0, [], null)
            assertEq(r.status, 'passed')
            assertEq(r.totals.tests, 0)
            assertEq(r.results.length, 0)
        },
        // An override wins over the fold, which is the case it exists for: a
        // run that never reached its leaves cannot say so through them.
        overrideBeatsThePassingFold: () => {
            const r = reportOf('a browser', 0, [leaf('passed', 1)], 'infrastructure-error')
            assertEq(r.status, 'infrastructure-error')
            // The results are still counted *and* still carried: totals that
            // disagreed with `results` would read as an empty suite rather than
            // a broken one, and this is the case where a consumer most needs
            // the rows — a run that failed before it could produce them.
            assertEq(r.totals.tests, 1)
            assertEq(r.totals.passed, 1)
            assertEq(r.results.length, 1)
        },
        // The two things only a host knows are carried through untouched, not
        // derived: this function reads no clock and knows no browser.
        carriesTheHostsFacts: () => {
            const r = reportOf('Mozilla/5.0 (a fiction)', 12.5, [], null)
            assertEq(r.browser, 'Mozilla/5.0 (a fiction)')
            assertEq(r.duration, 12.5)
        },
    },
    // The ordinary run: one row per leaf, in order, and no runner failure.
    reportsEveryLeaf: () => {
        const [events, answered] = working([])(runProofs([['a', { x: pass, y: fail }]]))
        const rows = settled(events)
        assertEq(answered[0], 'ok')
        assertEq(answered[1], null)
        assertEq(rows.length, 2)
        assertEq(rows[0]?.name, 'import("a").proof.x()')
        assertEq(rows[0]?.status, 'passed')
        assertEq(rows[1]?.status, 'failed')
        assertEq(rows[1]?.message, 'oops')
    },
    // Modules are a list, not a map: two entries sharing a label are two runs
    // (catalog item 6).
    repeatedModuleLabelIsTwoRuns: () => {
        const rows = settled(working([])(runProofs([['a', { x: pass }], ['a', { x: pass }]]))[0])
        assertEq(rows.length, 2)
        assertEq(rows[0]?.name, rows[1]?.name)
    },
    // A leaf marked `throw` that returned cleanly is the one failure with
    // nothing thrown to describe, so the message says what happened instead of
    // printing the value.
    expectedThrowIsDescribed: () => {
        const rows = settled(working([])(runProofs([['a', { throw: { x: pass } }]]))[0])
        assertEq(rows[0]?.status, 'failed')
        assertEq(rows[0]?.message, 'Expected the proof to throw')
    },
    /**
     * **The proof the move exists for.** A runner that refuses `report` ends
     * the run, and the failure is *answered* rather than announced — announcing
     * is the thing that broke.
     *
     * Two properties, and the second is the one a page depends on: the run
     * stops, so nothing is reported after a runner that cannot report; and the
     * failure names what went wrong, so the report the host folds says
     * `infrastructure-error` rather than looking like an empty suite.
     */
    refusedReportEndsTheRun: () => {
        const [events, answered] = mute([])(runProofs([['a', { x: pass, y: pass }], ['b', { z: pass }]]))
        assertEq(settled(events).length, 0)
        assertEq(answered[0], 'ok')
        const ended = answered[1]
        assert(ended !== null, ended)
        assertEq(ended?.module, 'a')
        assertEq(ended?.status, 'failed')
        assert((ended?.message ?? '').includes('report'), ended?.message)
    },
    // The orchestration's error channel is `never`, and this is what that
    // means in practice: the one runner failure a proof can produce arrives as
    // a value, so the effect still answers `ok`.
    aRefusedRunStillAnswersOk: () => {
        const [, answered] = mute([])(runProofs([['a', { x: pass }]]))
        assertEq(answered[0], 'ok')
    },
    // A thrown value carrying both fields is reported by them: the message
    // names the failure and the stack is what a report crossing a wire exists
    // to carry.
    errorFieldsAreRead: () => {
        const rows = settled(working([])(runProofs([['a', { x: failWith({ message: 'm', stack: 's' }) }]]))[0])
        assertEq(rows[0]?.message, 'm')
        assertEq(rows[0]?.stack, 's')
    },
    // With no stack there is nothing better to say than the message, and a
    // consumer still gets both fields rather than a missing one.
    errorWithoutStack: () => {
        const rows = settled(working([])(runProofs([['a', { x: failWith({ message: 'm' }) }]]))[0])
        assertEq(rows[0]?.message, 'm')
        assertEq(rows[0]?.stack, 'm')
    },
    // A value that is not error-shaped is described by its own text.
    plainThrownValueIsPrinted: () => {
        const rows = settled(working([])(runProofs([['a', { x: failWith(42) }]]))[0])
        assertEq(rows[0]?.message, '42')
        assertEq(rows[0]?.stack, '42')
    },
    /**
     * A runner that cannot read user values at all.
     *
     * Enumerating a module's export is an attempt like any other, so a refusal
     * lands where a hostile getter would: the module fails, the *run* does not,
     * and the row says so. Nothing can be read to describe it — including the
     * refusal itself — which is what the fallback text is for.
     */
    withoutCatchAModuleFailsAndTheRunGoesOn: () => {
        const [events, answered] = blind([])(runProofs([['a', { x: pass }], ['b', { y: pass }]]))
        assertEq(answered[1], null)
        const rows = settled(events)
        assertEq(rows.length, 2)
        assertEq(rows[0]?.module, 'a')
        assertEq(rows[0]?.status, 'failed')
        assertEq(rows[0]?.message, 'Unknown thrown value')
        assertEq(rows[1]?.module, 'b')
    },
    // Announcing a module failure is itself a report, so a runner that cannot
    // report ends the run there — with the failure answered rather than
    // announced, which is the only way it can travel at all.
    aModuleFailureThatCannotBeAnnouncedEndsTheRun: () => {
        const [events, answered] = deaf([])(runProofs([['a', { x: pass }], ['b', { y: pass }]]))
        assertEq(settled(events).length, 0)
        const ended = answered[1]
        assert(ended !== null, ended)
        assertEq(ended?.module, 'a')
    },
    // Nothing at all to run is not a failure.
    noModules: () => {
        const [events, answered] = working([])(runProofs([]))
        assertEq(events.length, 0)
        assertEq(answered[1], null)
    },
}
