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
 * @import { TestResult, _TestAndPath } from './types.ts'
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
 * A leaf's outcome as the page reports it: the shared {@link TestResult} —
 * identity, status and duration, decided by `testResult` rather than here — plus
 * the two fields only a browser report needs.
 *
 * `message` and `stack` are the browser's own part, and stay outside the shared
 * record for the reason `TestResult` gives: describing a thrown value needs the
 * value, a serializable report cannot carry one, and `fjs t` describes it
 * differently because it is writing to a terminal rather than to a wire.
 *
 * @typedef {TestResult & { readonly message?: string, readonly stack?: string }} _BrowserTestResult
 */
/** @typedef {{ readonly status: string, readonly browser: string, readonly totals: { readonly tests: number, readonly passed: number, readonly failed: number }, readonly duration: number, readonly results: readonly _BrowserTestResult[] }} BrowserTestReport */

/**
 * Attaches the handlers with the intrinsic `then`, but answers with a promise
 * of this realm instead of the one `then` returns. That result is built by
 * `constructor[Symbol.species]`, which a promise can make an ordinary object:
 * awaiting it would end the test before the promise it came from ever settled
 * and put the species object itself in the report.
 *
 * The `then` call still throws — before either handler is attached — for a
 * value that is not a promise or whose species construction fails, which is
 * what `runPromise` reads.
 *
 * @type {(value: unknown, fulfilled: (value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[], rejected: (error: unknown) => readonly _BrowserTestResult[]) => Promise<readonly _BrowserTestResult[]>}
 */
const subscribe = (value, fulfilled, rejected) => {
    /** @type {(results: Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[]) => void} */
    let settle = () => undefined
    /** @type {Promise<readonly _BrowserTestResult[]>} */
    const settled = new Promise(resolve => { settle = resolve })
    Reflect.apply(Promise.prototype.then, value, [
        /** @type {(value: unknown) => void} */ (resolved => settle(fulfilled(resolved))),
        /** @type {(error: unknown) => void} */ (error => settle(rejected(error))),
    ])
    return settled
}

/**
 * Reproduces the lookup `then` performs before it builds its result promise:
 * `constructor`, then its `Symbol.species`. A genuine promise with a hostile
 * species throws here too; an object that only claims to be a promise failed
 * the brand check first and reads its `constructor` cleanly. That is what
 * separates a promise nothing can subscribe to from an ordinary proof tree,
 * once shadowing `constructor` has turned out to be impossible.
 *
 * @type {(value: unknown) => boolean}
 */
const speciesFails = value => {
    try {
        if (value === null || value === undefined) { return false }
        const { constructor } = /** @type {{ readonly constructor?: unknown }} */ (value)
        if (constructor === null || constructor === undefined) { return false }
        // The species itself never matters, only whether reading it completes:
        // that is the step `then` takes before it builds its result.
        void /** @type {{ readonly [Symbol.species]?: unknown }} */ (constructor)[Symbol.species]
        return false
    } catch {
        return true
    }
}

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
 * A promise that pins its own `constructor`, or is frozen, leaves nothing to
 * shadow, so no subscription is possible at all. The species failure is then
 * reported against the test that produced the promise — the same outcome
 * `await` gives it in the Node runner — because a result nobody can observe is
 * not a pass. A non-extensible object that merely claims to be a promise
 * reaches the same dead end and is still walked as the proof tree it is.
 *
 * @type {(value: unknown, fulfilled: (value: unknown) => Promise<readonly _BrowserTestResult[]> | readonly _BrowserTestResult[], rejected: (error: unknown) => readonly _BrowserTestResult[]) => Promise<readonly _BrowserTestResult[]> | null}
 */
const runPromise = (value, fulfilled, rejected) => {
    const call = () => subscribe(value, fulfilled, rejected)
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
            // Nothing to shadow, so the value is whatever its own lookup says:
            // a promise that cannot be subscribed to fails on the species error
            // rather than passing on a result that was never awaited, and a
            // frozen spoof is an ordinary proof tree.
            return speciesFails(value) ? Promise.resolve(rejected(error)) : null
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
