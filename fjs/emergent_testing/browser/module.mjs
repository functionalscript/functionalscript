/**
 * The browser host adapter: capabilities, DOM rendering, and publication.
 *
 * It owns nothing about what a proof *means*. Walking proof trees, the
 * structural `throw` expectation, resolving real promises, path formatting and
 * the totals belong to `../module.f.mjs` — the module `fjs t` runs through —
 * and what a *run* is belongs to the pure application in
 * [`./module.f.mjs`](./module.f.mjs). What is left here is the browser: an
 * interpreter for the operations that application performs, the DOM it is
 * rendered into, and the promise and event a controller reads it from.
 *
 * The module deliberately has no Node dependency: generated applications import
 * it directly as an ES module in the browser.
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
 * @import { Effect } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { BrowserImporter } from '../../effects/browser/module.mjs'
 * @import { TestResult } from '../types.ts'
 * @import { BrowserOp, BrowserTestReport } from './types.ts'
 */

import { asyncRun } from '../../effects/module.mjs'
import { browserOperationMap } from '../../effects/browser/module.mjs'
import { main } from './module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'

/** @typedef {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} _TestWindow */

/** @typedef {<T, E>(effect: Effect<BrowserOp, T, E>) => Promise<Result<T, E>>} _Run */

/**
 * How many results may be rendered before the runner hands the event loop back.
 *
 * Every operation resolves through a microtask, and microtasks do not let a
 * browser paint: without a real task boundary the page would show its first
 * frame again only once the whole suite had finished. Yielding per result would
 * be the simpler rule and the wrong one — `setTimeout` clamps to 4 ms once
 * nested, which is minutes across a few thousand proofs.
 */
const batchSize = 25

/** @type {() => Promise<void>} */
const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })

/** @type {(root: Element) => _TestWindow | null} */
const viewOf = root => root.ownerDocument.defaultView

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

/** @type {(document: Document, result: TestResult) => HTMLLIElement} */
const renderResult = (document, result) => {
    const item = document.createElement('li')
    item.setAttribute('data-status', result.status)
    const detail = result.status === 'failed' ? `: ${result.message}\n${result.stack}` : ''
    item.textContent = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.module} ${result.path} (${result.duration.toFixed(1)} ms)${detail}`
    return item
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

/**
 * Runs the browser application against `root`, publishes its promise as
 * `fjsBrowserTestReport` on the root's window, and dispatches
 * `fjs-browser-test-complete` with the report in `detail`.
 *
 * `importer` is the seam a controller reaches for: an application root resolves
 * its own specifiers, and a proof drives the whole runner without a network.
 * The default is the realm's own dynamic `import`.
 *
 * @type {(root: Element, sources: readonly string[], importer?: BrowserImporter) => Promise<BrowserTestReport>}
 */
export const startBrowserTestSources = (root, sources, importer = source => import(source)) => {
    setState(root, 'loading')
    const summary = root.querySelector('[data-test-summary]')
    const output = root.querySelector('[data-test-results]')
    if (output !== null) { output.replaceChildren() }
    // Set synchronously, before any import settles: otherwise the page keeps
    // showing its idle text throughout loading — indefinitely, if a module
    // import never settles — even though the state and control already changed.
    if (summary !== null) { summary.textContent = `Loading 0/${sources.length}` }
    let loaded = 0
    /** @type {(source: string) => void} */
    const linked = source => {
        loaded += 1
        if (summary !== null) { summary.textContent = `Loading ${loaded}/${sources.length}: ${source}` }
        // Whether the module linked or not, the loading phase is over once the
        // last answer is in — a broken graph is reported by the run, not by
        // leaving the page in `loading` forever.
        if (loaded === sources.length) { setState(root, 'running') }
    }
    /** @type {BrowserImporter} */
    const load = source => importer(source).then(
        module => { linked(source); return module },
        error => { linked(source); throw error })
    /** @type {readonly TestResult[]} */
    let results = []
    /** @type {_Run} */
    const run = asyncRun({
        ...browserOperationMap(effect => run(effect), load),
        report: async result => {
            results = [...results, result]
            if (summary !== null) { summary.textContent = `${results.length} tests completed…` }
            if (output !== null) { output.append(renderResult(root.ownerDocument, result)) }
            if (results.length % batchSize === 0) { await macrotask() }
            return ok(undefined)
        },
        reported: async () => ok(results),
    })
    const view = viewOf(root)
    // The application's error channel is empty — every failure it can meet is
    // reported — so the run's `Result` is always `ok` and `unwrap` would only
    // add a panic path nothing can reach.
    const report = run(main({ browser: navigatorName(root), sources })).then(([, value]) => {
        renderBrowserReport(root, value)
        view?.dispatchEvent(new CustomEvent('fjs-browser-test-complete', { detail: value }))
        return value
    })
    if (view !== null) { view.fjsBrowserTestReport = report }
    return report
}

/**
 * The realm the run is recorded under, read through the root's own window so an
 * embedded suite names the frame it actually runs in — and so a proof driving
 * the runner with a stand-in root never needs a global `navigator`.
 *
 * @type {(root: Element) => string}
 */
const navigatorName = root => viewOf(root)?.navigator.userAgent ?? ''
