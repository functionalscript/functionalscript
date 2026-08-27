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
import { errorDetails, fmtCall } from '../module.f.mjs'
import { main, reportOf } from './module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { tryCatch } from '../../types/result/module.mjs'

/** @typedef {Window & { fjsBrowserTestReport?: Promise<BrowserTestReport> }} _TestWindow */

/** @typedef {<T, E>(effect: Effect<BrowserOp, T, E>) => Promise<Result<T, E>>} _Run */

/**
 * What a run is reported as when even *describing* its panic panicked.
 *
 * There is nothing left to say about the value at that point — every way of
 * reading it is a way of being thrown by it — so the report says exactly that
 * rather than inventing a message.
 */
const unreadableFailure = 'The run failed with a value that cannot be read'

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
    // `fmtCall`, so a test is named here exactly as `fjs t` names it — one
    // identifier, one spelling, whichever runner is reporting.
    item.textContent = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${fmtCall(result.module, result.path)} (${result.duration.toFixed(1)} ms)${detail}`
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
            // Not "failed to load": this status also covers a run that panicked
            // and a runner missing an operation, and naming the wrong cause
            // sends a reader to debug their imports. Each result below carries
            // its own module and message, so the detail is not lost.
            ? `Infrastructure error: ${report.totals.failed} failed (${report.duration.toFixed(1)} ms)`
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
            // Showing a result as it lands is the page's own rendering, and it
            // must not take the run down with it: the report is the one thing
            // the page is still waiting for, and it is already recorded above.
            try {
                if (summary !== null) { summary.textContent = `${results.length} tests completed…` }
                if (output !== null) { output.append(renderResult(root.ownerDocument, result)) }
            } catch {
                // The result stays in the report the run resolves with.
            }
            return ok(undefined)
        },
        reported: async () => ok(results),
    })
    const view = viewOf(root)
    const browser = navigatorName(root)
    // The application's error channel is empty — every failure it can *answer*
    // is reported — so the run's `Result` is always `ok`. A **panic** is the
    // other thing, and it is what `never` cannot promise away: reading a proof
    // tree runs user code, so an enumerable getter or a proxy trap throws
    // through the shared traversal, which has no `try`/`catch` to give it. That
    // must not be where the page stops. A rejected run with the suite left in
    // `running` is the one outcome an automated controller cannot act on, so
    // the panic becomes the report it could not produce — see
    // `../todo/hostile-proof-values.md` for attributing it to the test that
    // caused it.
    const settled = run(main({ browser, sources })).then(
        ([, value]) => value,
        error => {
            // Describing the panic reads the value that caused it, and the
            // value is the reason there was one: a proxy whose traps throw
            // *itself* makes `errorDetails` panic in turn. This is the last
            // handler there is, so it is the one that may not fail — a second
            // failure here is the page stuck in `running` again, with the
            // guard that was supposed to prevent it. What it cannot describe,
            // it says it cannot describe.
            const described = tryCatch(() => errorDetails(error))
            const [message, stack] = described[0] === 'ok'
                ? described[1]
                : [unreadableFailure, '']
            return reportOf('infrastructure-error', browser, 0, [
                { module: '', path: '', status: 'failed', duration: 0, message, stack }])
        })
    const report = settled.then(value => {
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
