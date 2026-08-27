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
 */

import { collectTests, fmtPath } from './module.f.mjs'

/** @type {(value: unknown) => string} */
const text = value => {
    try {
        return String(value)
    } catch {
        return 'Unknown thrown value'
    }
}

/** @type {(error: unknown) => readonly [string, string]} */
const errorDetails = error => {
    try {
        if (error instanceof Error) {
            const message = text(error.message)
            return [message, error.stack === undefined ? message : text(error.stack)]
        }
    } catch {
        // Error identity checks and Error fields are user-observable operations:
        // revoked proxies and accessors can throw while the failure is inspected.
    }
    const fallback = text(error)
    return [fallback, fallback]
}

/** @typedef {{ readonly module: string, readonly path: string, readonly status: string, readonly duration: number, readonly message?: string, readonly stack?: string }} _BrowserTestResult */
/** @typedef {{ readonly status: string, readonly browser: string, readonly totals: { readonly tests: number, readonly passed: number, readonly failed: number }, readonly duration: number, readonly results: readonly _BrowserTestResult[] }} BrowserTestReport */

/**
 * Runs the intrinsic Promise `then` only for genuine promises. The first call
 * is both the native brand check and the normal await path, so arbitrary proof
 * objects with a `then` key are never assimilated.
 *
 * A genuine Promise can still throw after passing the brand check if species
 * construction fails. In that case, temporarily shadow `constructor` with the
 * current realm's Promise and retry the same intrinsic call; the shadow is
 * removed immediately after the handlers are attached.
 *
 * A promise that pins its own `constructor` leaves nothing to shadow, so no
 * subscription is possible at all. The species failure is then reported
 * against the test that produced the promise — the same outcome `await` gives
 * it in the Node runner — because a result nobody can observe is not a pass.
 *
 * @type {(value: unknown, fulfilled: (value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[], rejected: (error: unknown) => readonly _BrowserTestResult[]) => Promise<readonly _BrowserTestResult[]> | null}
 */
const runPromise = (value, fulfilled, rejected) => {
    const call = () => /** @type {Promise<readonly _BrowserTestResult[]>} */ (
        Reflect.apply(Promise.prototype.then, value, [fulfilled, rejected]))
    try {
        return call()
    } catch (error) {
        // Either `value` is not a promise and the brand check rejected it
        // before any handler was attached, or it is a genuine promise that
        // failed while constructing the result through Symbol.species. Only
        // the second case is worth a retry, and `then` attaches nothing before
        // it throws, so the retry cannot run the handlers twice.
        try {
            if (Object.prototype.toString.call(value) !== '[object Promise]') { return null }
        } catch {
            return null
        }
        if (value === null || (typeof value !== 'object' && typeof value !== 'function')) { return null }
        /** @type {PropertyDescriptor | undefined} */
        let descriptor
        try {
            descriptor = Object.getOwnPropertyDescriptor(value, 'constructor')
            Object.defineProperty(value, 'constructor', { value: Promise, configurable: true })
        } catch {
            // A pinned `constructor`: the promise cannot be subscribed to, so
            // its test fails on the species error instead of passing on a
            // value that was never awaited.
            return Promise.resolve(rejected(error))
        }
        try {
            return call()
        } catch {
            // The intrinsic `constructor` cannot fail the retry, so the brand
            // check did: `value` only claims to be a promise and is walked as
            // an ordinary proof result.
            return null
        } finally {
            try {
                if (descriptor === undefined) {
                    Reflect.deleteProperty(value, 'constructor')
                } else {
                    Object.defineProperty(value, 'constructor', descriptor)
                }
            } catch {
                // The temporary property is configurable, so ordinary objects
                // restore cleanly. A hostile Proxy can make restoration itself
                // observable.
            }
        }
    }
}

/** @type {(module: string, path: readonly (string | null)[], throws: boolean, fn: () => unknown, result: (result: _BrowserTestResult) => void) => Promise<readonly _BrowserTestResult[]>} */
const runOne = (module, path, throws, fn, result) => {
    const start = performance.now()
    /** @type {(value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[]} */
    const passed = value => {
            const duration = performance.now() - start
            if (throws) {
                const failure = { module, path: fmtPath(path), status: 'failed', duration,
                    message: 'Expected the proof to throw', stack: '' }
                result(failure)
                return [failure]
            }
            const children = collectTests([...path, null], false, value)
            return Promise.all(children.map(([childPath, child]) =>
                runOne(module, childPath, child.throws, child.fn, result)
            )).then(results => {
                const success = { module, path: fmtPath(path), status: 'passed', duration }
                result(success)
                return [success, ...results.flat()]
            })
        }
    /** @type {(error: unknown) => readonly _BrowserTestResult[]} */
    const failed = error => {
            const duration = performance.now() - start
            if (throws) {
                const success = { module, path: fmtPath(path), status: 'passed', duration }
                result(success)
                return [success]
            }
            const [message, stack] = errorDetails(error)
            const failure = { module, path: fmtPath(path), status: 'failed', duration, message, stack }
            result(failure)
            return [failure]
        }
    // Wrap the raw return so Promise resolution does not assimilate arbitrary
    // objects with a `then` proof property. The Node runner awaits only actual
    // promises, and browser execution must preserve that same test-tree rule.
    return Promise.resolve().then(() => [fn()]).then(
        ([value]) => runPromise(value, passed, failed) ?? passed(value),
        failed
    )
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
    const tests = modules.flatMap(([module, proof]) =>
        collectTests([], false, proof).map(([path, entry]) =>
            () => runOne(module, path, entry.throws, entry.fn, result)
        )
    )
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

/** @typedef {(source: string) => Promise<{ readonly proof?: unknown }>} _BrowserImporter */
/** @typedef {{ readonly status: 'loaded', readonly source: string, readonly proof: unknown } | { readonly status: 'error', readonly source: string, readonly error: unknown }} _LoadedModule */
/** @typedef {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} _TestWindow */

/** @type {(root: Element) => _TestWindow | null} */
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
    const start = performance.now()
    setState(root, 'loading')
    let loaded = 0
    const summary = root.querySelector('[data-test-summary]')
    /** @type {Promise<readonly _LoadedModule[]>} */
    const modules = Promise.all(sources.map(source => importer(source).then(
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
                    return { module: source, path: '', status: 'failed', duration, message, stack }
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

/** @type {(root: Element, state: string) => void} */
const setState = (root, state) => root.setAttribute('data-state', state)

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
    item.textContent = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.module} ${result.path} (${result.duration.toFixed(1)} ms)${detail}`
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
