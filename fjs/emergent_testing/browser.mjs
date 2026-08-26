/**
 * Browser-native proof execution and report rendering.
 *
 * The module deliberately has no Node dependencies: generated applications
 * import it directly as an ES module in the browser.
 *
 * @module
 */

/** @type {(path: readonly (string | null)[]) => string} */
const formatPath = path => path.map((part, index) =>
    part === null ? '()'
    : index === 0 ? part
    : `.${part}`
).join('')

/** @type {(error: unknown) => readonly [string, string]} */
const errorDetails = error => error instanceof Error
    ? [error.message, error.stack ?? error.message]
    : [String(error), String(error)]

/** @typedef {{ readonly module: string, readonly path: string, readonly status: string, readonly duration: number, readonly message?: string, readonly stack?: string }} _BrowserTestResult */
/** @typedef {{ readonly status: string, readonly browser: string, readonly totals: { readonly tests: number, readonly passed: number, readonly failed: number }, readonly duration: number, readonly results: readonly _BrowserTestResult[] }} BrowserTestReport */

/** @type {(path: readonly (string | null)[], throws: boolean, value: unknown) => readonly (readonly [readonly (string | null)[], boolean, () => unknown])[]} */
const collect = (path, throws, value) => {
    if (typeof value === 'function' && value.length === 0) {
        return [[path, throws, /** @type {() => unknown} */ (value)]]
    }
    if (value !== null && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, child]) =>
            collect([...path, key], throws || key === 'throw', child)
        )
    }
    return []
}

/** @type {(module: string, path: readonly (string | null)[], throws: boolean, fn: () => unknown, result: (result: _BrowserTestResult) => void) => Promise<readonly _BrowserTestResult[]>} */
const runOne = (module, path, throws, fn, result) => {
    const start = performance.now()
    return Promise.resolve().then(fn).then(
        value => {
            const duration = performance.now() - start
            if (throws) {
                const failure = { module, path: formatPath(path), status: 'failed', duration,
                    message: 'Expected the proof to throw', stack: '' }
                result(failure)
                return [failure]
            }
            const children = collect([...path, null], false, value)
            return Promise.all(children.map(([childPath, childThrows, child]) =>
                runOne(module, childPath, childThrows, child, result)
            )).then(results => {
                const success = { module, path: formatPath(path), status: 'passed', duration }
                result(success)
                return [success, ...results.flat()]
            })
        },
        error => {
            const duration = performance.now() - start
            if (throws) {
                const success = { module, path: formatPath(path), status: 'passed', duration }
                result(success)
                return [success]
            }
            const [message, stack] = errorDetails(error)
            const failure = { module, path: formatPath(path), status: 'failed', duration, message, stack }
            result(failure)
            return [failure]
        }
    )
}

/**
 * Runs named proof exports and returns the serializable browser report.
 *
 * @type {(modules: readonly (readonly [string, unknown])[], result?: (result: _BrowserTestResult) => void) => Promise<BrowserTestReport>}
 */
export const runBrowserProofs = (modules, result = () => undefined) => {
    const start = performance.now()
    const tests = modules.flatMap(([module, proof]) =>
        collect([], false, proof).map(([path, throws, fn]) =>
            () => runOne(module, path, throws, fn, result)
        )
    )
    const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0))
    const completed = tests.reduce((promise, test, index) => promise.then(results =>
        (index % 25 === 0 ? yieldToBrowser() : Promise.resolve())
            .then(test)
            .then(next => [...results, ...next])
    ), Promise.resolve(/** @type {readonly _BrowserTestResult[]} */ ([])))
    return completed.then(results => {
        const failed = results.filter(result => result.status === 'failed').length
        return {
            status: failed === 0 ? 'passed' : 'failed',
            browser: navigator.userAgent,
            totals: { tests: results.length, passed: results.length - failed, failed },
            duration: performance.now() - start,
            results,
        }
    })
}

/** @typedef {(source: string) => Promise<{ readonly proof?: unknown }>} _BrowserImporter */

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
    const modules = Promise.all(sources.map(source => importer(source).then(module => {
        loaded += 1
        if (summary !== null) { summary.textContent = `Loading ${loaded}/${sources.length}: ${source}` }
        return /** @type {const} */ ([source, module.proof])
    })))
    const report = modules.then(
        loadedModules => startBrowserTests(root, loadedModules),
        error => {
            const [message, stack] = errorDetails(error)
            const failure = { module: '<module loader>', path: '', status: 'failed',
                duration: performance.now() - start, message, stack }
            /** @type {BrowserTestReport} */
            const value = {
                status: 'infrastructure-error',
                browser: navigator.userAgent,
                totals: { tests: 0, passed: 0, failed: 0 },
                duration: failure.duration,
                results: [failure],
            }
            renderBrowserReport(root, value)
            window.dispatchEvent(new CustomEvent('fjs-browser-test-complete', { detail: value }))
            return value
        }
    )
    const browserWindow = /** @type {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} */ (window)
    browserWindow.fjsBrowserTestReport = report
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
        summary.textContent = `${report.totals.passed} passed, ${report.totals.failed} failed (${report.duration.toFixed(1)} ms)`
    }
    const output = root.querySelector('[data-test-results]')
    if (output !== null) {
        output.replaceChildren(...report.results.map(renderResult))
    }
}

/** @type {(result: _BrowserTestResult) => HTMLLIElement} */
const renderResult = result => {
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
    const report = runBrowserProofs(modules, result => {
        completed += 1
        const summary = root.querySelector('[data-test-summary]')
        if (summary !== null) { summary.textContent = `${completed} tests completed…` }
        if (output !== null) { output.append(renderResult(result)) }
    }).then(value => {
        renderBrowserReport(root, value)
        window.dispatchEvent(new CustomEvent('fjs-browser-test-complete', { detail: value }))
        return value
    })
    const browserWindow = /** @type {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} */ (window)
    browserWindow.fjsBrowserTestReport = report
    return report
}
