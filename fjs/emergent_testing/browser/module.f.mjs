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
 * it are recorded in `../todo/share-browser-console-runner.md`, and both
 * reached outside the proof's own values. Behind `report`, a runner that simply
 * refuses the operation produces it, with nothing injected and nothing global
 * touched.
 *
 * @module
 *
 * @import {
 *     BrowserTestReport, LeafReporter, Reporter, TestResult, _BrowserEvent,
 *     _BrowserReport, _BrowserTestResult, _LoadOutcome, _TestAndPath,
 * } from '../types.ts'
 * @import { All, Catch, Import, Module, Sandbox, SandboxResult } from '../../effects/common/types.ts'
 * @import { Effect, Func, IoChannel, NotImplemented } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { all, catch_, import_ } from '../../effects/common/module.f.mjs'
import { addResult, collectTests, defaultTest, runEntries, zeroState, zeroTotals } from '../module.f.mjs'
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
 * The text of a value that may not want to be read. `String` runs user code —
 * a `toString`, a proxy trap — so it is attempted rather than called.
 *
 * @type {(value: unknown) => Effect<Catch, string, never>}
 */
const text = value =>
    mapStep(
        attempt(() => String(value)),
        r => r[0] === 'ok' ? /** @type {string} */(r[1]) : 'Unknown thrown value')

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
    // No pending row yet: the page renders a leaf once it has settled. The
    // start event is where that changes, and it is
    // `../todo/report-before-running.md`'s remaining task.
    start: () => pureOk(undefined),
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
 * One module loaded, and the page told that it arrived.
 *
 * Both halves answer as *values*: an import that failed is this module's
 * failure and not the walk's, and a page that cannot be told is the run's
 * failure rather than this module's. Keeping them apart here is what lets the
 * fold below decide which of the two happened without a channel to inspect.
 *
 * @type {(source: string) => Effect<Import | _BrowserReport, readonly [string, Result<Module, IoChannel>, Result<void, NotImplemented>], never>}
 */
const loadOne = source =>
    step(
        resultStep(import_(source), loaded => pureOk(loaded)),
        loaded => resultStep(
            report(/** @type {const} */ (['loading', source])),
            told => pureOk(/** @type {const} */ ([source, loaded, told]))))

/**
 * Loads the suite's modules, in parallel, and answers what to do next.
 *
 * **The fan-out is the interpreter's.** `all` says these may run at once; a
 * page implements it with `Promise.all` and keeps the concurrency the loading
 * always had, while a runner without concurrency answers them in turn and
 * reads the same. That is the whole reason this walk can be pure without
 * making a page load 141 modules one after another.
 *
 * A refused `all` is the run's failure and not any module's, so it is answered
 * as one: there is nothing to load with, and no source to blame.
 *
 * @type {(sources: readonly string[]) => Effect<All | Catch | Import | _BrowserReport, _LoadOutcome, never>}
 */
export const loadProofs = sources =>
    step(
        resultStep(all(...sources.map(loadOne)), fanned => pureOk(fanned)),
        fanned => fanned[0] === 'error'
            ? pureOk(/** @type {const} */ ([
                'failed',
                [channelFailure([runnerSource, fanned[1]])],
            ]))
            : collect(fanned[1]))

/**
 * The name a failure of the *runner* is reported under, when no module is to
 * blame for it: the page could not be told, could not fan out, or — in
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
 * Folds what the loads answered into one outcome.
 *
 * A page that could not be told takes precedence over a module that would not
 * load, and stops the walk: a run whose reporting is broken cannot describe
 * the modules that failed either, so the honest answer is the reporting
 * failure rather than a list assembled for nobody to see.
 *
 * @type {(loads: readonly Result<readonly [string, Result<Module, IoChannel>, Result<void, NotImplemented>], never>[]) => Effect<never, _LoadOutcome, never>}
 */
const collect = loads => {
    const values = loads.map(l => l[1])
    const untold = values.find(([, , told]) => told[0] === 'error')
    if (untold !== undefined) {
        return pureOk(/** @type {const} */ ([
            'failed',
            [channelFailure([runnerSource, /** @type {NotImplemented} */ (untold[2][1])])],
        ]))
    }
    const rejected = values.flatMap(([source, loaded]) =>
        loaded[0] === 'error' ? [/** @type {const} */ ([source, loaded[1]])] : [])
    const ready = values.flatMap(([source, loaded]) =>
        loaded[0] === 'ok' ? [/** @type {const} */ ([source, loaded[1]])] : [])
    // One module that will not link stops the suite: it has no tests to run,
    // and a partial suite reported as a whole one is worse than a refusal.
    return pureOk(rejected.length === 0
        ? /** @type {const} */ (['ready', ready])
        : /** @type {const} */ (['failed', rejected.map(channelFailure)]))
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
