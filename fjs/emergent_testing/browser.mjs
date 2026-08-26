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

/** @type {(module: string, path: readonly (string | null)[], throws: boolean, fn: () => unknown) => Promise<readonly _BrowserTestResult[]>} */
const runOne = (module, path, throws, fn) => {
    const start = performance.now()
    return Promise.resolve().then(fn).then(
        value => {
            const duration = performance.now() - start
            if (throws) {
                return [{ module, path: formatPath(path), status: 'failed', duration,
                    message: 'Expected the proof to throw', stack: '' }]
            }
            const children = collect([...path, null], false, value)
            return Promise.all(children.map(([childPath, childThrows, child]) =>
                runOne(module, childPath, childThrows, child)
            )).then(results => [
                { module, path: formatPath(path), status: 'passed', duration },
                ...results.flat(),
            ])
        },
        error => {
            const duration = performance.now() - start
            if (throws) {
                return [{ module, path: formatPath(path), status: 'passed', duration }]
            }
            const [message, stack] = errorDetails(error)
            return [{ module, path: formatPath(path), status: 'failed', duration, message, stack }]
        }
    )
}

/**
 * Runs named proof exports and returns the serializable browser report.
 *
 * @type {(modules: readonly (readonly [string, unknown])[]) => Promise<BrowserTestReport>}
 */
export const runBrowserProofs = modules => {
    const start = performance.now()
    const tests = modules.flatMap(([module, proof]) =>
        collect([], false, proof).map(([path, throws, fn]) =>
            runOne(module, path, throws, fn)
        )
    )
    return Promise.all(tests).then(nested => {
        const results = nested.flat()
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
        output.replaceChildren(...report.results
            .filter(result => result.status === 'failed')
            .map(result => {
                const item = document.createElement('li')
                item.textContent = `${result.module} ${result.path}: ${result.message}\n${result.stack}`
                return item
            }))
    }
}

/**
 * Runs the application, publishes its promise as `window.fjsBrowserTestReport`,
 * and dispatches `fjs-browser-test-complete` with the report in `detail`.
 *
 * @type {(root: Element, modules: readonly (readonly [string, unknown])[]) => Promise<BrowserTestReport>}
 */
export const startBrowserTests = (root, modules) => {
    setState(root, 'running')
    const report = runBrowserProofs(modules).then(value => {
        renderBrowserReport(root, value)
        window.dispatchEvent(new CustomEvent('fjs-browser-test-complete', { detail: value }))
        return value
    })
    const browserWindow = /** @type {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} */ (window)
    browserWindow.fjsBrowserTestReport = report
    return report
}
