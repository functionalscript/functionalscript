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
 * @import {
 *     BrowserTestReport, Reporter, RunState, TestId, TestResult, _BrowserEvent, _BrowserReport,
 *     _BrowserTestResult, _TestAndPath,
 * } from '../types.ts'
 * @import { Catch, Import, Sandbox, SandboxResult } from '../../effects/common/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { Effect, Func, ToAsyncOperationMap } from '../../effects/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import {
    errorDetails, formatDuration, groupByModule, groupLabel, loadProofs, moduleFailure, reportOf, runProofs, runnerSource,
} from './module.f.mjs'
// The phrase for a value that will not be read is the runners' shared one:
// this host meets such a value at its `import` boundary, where the walk cannot.
import { unknownValue } from '../module.f.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { commonOperationMap } from '../../effects/common/module.mjs'
import { ioError, toIoError } from '../../effects/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'

/**
 * Return to the event loop, so the browser can paint what has been appended.
 *
 * A macrotask rather than a microtask: draining the microtask queue is part of
 * the same task, and a task is what a paint waits for.
 *
 * @type {() => Promise<void>}
 */
const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })

/**
 * A whole module's failure, described by the shared reader.
 *
 * The reader is an effect over `catch`, because reading a thrown value runs
 * user code, so describing one takes an interpreter — a minimal one, holding
 * nothing but the common operations.
 *
 * @type {(source: string, duration: number, cause: unknown) => Promise<_BrowserTestResult>}
 */
const failureOf = async (source, duration, cause) => {
    const described = await asyncRun(commonOperationMap)(errorDetails(cause))
    const [message, stack] = described[0] === 'ok'
        ? described[1]
        : /** @type {const} */ ([unknownValue, unknownValue])
    return moduleFailure(source, duration, message, stack)
}

/**
 * {@link runBrowserProofs} with the page's own operation map handed to
 * `operations` before it is interpreted.
 *
 * **A testing seam, not a public-API widening.** The page's published entry
 * point is {@link runBrowserProofs} and is unchanged; this export exists
 * because one branch below is otherwise unreachable. `runProofs` has no error
 * channel, so every failure a *proof* can produce arrives as a value — the one
 * thing that can reject the run is this file's own interpreter, and a caller
 * that cannot replace it cannot produce that. The rejected alternative was
 * widening the published entry point to reach the branch, which pays for a
 * proof in API surface every page then carries.
 *
 * Two rejections reach `runnerFailure` through it, and they are the same
 * failure at different depths: a handler that throws, and a command with no
 * handler at all — `match` panics on the second, inside the same awaited loop.
 *
 * @type {(operations: (map: ToAsyncOperationMap<Catch | _BrowserReport | Sandbox>) => ToAsyncOperationMap<Catch | _BrowserReport | Sandbox>) => (modules: readonly (readonly [string, unknown])[], result?: (result: _BrowserTestResult) => void, start?: (id: TestId) => void) => Promise<BrowserTestReport>}
 */
export const _runBrowserProofsWith = operations => (
    modules,
    result = () => undefined,
    start = () => undefined,
) => {
    const began = performance.now()
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
    // The same bargain one event earlier: a renderer that throws while showing
    // a leaf is *about* to run must not take the run down either, and there is
    // even less to lose — nothing is recorded from a start.
    /** @type {(id: TestId) => void} */
    const announceStart = id => {
        try {
            start(id)
        } catch {
            // A pending row the page failed to draw changes no outcome.
        }
    }
    /** @type {<T, E>(e: Effect<Catch | _BrowserReport | Sandbox, T, E>) => Promise<Result<T, E>>} */
    const run = asyncRun(operations({
        ...commonOperationMap,
        // **The page's only operation, and the port's only scheduling.** The
        // await is a real macrotask boundary: a run is otherwise one
        // uninterruptible task, and a browser paints nothing until it ends. It
        // replaces what `batchSize = 25` was doing without being asked to, and
        // yields on every event rather than per twenty-five leaves — twice per
        // leaf now, so its row appears when it starts and settles when it
        // finishes.
        report: async (/** @type {_BrowserEvent} */ event) => {
            if (event[0] === 'result') { announce(event[1]) }
            // **The yield after a start is the whole point of the start.** A
            // row appended inside this handler is in the document either way;
            // it is on *screen* only if the thread goes back to the browser
            // before the leaf's body takes it, which is what the await below
            // — shared with the result event — does.
            if (event[0] === 'start') { announceStart(event[1]) }
            await macrotask()
            return ok(undefined)
        },
    }))
    /**
     * The failure of a *runner* that did not even answer through its error
     * channel: a handler of this interpreter threw, so the whole run rejected.
     *
     * It is the one route the orchestration cannot decide, because it is this
     * file's own fault rather than anything the walk can observe — which is
     * also why the entry is not named after a module. The walk is one effect
     * now, so a rejection is not attributable to the module it happened under.
     *
     * The description is read by the shared reader, on an interpreter that
     * needs nothing but `catch` — deliberately not the one that just failed.
     *
     * @type {(cause: unknown) => Promise<_BrowserTestResult>}
     */
    const runnerFailure = cause => failureOf(runnerSource, 0, cause)
    // Nothing that runs user code may start before the caller holds the
    // promise: a leaf executes synchronously inside its handler, so without
    // this deferral the first proofs run while this function is still building
    // what it returns, and a proof reading `fjsBrowserTestReport` would see the
    // previous run's promise. Catalog item 7.
    return Promise.resolve()
        .then(() => run(runProofs(modules)))
        // `runProofs` has no error channel — every failure it can meet is a
        // value it decides about — so there is no branch to write here, and
        // `unwrap` says exactly that. What it cannot cover is a rejection,
        // which is what the `catch` below is for.
        .then(unwrap)
        .catch(runnerFailure)
        .then(ended => reportOf(
            navigator.userAgent,
            performance.now() - began,
            toArray(ended === null ? landed : concat(landed)([ended])),
            ended === null ? null : 'infrastructure-error'))
}

/**
 * Runs named proof exports and returns the serializable browser report.
 *
 * `result` is the page's subscription to the leaf-landed event — the same
 * event `fjs t`'s `Reporter.result` carries, a shared `TestResult` plus the
 * browser's own `message`/`stack` part — and the resolved report is its
 * run-ended event, with totals folded by the shared `addResult`.
 *
 * `start` is the same subscription one event earlier, carrying the leaf's
 * identity before it is sandboxed. A caller that wants only outcomes omits it;
 * a caller that renders progress uses it, and gets the paint, because the run
 * yields after announcing.
 *
 * @type {(modules: readonly (readonly [string, unknown])[], result?: (result: _BrowserTestResult) => void, start?: (id: TestId) => void) => Promise<BrowserTestReport>}
 */
export const runBrowserProofs = _runBrowserProofsWith(map => map)

/**
 * What a page hands `import()` for one of its sources.
 *
 * **Only a relative specifier is rebased.** A page names its sources relative
 * to itself (`./proof.f.mjs`, and `./fjs/…` from the root), and a bare
 * `import(source)` inside this module would resolve those against *this
 * module's* URL — two directories deep, every load 404.
 *
 * Everything else is handed over unchanged, deliberately: a bare specifier
 * (`proofs/core`) is an import map's to resolve, and rewriting it into a
 * document-relative URL is how a map gets broken invisibly. An absolute URL —
 * `https:`, `data:` — already carries its own base.
 *
 * A bare specifier is resolved with *this module* as the referrer, so an import
 * map's `scopes` are read for `emergent_testing/browser/` and not for the page
 * entry that asked. Nothing here uses import maps, and the only way to change
 * it is to hand the loading back to an injected callback in the page — the
 * unnamed operation this change exists to remove. Recorded rather than
 * designed around: a suite that needs a scoped map wants a page that resolves
 * its own sources and passes URLs.
 *
 * @type {(base: string, source: string) => string}
 */
const specifier = (base, source) =>
    source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
        ? new URL(source, base).href
        : source

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
 * The walk itself is [`./module.f.mjs`](./module.f.mjs)'s `loadProofs`, which
 * loads one module after another. What is here is what a page is: the
 * `import()` that resolves a source against this document, the summary line the
 * count is rendered into, and the publication.
 *
 * **The count is the page's, not the walk's.** The walk announces *what*
 * happened — this module arrived — and whoever watches the sequence decides
 * what to render from it, which is the same bargain the leaf-landed event
 * makes.
 *
 * @type {(root: Element, sources: readonly string[]) => Promise<BrowserTestReport>}
 */
export const startBrowserTestSources = (root, sources) => {
    const start = performance.now()
    setState(root, 'loading')
    let loaded = 0
    const summary = root.querySelector('[data-test-summary]')
    /** @type {(text: string) => void} */
    const say = text => { if (summary !== null) { summary.textContent = text } }
    // Set synchronously, before any import settles: otherwise the page keeps
    // showing its idle text throughout loading — indefinitely, if a module
    // import never settles — even though the state and control already changed.
    say(`Loading 0/${sources.length}`)
    /** @type {<T, E>(e: Effect<Import | _BrowserReport, T, E>) => Promise<Result<T, E>>} */
    const run = asyncRun({
        ...commonOperationMap,
        // **Resolved against the document, not against this file**, by
        // `specifier` above — and only when the source is relative, so an
        // import map still gets to answer for a bare one.
        // `root.ownerDocument` rather than the ambient document, so a suite
        // embedded in an iframe loads from that frame.
        //
        // Obtaining the promise is itself a failure point — a synchronous
        // throw would escape past a `loading` state that no report ever
        // replaces — so it is caught and answered through the operation's own
        // error channel, where the walk reads it as that module's failure.
        import: async (/** @type {string} */ source) => {
            try {
                return ok(await import(specifier(root.ownerDocument.baseURI, source)))
            } catch (cause) {
                // **Normalising runs the value's own code too.** A module that
                // evaluates `throw { toString() { throw … } }` rejects with a
                // value `toIoError` cannot describe, and an unguarded call here
                // rejects the whole run — leaving the page at `Loading 0/N`
                // with no report and no completion event, which is the one
                // outcome an automated controller cannot act on. The value
                // that will not be read is named rather than propagated.
                //
                // The message is read **here**, inside the same guard, because
                // `toIoError` takes an `Error`'s own `message` as it finds it:
                // an `Error` whose `message` is an object with a hostile
                // `toString` passes through it and throws later, in the
                // renderer, where nothing knows which source it came from — so
                // the row would name the runner instead of the module that
                // failed.
                //
                // No proof pins this one. The fixture has to be a module that
                // throws, and bun does not reject a top-level `throw` in a
                // `data:` module at all, so the proof would assert one engine's
                // behaviour rather than this code's — the mistake this branch
                // already paid for once.
                try {
                    const [, info] = toIoError(cause)
                    return error(ioError({ ...info, message: `${info.message}` }))
                } catch {
                    return error(ioError({ message: unknownValue }))
                }
            }
        },
        report: async (/** @type {_BrowserEvent} */ event) => {
            if (event[0] === 'loading') {
                loaded += 1
                say(`Loading ${loaded}/${sources.length}: ${event[1]}`)
            }
            return ok(undefined)
        },
    })
    const report = run(loadProofs(sources))
        .then(outcome => {
            // `loadProofs` answers every failure it can meet as a value, so a
            // rejection here is this file's own interpreter breaking.
            const loadedModules = unwrap(outcome)
            if (loadedModules[0] === 'failed') {
                // A module that never linked has no tests to run, so the run
                // stops here. Each failure is still a counted result: totals
                // that disagreed with `results` would tell an automated
                // consumer the suite was empty rather than broken.
                return publish(root, Promise.resolve(reportOf(
                    navigator.userAgent,
                    performance.now() - start,
                    loadedModules[1],
                    'infrastructure-error')))
            }
            return startBrowserTests(root, loadedModules[1])
        })
        // The last guard: `loadProofs` answers every failure it can meet as a
        // value, so reaching here means this file's own interpreter broke.
        //
        // No proof pins it either, for the same reason as the message guard
        // above: a fixture would have to make an operation handler throw, and
        // every value that does so is one engine's behaviour rather than this
        // code's. It stays because the alternative — a page left in `loading`
        // with no report and no completion event — is the one outcome an
        // automated controller cannot act on.
        .catch(async cause => publish(root, Promise.resolve(reportOf(
            navigator.userAgent,
            performance.now() - start,
            [await failureOf(runnerSource, performance.now() - start, cause)],
            'infrastructure-error'))))
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
    // A new run's title must not keep the last run's counts while this one
    // has none yet.
    if (state === 'loading' || state === 'running') { root.querySelector('[data-test-counts]')?.replaceChildren() }
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
        // The counts are the section title's now, so this line says only what
        // the title cannot: that the suite never reached its tests. A run that
        // did leaves it empty, and the stylesheet draws nothing for it.
        summary.textContent = report.status === 'infrastructure-error'
            ? `Infrastructure error: ${report.totals.failed} failed to load (${formatDuration(report.duration)})`
            : ''
    }
    const counts = root.querySelector('[data-test-counts]')
    if (counts !== null) { counts.replaceChildren(...renderCounts(root.ownerDocument, report)) }
    const output = root.querySelector('[data-test-results]')
    if (output !== null) {
        output.replaceChildren(...groupByModule(report.results).map(({ module, results, passed, failed }) => {
            const group = openGroup(root.ownerDocument, module)
            for (const result of results) { group.list.append(renderResult(root.ownerDocument, result)) }
            labelGroup(group, passed, failed, true)
            return group.details
        }))
    }
}

/**
 * The run's counts, for the section's title: a green count of what passed, a
 * red one of what failed, and the time.
 *
 * **The red count is there only when something failed**, so a clean run's
 * title does not carry a zero in the colour that means trouble.
 *
 * @type {(document: Document, report: BrowserTestReport) => readonly HTMLElement[]}
 */
const renderCounts = (document, report) => {
    /** @type {(attribute: string, text: string) => HTMLElement} */
    const span = (attribute, text) => {
        const element = document.createElement('span')
        element.setAttribute(attribute, '')
        element.textContent = text
        return element
    }
    return [
        span('data-count-passed', `${report.totals.passed} passed`),
        ...(report.totals.failed === 0 ? [] : [span('data-count-failed', `${report.totals.failed} failed`)]),
        span('data-duration', formatDuration(report.duration)),
    ]
}

/**
 * A module's group as it starts: open, `running`, and empty.
 *
 * **One group per module run, not one list for the suite.** A suite is
 * thousands of rows and a reader wants the few that failed; a group that
 * passed folds to one line, so what stays open is what needs reading.
 *
 * Open while running so the pending row is on screen — the whole point of
 * announcing a leaf before running it — and settled by {@link labelGroup}.
 *
 * Its line is three parts — a dot for its verdict, the module's path, and its
 * counts — so the stylesheet can colour the dot and push the counts to the
 * right edge without parsing a sentence.
 *
 * @type {(document: Document, module: string) => { readonly details: HTMLDetailsElement, readonly counts: HTMLElement, readonly list: HTMLOListElement }}
 */
const openGroup = (document, module) => {
    const details = document.createElement('details')
    details.setAttribute('data-test-module', module)
    details.setAttribute('data-status', 'running')
    details.setAttribute('open', '')
    const summary = document.createElement('summary')
    const dot = document.createElement('span')
    dot.setAttribute('data-dot', '')
    const path = document.createElement('span')
    path.setAttribute('data-path', '')
    path.textContent = module
    const counts = document.createElement('span')
    counts.setAttribute('data-counts', '')
    counts.textContent = groupLabel(0, 0)
    summary.append(dot)
    summary.append(path)
    summary.append(counts)
    const list = document.createElement('ol')
    details.append(summary)
    details.append(list)
    return { details, counts, list }
}

/**
 * Writes a group's counts onto its line, and — once nothing more will land in
 * it — decides whether it folds.
 *
 * **A failure marks the group at once; a pass waits to be settled.** A group
 * that has failed has failed however the rest of it goes, so it says so the
 * moment it knows. One that has only passed so far may still fail, so it
 * stays `running` and open until the run moves on to another module.
 *
 * @type {(group: { readonly details: Element, readonly counts: Element }, passed: number, failed: number, settled: boolean) => void}
 */
const labelGroup = ({ details, counts }, passed, failed, settled) => {
    counts.textContent = groupLabel(passed, failed)
    if (failed !== 0) {
        details.setAttribute('data-status', 'failed')
    } else if (settled) {
        details.setAttribute('data-status', 'passed')
        details.removeAttribute('open')
    }
}

/**
 * Writes a settled leaf onto a row — the one it has been running in, or a new
 * one.
 *
 * Settling **in place** rather than replacing the node is what keeps a pending
 * row and its result one row: the element a reader is already looking at is
 * the element that gains the verdict.
 *
 * @type {(item: Element, result: _BrowserTestResult) => void}
 */
const settleResult = (item, result) => {
    item.setAttribute('data-status', result.status)
    item.textContent = `${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name} (${result.duration.toFixed(1)} ms)`
    // **The error is a block of its own, not more of the row.** The row stays
    // one line a reader can scan past, and the message and stack keep their
    // line breaks in a `pre` — which is why the list around them is no longer
    // one.
    if (result.status === 'failed') {
        const detail = item.ownerDocument.createElement('pre')
        detail.setAttribute('data-test-error', '')
        detail.textContent = `${result.message}\n${result.stack}`
        item.append(detail)
    }
}

/** @type {(document: Document, result: _BrowserTestResult) => HTMLLIElement} */
const renderResult = (document, result) => {
    const item = document.createElement('li')
    settleResult(item, result)
    return item
}

/**
 * The row a leaf gets while it is running: its name, and no verdict, because
 * there is none yet.
 *
 * `data-status="running"` rather than a missing attribute, so a stylesheet and
 * a proof can both name the state, and so a row left in it after a run ends is
 * visibly the test that did not finish.
 *
 * @type {(document: Document, id: TestId) => HTMLLIElement}
 */
const renderPending = (document, id) => {
    const item = document.createElement('li')
    item.setAttribute('data-status', 'running')
    item.textContent = `RUN  ${id.name}`
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
    // The row the running leaf is showing in, so its result can settle **in
    // place** rather than appending a second row for the same test. One
    // variable is enough because the run is sequential: a leaf's whole chain
    // finishes before the next leaf's start event, so there is never more than
    // one pending row. A concurrent runner would need a row per leaf, and that
    // is one more thing the sequential run does not have to carry.
    /** @type {HTMLLIElement | null} */
    let pending = null
    // The group rows are landing in. One is enough for the same reason one
    // pending row is: the run is sequential, so a module's results are adjacent
    // and the group changes only when the module does.
    /** @type {{ readonly module: string, readonly details: HTMLDetailsElement, readonly counts: HTMLElement, readonly list: HTMLOListElement, passed: number, failed: number } | null} */
    let group = null
    /**
     * The group for `module`: the current one, or a new one — in which case the
     * previous group is settled first, so a module that passed folds as soon as
     * the run has moved past it rather than at the end of the suite.
     *
     * @type {(target: Element, module: string) => { readonly module: string, readonly details: HTMLDetailsElement, readonly counts: HTMLElement, readonly list: HTMLOListElement, passed: number, failed: number }}
     */
    const groupFor = (target, module) => {
        const current = group
        if (current !== null && current.module === module) { return current }
        if (current !== null) { labelGroup(current, current.passed, current.failed, true) }
        const next = { module, ...openGroup(root.ownerDocument, module), passed: 0, failed: 0 }
        target.append(next.details)
        group = next
        return next
    }
    return publish(root, runBrowserProofs(
        modules,
        result => {
            completed += 1
            const summary = root.querySelector('[data-test-summary]')
            if (summary !== null) { summary.textContent = `${completed} tests completed…` }
            if (output === null) { return }
            const into = groupFor(output, result.module)
            // A result with no pending row is a leaf that was never announced —
            // a module that could not be read, or the runner's own failure.
            // Those are rows too, and appending is right for them.
            if (pending === null) {
                into.list.append(renderResult(root.ownerDocument, result))
            } else {
                settleResult(pending, result)
            }
            pending = null
            if (result.status === 'passed') { into.passed += 1 } else { into.failed += 1 }
            labelGroup(into, into.passed, into.failed, false)
        },
        id => {
            if (output === null) { return }
            pending = renderPending(root.ownerDocument, id)
            groupFor(output, id.module).list.append(pending)
        }))
}
