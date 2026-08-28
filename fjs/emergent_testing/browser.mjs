/**
 * Browser-native proof execution and report rendering.
 *
 * The module deliberately has no Node dependencies: generated applications
 * import it directly as an ES module in the browser.
 * Proof failures resolve the published report with `status: 'failed'`; an
 * automated outer controller is responsible for consuming that status and
 * choosing a nonzero process exit code.
 *
 * Every DOM entry point reaches the page through the `root` element it is
 * given — `root.ownerDocument` and its `defaultView` — never through the
 * runner realm's own `window`/`document`. A page embedding the suite in an
 * iframe therefore renders into that frame, and a proof can drive the module
 * with a stand-in root.
 *
 * @import { BrowserTestReport, Reporter, TestResult, _BrowserImporter, _BrowserReport, _BrowserTestResult, _TestAndPath } from './types.ts'
 * @import { Effect, Func, ToAsyncOperationMap } from '../effects/types.ts'
 * @import { All, Catch, IoChannel, Sandbox, SandboxResult } from '../effects/node/types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { addResult, collectTests, defaultTest, runEntries, zeroTotals } from './module.f.mjs'
import { browserRun } from '../effects/browser/module.mjs'
import { allOk } from '../effects/node/module.f.mjs'
import { do_, mapStep, pureOk } from '../effects/module.f.mjs'
import { ok } from '../types/result/module.f.mjs'

/** @type {(value: unknown) => string} */
const text = value => {
    try {
        return String(value)
    } catch {
        return 'Unknown thrown value'
    }
}

/**
 * The message and stack to report a thrown value by.
 *
 * An Error thrown from another realm — an iframe, a worker — is not
 * `instanceof Error` here, and its stack is the very thing the report exists to
 * carry. What the fields say is therefore the test, not where the value was
 * made: anything carrying `message` or `stack` is read as the failure it
 * describes, and everything else by its own text.
 *
 * @type {(error: unknown) => readonly [string, string]}
 */
const errorDetails = error => {
    try {
        if (error !== null && (typeof error === 'object' || typeof error === 'function')
            && ('message' in error || 'stack' in error)) {
            const { message, stack } = /** @type {{ readonly message?: unknown, readonly stack?: unknown }} */ (error)
            const described = text(message)
            return [described, stack === undefined ? described : text(stack)]
        }
    } catch {
        // Reading the fields, and asking whether they are there at all, are
        // user-observable operations: revoked proxies and accessors can throw
        // while the failure is inspected.
    }
    const fallback = text(error)
    return [fallback, fallback]
}

/**
 * A failure of a whole module — one that will not link, or whose `proof` export
 * cannot be enumerated. It does not go through `testResult`, and that is the
 * point: there is no leaf here, so there is no path and no `fmtImport` name to
 * build. What is known about it is its source, so its source is its name.
 *
 * It is still a `TestResult`, and still counted, because a report whose totals
 * disagreed with its `results` would tell an automated consumer that the suite
 * was empty rather than that it was broken. The cost is that a consumer cannot
 * assume every entry names a leaf — which is why {@link TestResult} says so.
 * Whether these belong in a variant of their own is part of the report-shape
 * decision `todo/share-browser-console-runner.md` tracks, and is deliberately
 * not settled here.
 *
 * @type {(source: string, duration: number, message: string, stack: string) => _BrowserTestResult}
 */
const moduleFailure = (source, duration, message, stack) => ({
    module: source, path: '', name: source, status: 'failed', duration, message, stack,
})

/**
 * The `report` operation's constructor: hand one leaf record to the page.
 *
 * @type {Func<_BrowserReport>}
 */
const report = do_('report')

/**
 * The page's leaf record, built from what the shared traversal decided.
 *
 * `t` arrives already decided — identity, status and duration all come from
 * `testResult` inside the traversal — so the only thing left here is the part
 * `TestResult` deliberately leaves to each host: how to *describe* a failure.
 * A passing leaf needs no description; a failing one is described from the
 * value, except for the one case a value cannot describe, where a proof marked
 * `throw` returned instead of throwing and the failure is the absence of a
 * throw rather than anything thrown.
 *
 * @type {(t: TestResult, r: SandboxResult<unknown>, throws: boolean) => _BrowserTestResult}
 */
const browserResult = (t, r, throws) => {
    if (t.status === 'passed') { return t }
    if (throws) {
        return { ...t, message: 'Expected the proof to throw', stack: '' }
    }
    const [message, stack] = errorDetails(r.result[1])
    return { ...t, message, stack }
}

/**
 * The page's half of the shared runner.
 *
 * `test` is `defaultTest` — the same sandboxing and the same `invert` `fjs t`
 * uses — so "did this leaf pass" is not decided here at all. `result` builds
 * the page's record and hands it to the `report` operation, whose value the
 * traversal keeps in structural order. `summary` has nothing to do: the page
 * renders its report from the outcome it is handed, rather than from an event
 * telling it the run ended.
 *
 * @type {Reporter<Sandbox | _BrowserReport, _BrowserTestResult>}
 */
const browserReporter = {
    test: defaultTest,
    result: (t, r, throws) => report(browserResult(t, r, throws)),
    summary: () => pureOk(undefined),
}

/**
 * The run-ended event, as the page reports it. The counts — and with them the
 * run's own pass/fail status — come from folding the results with the same
 * `addResult` that decides `fjs t`'s summary and exit code, so "did the run
 * pass" has one answer across the runners. `duration` stays the page's own
 * wall clock: leaves run concurrently here, so the fold's summed duration is
 * not how long the run took (see `RunTotals`).
 *
 * `status` overrides the folded decision when the run never got to its leaves
 * — module loading failed — which no leaf result can express.
 *
 * @type {(duration: number, results: readonly _BrowserTestResult[], status?: string) => BrowserTestReport} */
const reportOf = (duration, results, status = undefined) => {
    const { passed, failed } = results.reduce(addResult, zeroTotals)
    return {
        status: status ?? (failed !== 0 ? 'failed' : 'passed'),
        browser: navigator.userAgent,
        totals: { tests: results.length, passed, failed },
        duration,
        results,
    }
}

/**
 * Runs named proof exports and returns the serializable browser report.
 *
 * `result` is the page's subscription to the leaf-landed event — the same
 * event `fjs t`'s `Reporter.result` carries, a shared `TestResult` plus the
 * browser's own `message`/`stack` part — and the resolved report is its
 * run-ended event, with totals folded by the shared `addResult`.
 *
 * @type {(modules: readonly (readonly [string, unknown])[], result?: (result: _BrowserTestResult) => void) => Promise<BrowserTestReport>}
 */
export const runBrowserProofs = (modules, result = () => undefined) => {
    const start = performance.now()
    // Reporting each result as it lands is the page's own code. A renderer that
    // throws must not take the run down with it: the report it fails to show is
    // the one thing the page is still waiting for.
    /** @type {(result: _BrowserTestResult) => void} */
    const announce = value => {
        try {
            result(value)
        } catch {
            // The result stays in the report the run resolves with.
        }
    }
    // Reading a module's exported tree runs user code, and the shared traversal
    // deliberately does not guard that one: there is no leaf to attribute it
    // to, so `fjs t` panics and the page does this instead. A module that
    // cannot be enumerated is one failed module, never a run that ends without
    // a report. See `todo/hostile-proof-values.md`.
    //
    // The export is read **once**, here, and the leaves go on to `runEntries`:
    // enumerating is not idempotent, so a preliminary read that only checked
    // whether the tree can be enumerated would run every getter in it a second
    // time — and a getter that succeeds once and throws next would escape as a
    // synchronous throw, leaving the page in `running` with no report at all.
    /** @type {readonly (readonly ['ok', string, readonly _TestAndPath[]] | readonly ['failed', _BrowserTestResult])[]} */
    const prepared = modules.map(([module, proof]) => {
        try {
            return /** @type {const} */ (['ok', module, collectTests([], false, proof)])
        } catch (error) {
            const [message, stack] = errorDetails(error)
            return /** @type {const} */ (['failed', moduleFailure(module, 0, message, stack)])
        }
    })
    // The page's modules are a *list*, and nothing stops it naming the same
    // module twice: two entries with one label are two runs, in the order they
    // were passed, so they are run as a list rather than folded into a map
    // keyed by name.
    /** @type {(e: (typeof prepared)[number]) => Effect<Sandbox | Catch | All | _BrowserReport, readonly _BrowserTestResult[], IoChannel>} */
    const runOne = e => e[0] === 'ok'
        ? mapStep(runEntries(browserReporter)(e[1], e[2]), o => o.results)
        // A module failure has no leaf to be reported by, so it is handed to
        // the same `report` operation directly: the page renders it as it
        // lands, in the position the module was passed in, exactly like a leaf.
        : mapStep(report(e[1]), r => /** @type {readonly _BrowserTestResult[]} */ ([r]))
    const all = mapStep(allOk(...prepared.map(runOne)), lists => lists.flat())
    /** @type {ToAsyncOperationMap<_BrowserReport>} */
    const page = {
        // The page's end of the `report` operation: render as it lands, and
        // answer the record back so the traversal can keep it in order.
        report: async r => {
            announce(r)
            return ok(r)
        },
    }
    const run = browserRun(page)
    /**
     * The run failed as a *runner*, not as a proof. Reporting it as the run's
     * own failure keeps the page out of `running` forever, which is the one
     * outcome a page must never reach.
     *
     * @type {(e: unknown) => BrowserTestReport}
     */
    const infrastructureError = e => {
        const [message, stack] = errorDetails(e)
        const failure = moduleFailure('', performance.now() - start, message, stack)
        announce(failure)
        return reportOf(performance.now() - start, [failure], 'infrastructure-error')
    }
    // Both ways a run can fail as a runner end here. The error channel carries
    // what an operation reported; the rejection carries what the interpreter
    // could not answer at all — `asyncRun` panics on a command no handler
    // claims, so a traversal or reporter that grew an operation this page does
    // not implement arrives as a rejected promise rather than an `error`.
    // Neither may escape: an unhandled rejection is a page stuck in `running`
    // with no report and no completion event.
    return run(all).then(outcome => {
        if (outcome[0] === 'error') {
            return infrastructureError(outcome[1])
        }
        // `allOk` answers in argument order, so the records are already in the
        // order the page passed its modules in, with each module's leaves in
        // structural order inside it.
        return reportOf(performance.now() - start, outcome[1])
    }, infrastructureError)
}

/** @type {(root: Element) => (Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }) | null} */
const viewOf = root => root.ownerDocument.defaultView

/**
 * Renders the settled report into the page, publishes the run as
 * `fjsBrowserTestReport` on the root's window, and announces it with
 * `fjs-browser-test-complete`.
 *
 * @type {(root: Element, report: Promise<BrowserTestReport>) => Promise<BrowserTestReport>}
 */
const publish = (root, report) => {
    const view = viewOf(root)
    const done = report.then(value => {
        renderBrowserReport(root, value)
        view?.dispatchEvent(new CustomEvent('fjs-browser-test-complete', { detail: value }))
        return value
    })
    if (view !== null) { view.fjsBrowserTestReport = done }
    return done
}

/**
 * Loads proof modules after the page has rendered, reporting module-loading
 * progress before proof execution begins.
 *
 * @type {(root: Element, sources: readonly string[], importer: _BrowserImporter) => Promise<BrowserTestReport>}
 */
export const startBrowserTestSources = (root, sources, importer) => {
    /** @typedef {{ readonly status: 'loaded', readonly source: string, readonly proof: unknown } | { readonly status: 'error', readonly source: string, readonly error: unknown }} _LoadedModule */
    const start = performance.now()
    setState(root, 'loading')
    let loaded = 0
    const summary = root.querySelector('[data-test-summary]')
    // Set synchronously, before any import settles: otherwise the page keeps
    // showing its idle text throughout loading — indefinitely, if a module
    // import never settles — even though the state and control already
    // changed.
    if (summary !== null) { summary.textContent = `Loading 0/${sources.length}` }
    // The importer is supplied by the page, so obtaining the promise is itself
    // a failure point: a synchronous throw becomes a rejection here and is
    // reported as a loader failure, rather than escaping past a `loading` state
    // that no report or completion event ever replaces.
    /** @type {(source: string) => Promise<{ readonly proof?: unknown }>} */
    const load = source => {
        try {
            return importer(source)
        } catch (error) {
            return Promise.reject(error)
        }
    }
    /** @type {Promise<readonly _LoadedModule[]>} */
    const modules = Promise.all(sources.map(source => load(source).then(
        module => {
            loaded += 1
            if (summary !== null) { summary.textContent = `Loading ${loaded}/${sources.length}: ${source}` }
            return /** @type {const} */ ({ status: 'loaded', source, proof: module.proof })
        },
        error => /** @type {const} */ ({ status: 'error', source, error })
    )))
    const report = modules.then(loadedModules => {
        const rejected = loadedModules.flatMap(module =>
            module.status === 'error' ? [module] : [])
        if (rejected.length !== 0) {
            // A module that never linked has no tests to run, so the run stops
            // here. Each rejection is still counted as a failed result: totals
            // that disagreed with `results` would tell an automated consumer
            // the suite was empty rather than broken.
            const duration = performance.now() - start
            return publish(root, Promise.resolve(reportOf(duration,
                rejected.map(({ source, error }) => {
                    const [message, stack] = errorDetails(error)
                    return moduleFailure(source, duration, message, stack)
                }),
                'infrastructure-error')))
        }
        return startBrowserTests(root, loadedModules.flatMap(module =>
            module.status === 'loaded'
                ? [/** @type {const} */ ([module.source, module.proof])]
                : []))
    })
    const view = viewOf(root)
    if (view !== null) { view.fjsBrowserTestReport = report }
    return report
}

/**
 * Sets the runner state and keeps the `Run` control's real disabled state in
 * sync with it: passive while a suite is loading or running, active in every
 * other state (idle, or any terminal status). A disabled attribute is used
 * rather than a click handler that silently ignores the action, so assistive
 * technology sees the same unavailability a sighted user does.
 *
 * @type {(root: Element, state: string) => void}
 */
const setState = (root, state) => {
    root.setAttribute('data-state', state)
    const runButton = root.querySelector('[data-test-run]')
    if (runButton !== null) {
        if (state === 'loading' || state === 'running') {
            runButton.setAttribute('disabled', '')
        } else {
            runButton.removeAttribute('disabled')
        }
    }
}

/**
 * Renders a completed report in the browser test page.
 *
 * @type {(root: Element, report: BrowserTestReport) => void}
 */
export const renderBrowserReport = (root, report) => {
    setState(root, report.status)
    const summary = root.querySelector('[data-test-summary]')
    if (summary !== null) {
        summary.textContent = report.status === 'infrastructure-error'
            ? `Infrastructure error: ${report.totals.failed} failed to load (${report.duration.toFixed(1)} ms)`
            : `${report.totals.passed} passed, ${report.totals.failed} failed (${report.duration.toFixed(1)} ms)`
    }
    const output = root.querySelector('[data-test-results]')
    if (output !== null) {
        output.replaceChildren(...report.results.map(result =>
            renderResult(root.ownerDocument, result)))
    }
}

/** @type {(document: Document, result: _BrowserTestResult) => HTMLLIElement} */
const renderResult = (document, result) => {
    const item = document.createElement('li')
    item.setAttribute('data-status', result.status)
    const detail = result.status === 'failed' ? `: ${result.message}\n${result.stack}` : ''
    item.textContent = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name} (${result.duration.toFixed(1)} ms)${detail}`
    return item
}

/**
 * Runs the application, publishes its promise as `window.fjsBrowserTestReport`,
 * and dispatches `fjs-browser-test-complete` with the report in `detail`.
 *
 * @type {(root: Element, modules: readonly (readonly [string, unknown])[]) => Promise<BrowserTestReport>}
 */
export const startBrowserTests = (root, modules) => {
    setState(root, 'running')
    const output = root.querySelector('[data-test-results]')
    if (output !== null) { output.replaceChildren() }
    let completed = 0
    return publish(root, runBrowserProofs(modules, result => {
        completed += 1
        const summary = root.querySelector('[data-test-summary]')
        if (summary !== null) { summary.textContent = `${completed} tests completed…` }
        if (output !== null) { output.append(renderResult(root.ownerDocument, result)) }
    }))
}
