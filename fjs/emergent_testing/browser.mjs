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
 * @import { BrowserTestReport, TestResult, _BrowserImporter, _BrowserTestResult, _TestAndPath } from './types.ts'
 * @import { Result } from '../types/result/types.ts'
 */

import { collectTests, testResult } from './module.f.mjs'
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

/** @type {(module: string, path: readonly (string | null)[], throws: boolean, fn: () => unknown, result: (result: _BrowserTestResult) => void) => Promise<readonly _BrowserTestResult[]>} */
const runOne = (module, path, throws, fn, result) => {
    const start = performance.now()
    // The throw expectation is applied with the same `invert` the console
    // runner's `defaultTest` uses, and the status is then read off the result by
    // the same `testResult`. Both runners therefore answer "did this leaf pass"
    // in one place — the rule that used to be spelled out at four sites here and
    // once again over there.
    /** @type {(o: Result<unknown, unknown>, duration: number) => TestResult} */
    const leaf = (o, duration) =>
        testResult(module, path, { result: throws ? invert(o) : o, duration })
    /** @type {(value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[]} */
    const passed = value => {
            const duration = performance.now() - start
            if (throws) {
                const failure = { ...leaf(ok(value), duration),
                    message: 'Expected the proof to throw', stack: '' }
                result(failure)
                return [failure]
            }
            // Reading the returned tree runs user code: an enumerable getter
            // or a proxy trap can throw. That is a failure of the test that
            // produced the value, never of the run — a rejected run leaves the
            // page in `running` with no report and no completion event.
            /** @type {readonly _TestAndPath[]} */
            let children
            try {
                children = collectTests([...path, null], false, value)
            } catch (error) {
                return failed(error)
            }
            return Promise.all(children.map(([childPath, child]) =>
                runOne(module, childPath, child.throws, child.fn, result)
            )).then(results => {
                const success = leaf(ok(value), duration)
                result(success)
                return [success, ...results.flat()]
            })
        }
    /** @type {(error: unknown) => readonly _BrowserTestResult[]} */
    const failed = error => {
            const duration = performance.now() - start
            if (throws) {
                const success = leaf(errorResult(error), duration)
                result(success)
                return [success]
            }
            const [message, stack] = errorDetails(error)
            const failure = { ...leaf(errorResult(error), duration), message, stack }
            result(failure)
            return [failure]
        }
    // `instanceof Promise`, then `await` — the whole of `fjs t`'s promise
    // handling, spelled the same way here.
    //
    // It is deliberately not more than that. A promise can replace its own
    // `then`, present a `constructor` that is not the intrinsic `Promise`, or
    // carry a `Symbol.species` that fails, and each of those defeats `await` in
    // a different way. Defending against them takes about 150 lines, none of
    // which authored FunctionalScript can reach: it has no `Promise`, no
    // `class`, no `Proxy` and no `Symbol`. `todo/imports-promises-realms.md`
    // records each case, what the deleted machinery did about it, and what a
    // runner does without it — to be implemented when an input that needs it
    // actually exists.
    //
    // The value is wrapped in a tuple first so that resolving it cannot
    // assimilate a proof tree carrying a `then` key: such a tree is a sub-tree
    // with a test called `then` in it, in both runners.
    //
    // What makes this enough is the `await` above, not an assumption about the
    // values that reach it. FunctionalScript as specified has no promises, and
    // the browser suite selects `.f.mjs` — but that selection is by filename
    // with no content check (`website/browser-prepare.mjs`), so a module that
    // does not conform is still loaded and can return one. The handling here is
    // correct either way. See `todo/imports-promises-realms.md` for the
    // machinery this replaces and the measurements behind removing it.
    /** @type {(value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[]} */
    const settled = async value => {
        // Even the brand check runs user code: `instanceof` consults
        // `getPrototypeOf`, which a proxy can trap and a revoked one always
        // throws from. `fjs t` performs this check inside `sandbox`'s
        // `try`/`catch`, so it reports such a value as its test's failure; this
        // handler has no enclosing `try`, so without one here the whole run
        // rejects and the page never leaves `running`.
        let isPromise = false
        try {
            isPromise = value instanceof Promise
        } catch (error) {
            return failed(error)
        }
        if (!isPromise) { return passed(value) }
        /** @type {readonly [unknown]} */
        let resolved
        // Only the `await` is guarded. A throw from `passed` is the traversal's
        // own and has its own handling; catching it here would report a broken
        // proof tree as a rejected promise.
        try {
            resolved = [await value]
        } catch (error) {
            return failed(error)
        }
        return passed(resolved[0])
    }
    return Promise.resolve().then(() => [fn()]).then(([value]) => settled(value), failed)
}

/** @type {(status: string, duration: number, results: readonly _BrowserTestResult[]) => BrowserTestReport} */
const reportOf = (status, duration, results) => {
    const failed = results.filter(result => result.status === 'failed').length
    return {
        status,
        browser: navigator.userAgent,
        totals: { tests: results.length, passed: results.length - failed, failed },
        duration,
        results,
    }
}

/**
 * Runs named proof exports and returns the serializable browser report.
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
    /** @type {(module: string, error: unknown) => () => Promise<readonly _BrowserTestResult[]>} */
    const unreadable = (module, error) => () => {
        const [message, stack] = errorDetails(error)
        const failure = moduleFailure(module, 0, message, stack)
        announce(failure)
        return Promise.resolve([failure])
    }
    const tests = modules.flatMap(([module, proof]) => {
        // Reading an exported tree runs user code just as reading a returned
        // one does. A module that cannot be enumerated is one failed module,
        // never a run that ends without a report.
        try {
            return collectTests([], false, proof).map(([path, entry]) =>
                () => runOne(module, path, entry.throws, entry.fn, announce)
            )
        } catch (error) {
            return [unreadable(module, error)]
        }
    })
    const batchSize = 25
    /** @type {(index: number, results: readonly _BrowserTestResult[]) => Promise<readonly _BrowserTestResult[]>} */
    const runBatch = (index, results) => {
        const batch = tests.slice(index, index + batchSize)
        if (batch.length === 0) { return Promise.resolve(results) }
        return Promise.all(batch.map(test => test())).then(next =>
            new Promise(resolve => setTimeout(resolve, 0, [...results, ...next.flat()]))
        ).then(next => runBatch(index + batchSize, next))
    }
    const completed = runBatch(0, [])
    return completed.then(results => reportOf(
        results.some(result => result.status === 'failed') ? 'failed' : 'passed',
        performance.now() - start,
        results,
    ))
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
            return publish(root, Promise.resolve(reportOf('infrastructure-error', duration,
                rejected.map(({ source, error }) => {
                    const [message, stack] = errorDetails(error)
                    return moduleFailure(source, duration, message, stack)
                }))))
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
