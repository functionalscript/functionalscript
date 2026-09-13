/**
 * The browser runner's orchestration: enumerate a module, run its leaves,
 * route a failure, decide how the run ended.
 *
 * None of that is the browser's. Reading a user value, running a leaf and
 * announcing a row are operations; deciding what each outcome *means* is logic
 * over them, and logic belongs here where a runner can drive it. What is left
 * in [`./module.mjs`](./module.mjs) is the part that genuinely needs a
 * page: the interpreter, the DOM, the wall clock, `navigator`.
 *
 * That split is not tidiness. The run's own failure — an operation answering
 * through the error channel — was unreachable while this lived inside an
 * `async` function that built its own interpreter: the two attempts to reach
 * it are recorded in `../README.md`'s pitfall catalog, and both reached
 * outside the proof's own values. Behind `report`, a runner that simply
 * refuses the operation produces it, with nothing injected and nothing global
 * touched.
 *
 * @module
 *
 * @import {
 *     BrowserTestReport, LeafReporter, Reporter, TestId, TestResult, _BrowserEvent,
 *     _BrowserReport, _BrowserTestResult, _LoadOutcome, _LoadState, _TestAndPath,
 * } from '../types.ts'
 * @import { Catch, Import, Sandbox, SandboxResult } from '../../effects/common/types.ts'
 * @import { Effect, Func, IoChannel } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { catch_, import_ } from '../../effects/common/module.f.mjs'
import {
    addResult, collectTests, defaultTest, runEntries, text, zeroState, zeroTotals,
} from '../module.f.mjs'
import { do_, errorMessage, foldStep, mapStep, pureOk, resultStep, step } from '../../effects/module.f.mjs'
import { error } from '../../types/result/module.f.mjs'

/** The page's leaf-landed operation; see `_BrowserReport`.
 * @type {Func<_BrowserReport>} */
const report = do_('report')

/**
 * `catch`, with the runner's own refusal folded into the same answer as a
 * throw.
 *
 * A runner that does not implement `catch` cannot run the thunk, which is
 * indistinguishable *here* from running it and having it fail: either way there
 * is no value and something has to describe the absence. Folding them keeps
 * this module's error channel empty — every failure it can meet becomes a
 * value it decides about — which is what lets the type say the orchestration
 * cannot itself fail.
 *
 * The answer is `Result<unknown, unknown>` and a caller that knows better says
 * so at its own call, which is the same shape `catch_` is used with in
 * [`../module.f.mjs`](../module.f.mjs): the operation is generic, and a
 * wrapper written in JSDoc cannot carry the variable through its own body.
 *
 * @type {(f: () => unknown) => Effect<Catch, Result<unknown, unknown>, never>}
 */
const attempt = f =>
    resultStep(catch_(f), r => pureOk(r[0] === 'ok' ? r[1] : error(r[1])))

/**
 * The `message` and `stack` of a thrown value, read in one attempt.
 *
 * An Error thrown from another realm — an iframe, a worker — is not
 * `instanceof Error` here, and its stack is the very thing the report exists to
 * carry. What the fields say is therefore the test, not where the value was
 * made: anything carrying `message` or `stack` is read as the failure it
 * describes, and everything else by its own text.
 *
 * Asking whether the fields are there is as user-observable as reading them —
 * `in` consults a proxy — so the question and the answer share one attempt.
 *
 * @type {(value: unknown) => readonly [unknown, unknown] | null}
 */
const fields = value =>
    value !== null && (typeof value === 'object' || typeof value === 'function')
        && ('message' in value || 'stack' in value)
        ? [
            /** @type {{ readonly message?: unknown }} */(value).message,
            /** @type {{ readonly stack?: unknown }} */(value).stack,
        ]
        : null

/** @type {(value: unknown) => Effect<Catch, readonly [string, string], never>} */
export const errorDetails = value =>
    step(attempt(() => fields(value)), read => {
        if (read[0] === 'error' || read[1] === null) {
            return mapStep(text(value), only => /** @type {readonly [string, string]} */([only, only]))
        }
        const [message, stack] = /** @type {readonly [unknown, unknown]} */(read[1])
        return step(text(message), described =>
            stack === undefined
                ? pureOk(/** @type {readonly [string, string]} */([described, described]))
                : mapStep(text(stack), s => [described, s]))
    })

/**
 * A failure of a whole module — one that will not link, whose `proof` export
 * cannot be enumerated, or that the runner gave up in. It does not go through
 * `testResult`, and that is the point: there is no leaf here, so there is no
 * path and no `fmtImport` name to build. What is known about it is its source,
 * so its source is its name.
 *
 * It is still a `TestResult`, and still counted, because a report whose totals
 * disagreed with its `results` would tell an automated consumer that the suite
 * was empty rather than that it was broken. The cost is that a consumer cannot
 * assume every entry names a leaf — which is why {@link TestResult} says so.
 *
 * @type {(source: string, duration: number, message: string, stack: string) => _BrowserTestResult}
 */
export const moduleFailure = (source, duration, message, stack) => ({
    module: source, path: '', name: source, status: 'failed', duration, message, stack,
})

/**
 * The run-ended event, as the page reports it.
 *
 * The counts — and with them the run's own pass/fail status — come from folding
 * the results with the same `addResult` that decides `fjs t`'s summary and exit
 * code, so "did the run pass" has one answer across the runners.
 *
 * **Nothing here is the browser's**, which is why it is here rather than in the
 * host: folding results and deciding a status is arithmetic over values. The
 * two things only a page knows are *given* to it — `browser` is what the host
 * calls itself (`navigator.userAgent`), and `duration` is the host's wall
 * clock, which is the run's without being any leaf's: the run yields a
 * macrotask between leaves so the page can paint, and that time belongs to the
 * run (see `RunTotals`).
 *
 * `status` overrides the folded decision, for a run that never reached its
 * leaves — modules that would not load, or a runner that failed — which no leaf
 * result can express. `null` means "let the results decide".
 *
 * @type {(browser: string, duration: number, results: readonly _BrowserTestResult[], status: string | null) => BrowserTestReport}
 */
export const reportOf = (browser, duration, results, status) => {
    const { passed, failed } = results.reduce(addResult, zeroTotals)
    return {
        status: status ?? (failed !== 0 ? 'failed' : 'passed'),
        browser,
        totals: { tests: results.length, passed, failed },
        duration,
        results,
    }
}

/** @type {(module: string, cause: unknown) => Effect<Catch, _BrowserTestResult, never>} */
const failureOf = (module, cause) =>
    mapStep(errorDetails(cause), ([message, stack]) => moduleFailure(module, 0, message, stack))

/**
 * The page's half of a leaf-landed event: the shared {@link TestResult} plus a
 * description of the value it failed with.
 *
 * Describing a thrown value is deliberately each host's, for the reason
 * `TestResult` gives — the browser's report crosses a wire and cannot carry the
 * value, so it reads `message` and `stack` off it here.
 *
 * An expected throw that returned cleanly is the one failure with nothing
 * thrown to describe, which is why the reporter is handed `throws`: the value
 * in the result is what the leaf *returned*, and saying so is more use than
 * printing it.
 *
 * @type {(t: TestResult, r: SandboxResult<unknown>, throws: boolean) => Effect<Catch, _BrowserTestResult, never>}
 */
export const browserResult = (t, r, throws) => {
    if (t.status === 'passed') { return pureOk(t) }
    if (throws) { return pureOk({ ...t, message: 'Expected the proof to throw', stack: '' }) }
    return mapStep(errorDetails(r.result[1]), ([message, stack]) => ({ ...t, message, stack }))
}

/**
 * A {@link LeafReporter} and not a whole {@link Reporter}: the run-ended event
 * is the host's, because the page folds its own report from the rows it
 * collected and times it by its own wall clock.
 *
 * @type {LeafReporter<Catch | Sandbox | _BrowserReport>}
 */
const reporter = {
    // The leaf is announced before it is sandboxed, exactly as `fjs t`
    // announces it: the page renders a pending row and — because the handler
    // yields — the browser paints it before the leaf's body takes the thread.
    // A leaf that blocks now blocks with its own name on screen.
    start: id => report(['start', id]),
    result: (t, r, throws) =>
        step(browserResult(t, r, throws), row => report(['result', row])),
    test: defaultTest,
}

/**
 * A run of one module's already-collected leaves, answering the failure that
 * ended the *run* — as opposed to any test's — or `null`.
 *
 * There is one route to that and no branch for a second: `runEntries` has no
 * error channel, so every failure a leaf's chain met — an operation refusing,
 * the page's own reporting breaking — arrives as `aborted` on the state it
 * answers. That is why the failures collected before it survive.
 *
 * @type {(module: string, entries: readonly _TestAndPath[]) => Effect<Catch | Sandbox | _BrowserReport, _BrowserTestResult | null, never>}
 */
const runEntriesOf = (module, entries) =>
    step(
        runEntries(reporter)(module, entries)(zeroState),
        ({ aborted }) => aborted === null ? pureOk(null) : failureOf(module, aborted))

/**
 * One module: enumerate its export, then run what came out.
 *
 * Enumerating is *user* code — a getter, a proxy — and a value that resists
 * being read has no leaf to attribute the failure to, so it is the module that
 * failed. That is a failed module and not a failed run: the next one still
 * runs. It is announced through `report` like any other row, and only the
 * announcement failing ends the run.
 *
 * The export is read exactly once (catalog item 5), and the modules stay a
 * *list* rather than a map because two entries may share a label and are two
 * runs (item 6).
 *
 * @type {(entry: readonly [string, unknown]) => (ended: _BrowserTestResult | null) => Effect<Catch | Sandbox | _BrowserReport, _BrowserTestResult | null, never>}
 */
const one = ([module, proof]) => ended => {
    // A run that has ended runs nothing more — not this module's leaves, and
    // not the enumeration of its export, which is user code a run that has
    // given up has no business running.
    if (ended !== null) { return pureOk(ended) }
    const collect = /** @type {Effect<Catch, Result<readonly _TestAndPath[], unknown>, never>} */ (
        attempt(() => collectTests([], false, proof)))
    return step(collect, collected =>
        collected[0] === 'error'
            ? step(failureOf(module, collected[1]), failure =>
                resultStep(report(['result', failure]), r =>
                    r[0] === 'ok' ? pureOk(null) : failureOf(module, r[1])))
            : runEntriesOf(module, collected[1]))
}

/**
 * One source: loaded, announced, and folded into the walk's state.
 *
 * Both failures answer as *values*, and the state keeps them apart: an import
 * that failed is this module's failure and the walk goes on, while a page that
 * cannot be told is the run's and stops it.
 *
 * @type {(source: string) => (state: _LoadState) => Effect<Import | _BrowserReport, _LoadState, never>}
 */
const loadOne = source => state => {
    // A walk that has been stopped loads nothing more. The only thing that
    // stops it is the page refusing to be told, and once that has happened
    // there is nothing to gain by *evaluating* the rest of the suite's
    // modules — a module's top-level code runs when it links.
    //
    // No proof pins this: the outcome is the same either way (the run failed
    // as the runner), so what it saves is user code that would have run for a
    // report nobody can see. A mock that counted imports would be asserting
    // its own bookkeeping.
    if (state.stopped !== null) { return pureOk(state) }
    return step(
        resultStep(import_(source), loaded => pureOk(loaded)),
        loaded => mapStep(
            resultStep(report(/** @type {const} */ (['loading', source])), told => pureOk(told)),
            told => {
                if (told[0] === 'error') {
                    return { ...state, stopped: channelFailure([runnerSource, told[1]]) }
                }
                if (loaded[0] === 'error') {
                    return {
                        ...state,
                        rejected: [...state.rejected, channelFailure([source, loaded[1]])],
                    }
                }
                // **The module's `proof` export, not the module.** A namespace
                // handed to the traversal is walked as a proof tree, so every
                // other zero-argument export is *run* as a test and the real
                // proofs land one level deeper, named `.proof.x` instead of
                // `.x`. Running a module's unrelated exports is the part that
                // is not merely wrong output.
                return {
                    ...state,
                    ready: [...state.ready, /** @type {const} */ ([source, loaded[1].proof])],
                }
            }))
}

/** @type {_LoadState} */
const zeroLoad = { ready: [], rejected: [], stopped: null }

/**
 * Loads the suite's modules, one after another, and answers what to do next.
 *
 * **One at a time, deliberately.** The loads used to be fanned out through
 * `all`, which bought a cold page a shorter wait and cost the reader a
 * variadic call whose width the engine limits, an interpreter that had to
 * implement concurrency, and a walk in which no branch knew what any other had
 * done. A sequential fold is the shape the rest of this package already has —
 * `runProofs` below is one — and it makes the walk's own state readable: what
 * has loaded, what would not, and whether the page stopped answering.
 *
 * @type {(sources: readonly string[]) => Effect<Import | _BrowserReport, _LoadOutcome, never>}
 */
export const loadProofs = sources =>
    mapStep(
        foldStep(pureOk(sources), zeroLoad, loadOne),
        ({ ready, rejected, stopped }) => {
            // A page that could not be told takes precedence over a module
            // that would not load: a list assembled for nobody to see is the
            // wrong answer, and the row names the runner because no module is
            // to blame for it.
            if (stopped !== null) { return /** @type {_LoadOutcome} */ (['failed', [stopped]]) }
            // One module that will not link stops the suite: it has no tests to
            // run, and a partial suite reported as a whole one is worse than a
            // refusal.
            return /** @type {_LoadOutcome} */ (rejected.length === 0
                ? ['ready', ready]
                : ['failed', rejected])
        })

/**
 * The name a failure of the *runner* is reported under, when no module is to
 * blame for it: the page could not be told, or — in
 * [`./module.mjs`](./module.mjs), which imports this — broke its own
 * interpreter. One name, because a reader meeting it in a report should not
 * have to learn two.
 */
export const runnerSource = 'the browser runner'

/**
 * A failure that arrived through an **operation's error channel**, as a row.
 *
 * Not `errorDetails`: that reads `message` and `stack` off a value a *test*
 * threw, and a channel error is not one of those — reading it that way spells a
 * tuple, which is how the first version of this described every unloadable
 * module. `errorMessage` is the sentence the channel is for, and every host
 * says it the same way.
 *
 * @type {(f: readonly [string, IoChannel]) => _BrowserTestResult}
 */
const channelFailure = ([source, cause]) => {
    const text = errorMessage(cause)
    return moduleFailure(source, 0, text, text)
}

/**
 * Runs every module and answers how the run ended: `null` when it reached the
 * end, or the failure of the *runner* that stopped it.
 *
 * That failure is answered rather than announced because announcing it is the
 * thing that may have failed. The host places it in the report it folds — where
 * `infrastructure-error` is the status a controller reads to tell "the suite
 * failed" from "the suite could not be run".
 *
 * **The error channel is `never`**, and that is the statement this module
 * exists to make: every failure it can meet is a value it decides about.
 *
 * @type {(modules: readonly (readonly [string, unknown])[]) => Effect<Catch | Sandbox | _BrowserReport, _BrowserTestResult | null, never>}
 */
export const runProofs = modules => foldStep(pureOk(modules), null, one)

/**
 * A report's results as the page shows them: one group per module *run*, in
 * the order the runs happened, with each group's counts.
 *
 * **Consecutive, not keyed.** Two entries may share a label and are two runs
 * (catalog item 6), and a run is sequential, so one run's results are always
 * adjacent: a group starts where the module changes, which is also where the
 * live page starts one. Keying by module would fold two runs into one and
 * reorder whatever ran between them.
 *
 * Linear, because the page calls it on a whole suite: the boundaries are found
 * in one pass and each group is a slice, rather than an append that copies
 * the prefix per result (catalog item 9).
 *
 * @type {(results: readonly _BrowserTestResult[]) => readonly { readonly module: string, readonly results: readonly _BrowserTestResult[], readonly passed: number, readonly failed: number }[]}
 */
export const groupByModule = results => {
    const starts = results.flatMap((result, at) =>
        at === 0 || results[at - 1]?.module !== result.module
            ? [/** @type {const} */ ([at, result.module])]
            : [])
    return starts.map(([start, module], n) => {
        const group = results.slice(start, starts[n + 1]?.[0] ?? results.length)
        const { passed, failed } = group.reduce(addResult, zeroTotals)
        return { module, results: group, passed, failed }
    })
}

/**
 * The counts on a group's line, with the failures first. The module's path is
 * the line's own separate part, so this is only what sits at its right edge.
 *
 * A group that passed is folded, so its line is all a reader sees of it; and a
 * failure is the one count anybody scans for, so it leads rather than trails.
 *
 * @type {(passed: number, failed: number) => string}
 */
export const groupLabel = (passed, failed) =>
    failed === 0 ? `${passed} passed` : `${failed} failed · ${passed} passed`

/**
 * A run's duration as the report's title shows it: milliseconds under a
 * second, seconds from there on. The root page's suite takes the better part
 * of two minutes, and `103812.4 ms` is not a number a reader takes in at a
 * glance where `103.8 s` is.
 *
 * @type {(ms: number) => string}
 */
export const formatDuration = ms => ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(1)} s`

/**
 * A group's status from its counts: `failed` the moment anything failed,
 * `passed` once nothing more will land in it, `running` until then.
 *
 * One rule for both renderers — the view drawing a finished group and the live
 * page relabelling one as its rows land — so the two cannot disagree about
 * when a group has passed.
 *
 * @type {(passed: number, failed: number, settled: boolean) => 'failed' | 'passed' | 'running'}
 */
export const groupStatus = (passed, failed, settled) =>
    failed !== 0 ? 'failed' : settled ? 'passed' : 'running'

/**
 * One row of the report: the verdict, the leaf's name and its time — and, for a
 * failure, the message and stack as a block of their own under it.
 *
 * **The report's markup is these views, and only these views.** The live page
 * turns them into DOM nodes as rows land, and the runner's demo returns them
 * for the demo runtime to render, so a row cannot look one way in a real run
 * and another in the demo: neither of them spells the markup.
 *
 * @type {(result: _BrowserTestResult) => Element}
 */
export const resultView = result => {
    const line = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name} (${result.duration.toFixed(1)} ms)`
    return result.status === 'failed'
        ? ['li', { 'data-status': 'failed' }, line, ['pre', { 'data-test-error': '' }, `${result.message}\n${result.stack}`]]
        : ['li', { 'data-status': 'passed' }, line]
}

/**
 * The row a leaf gets while it runs: its name and no verdict, because there is
 * none yet. `running` rather than a missing status, so a row left in it after a
 * run ends is visibly the test that did not finish.
 *
 * @type {(id: TestId) => Element}
 */
export const pendingView = id => ['li', { 'data-status': 'running' }, `RUN  ${id.name}`]

/**
 * One module's group: a line of a dot, the module's path and its counts, then
 * its rows. Open while running or failed, and folded once it has passed, so
 * what stays open is what needs reading.
 *
 * The list is marked `data-rows` so the live page can find it again to append
 * to without depending on where it sits.
 *
 * @type {(group: { readonly module: string, readonly results: readonly _BrowserTestResult[], readonly passed: number, readonly failed: number }, settled: boolean) => Element}
 */
export const groupView = ({ module, results, passed, failed }, settled) => {
    const status = groupStatus(passed, failed, settled)
    return ['details', { 'data-test-module': module, 'data-status': status, ...(status === 'passed' ? {} : { open: '' }) },
        ['summary',
            ['span', { 'data-dot': '' }],
            ['span', { 'data-path': '' }, module],
            ['span', { 'data-counts': '' }, groupLabel(passed, failed)]],
        ['ol', { 'data-rows': '' }, ...results.map(resultView)]]
}

/**
 * A finished report's groups, each settled.
 *
 * @type {(results: readonly _BrowserTestResult[]) => readonly Element[]}
 */
export const reportView = results => groupByModule(results).map(group => groupView(group, true))

/**
 * A run's counts: green for what passed, red for what failed — only when
 * something did, so a clean run does not carry a zero in the colour that means
 * trouble — and the time.
 *
 * @type {(report: BrowserTestReport) => readonly Element[]}
 */
export const countsView = ({ totals, duration }) => [
    ['span', { 'data-count-passed': '' }, `${totals.passed} passed`],
    ...(totals.failed === 0 ? [] : [/** @type {Element} */ (['span', { 'data-count-failed': '' }, `${totals.failed} failed`])]),
    ['span', { 'data-duration': '' }, formatDuration(duration)],
]
