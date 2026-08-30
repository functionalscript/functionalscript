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
 * @module
 *
 * @import { BrowserTestReport, Reporter, TestResult, _BrowserImporter, _BrowserReport, _BrowserTestResult } from './types.ts'
 * @import { Catch, Sandbox, SandboxResult } from '../effects/common/types.ts'
 * @import { Effect, Func } from '../effects/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { List } from '../types/list/types.ts'
 */

/** The page's leaf-landed operation; see `_BrowserReport`.
 * @type {Func<_BrowserReport>} */
const report = do_('report')

import { addResult, defaultTest, runModuleMap, testResult, zeroTotals } from './module.f.mjs'
import { asyncRun } from '../effects/module.mjs'
import { do_, pureOk } from '../effects/module.f.mjs'
import { commonOperationMap } from '../effects/common/module.mjs'
import { concat, toArray } from '../types/list/module.f.mjs'
import { error as errorResult, invert, ok } from '../types/result/module.f.mjs'

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
 * @type {(t: TestResult, r: SandboxResult<unknown>, throws: boolean) => _BrowserTestResult}
 */
const browserResult = (t, r, throws) => {
    if (t.status === 'passed') { return t }
    if (throws) { return { ...t, message: 'Expected the proof to throw', stack: '' } }
    const [message, stack] = errorDetails(r.result[1])
    return { ...t, message, stack }
}

/**
 * The run-ended event, as the page reports it. The counts — and with them the
 * run's own pass/fail status — come from folding the results with the same
 * `addResult` that decides `fjs t`'s summary and exit code, so "did the run
 * pass" has one answer across the runners. `duration` stays the page's own
 * wall clock: the run yields a macrotask between leaves so the page can paint,
 * and that time is the run's without being any leaf's (see `RunTotals`).
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
    // A `List` joined with `concat`, not an array appended to: this collects
    // one entry per leaf and an immutable append would copy the prefix every
    // time — catalog item 9, which the sequential traversal does not grant for
    // free.
    /** @type {List<_BrowserTestResult>} */
    let landed = null
    /** @type {(value: _BrowserTestResult) => void} */
    const announce = value => {
        landed = concat(landed)([value])
        try {
            result(value)
        } catch {
            // The result stays in the report the run resolves with.
        }
    }
    /** @type {Reporter<_BrowserReport | Sandbox>} */
    const reporter = {
        // No pending row yet: the page renders a leaf once it has settled. The
        // start event is where that changes, and it is
        // `todo/report-before-running.md`'s remaining task rather than this
        // port's.
        start: () => pureOk(undefined),
        result: (t, r, throws) => report(browserResult(t, r, throws)),
        // The page folds its own report from the results it collected, and its
        // `duration` is wall clock rather than the summed one — see `reportOf`.
        summary: () => pureOk(undefined),
        test: defaultTest,
    }
    /** @type {<T, E>(e: Effect<Catch | _BrowserReport | Sandbox, T, E>) => Promise<Result<T, E>>} */
    const run = asyncRun({
        ...commonOperationMap,
        // **The page's only operation, and the port's only scheduling.** The
        // await is a real macrotask boundary: a run is otherwise one
        // uninterruptible task, and a browser paints nothing until it ends. It
        // replaces what `batchSize = 25` was doing without being asked to, and
        // yields per leaf rather than per twenty-five, so a row appears as its
        // test finishes.
        report: async (/** @type {_BrowserTestResult} */ value) => {
            announce(value)
            await new Promise(resolve => { setTimeout(resolve, 0) })
            return ok(undefined)
        },
    })
    /**
     * One module at a time, and the two reasons are unrelated.
     *
     * **Duplicate labels.** The page's modules are a *list*: two entries can
     * share a label and are two runs. A record-shaped `ModuleMap` keeps only
     * the last of them, so a map of one module per call is what preserves the
     * list — the mistake `todo/share-browser-console-runner.md` catalogs as
     * item 6, avoided by construction rather than by care.
     *
     * **The exported tree is read unguarded by the traversal**, deliberately:
     * there is no leaf to attribute a failure to, so an unreadable `proof`
     * export belongs to whatever loaded the module
     * (`todo/hostile-proof-values.md`). That read happens inside the effect, so
     * it reaches here as a rejection, and one module failing to enumerate is
     * one failed module rather than a run with no report. Pre-reading to check
     * would enumerate twice, and enumerating is user code (catalog item 5).
     *
     * @type {(module: readonly [string, unknown]) => Promise<void>}
     */
    const one = async ([module, proof]) => {
        try {
            await run(runModuleMap(reporter)({ [module]: { proof } }))
        } catch (error) {
            const [message, stack] = errorDetails(error)
            announce(moduleFailure(module, 0, message, stack))
        }
    }
    /** @type {(rest: readonly (readonly [string, unknown])[]) => Promise<void>} */
    const walk = async rest => {
        if (rest.length === 0) { return }
        const [first, ...tail] = rest
        await one(first)
        return walk(tail)
    }
    // Nothing that runs user code may start before the caller holds the
    // promise: a leaf executes synchronously inside its handler, so without
    // this deferral the first proofs run while this function is still building
    // what it returns, and a proof reading `fjsBrowserTestReport` would see the
    // previous run's promise. Catalog item 7.
    return Promise.resolve()
        .then(() => walk(modules))
        .then(() => reportOf(performance.now() - start, toArray(landed)))
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
