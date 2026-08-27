/**
 * Proofs for the browser host adapter and the browser interpretation of the
 * host-independent operations.
 *
 * The adapter reaches the page only through the root element it is handed, so
 * the DOM stand-in below is enough to drive every rendering branch from Node —
 * no headless browser, and no global `window`/`document` for these proofs to
 * install and unset. What each proof *means* is settled a layer down, by the
 * shared core and its own proofs; what is checked here is that a browser run
 * reaches it, renders it, and publishes it.
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Module } from '../../effects/common/types.ts'
 * @import { CommonRun } from '../../effects/browser/module.mjs'
 * @import { BrowserTestReport } from './types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { browserOperationMap } from '../../effects/browser/module.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { all as allEffect, sandbox as sandboxEffect } from '../../effects/common/module.f.mjs'
import { renderBrowserReport, startBrowserTestSources } from './module.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

/** @typedef {{ readonly tag: string, attributes: ReadonlyMap<string, string>, readonly ownerDocument: _Document, textContent: string, children: readonly _Element[], readonly setAttribute: (name: string, value: string) => void, readonly removeAttribute: (name: string) => void, readonly querySelector: (selector: string) => _Element | null, readonly replaceChildren: (...nodes: readonly _Element[]) => void, readonly append: (node: _Element) => void }} _Element */
/** @typedef {{ defaultView: _View | null, readonly createElement: (tag: string) => _Element }} _Document */
/** @typedef {{ events: readonly CustomEvent[], readonly navigator: { readonly userAgent: string }, readonly dispatchEvent: (event: Event) => boolean, fjsBrowserTestReport?: Promise<unknown> }} _View */

/** @type {(node: _Element, name: string) => _Element | null} */
const find = (node, name) =>
    node.attributes.has(name)
        ? node
        : node.children.reduce(
            (/** @type {_Element | null} */ acc, child) => acc ?? find(child, name),
            null)

/** @type {(document: _Document, tag: string, attributes: readonly string[], states: string[]) => _Element} */
const element = (document, tag, attributes, states) => {
    /** @type {_Element} */
    const self = {
        tag,
        attributes: new Map(attributes.map(name => [name, ''])),
        ownerDocument: document,
        textContent: '',
        children: [],
        setAttribute: (name, value) => {
            if (name === 'data-state') { states.push(value) }
            self.attributes = new Map([...self.attributes, [name, value]])
        },
        removeAttribute: name => {
            self.attributes = new Map([...self.attributes].filter(([key]) => key !== name))
        },
        // The adapter only ever queries an attribute selector of `[name]` form.
        querySelector: selector => self.children.reduce(
            (/** @type {_Element | null} */ acc, child) =>
                acc ?? find(child, selector.slice(1, -1)),
            null),
        replaceChildren: (...nodes) => { self.children = nodes },
        append: node => { self.children = [...self.children, node] },
    }
    return self
}

/**
 * Builds what the generated page gives the adapter: a root carrying the summary
 * paragraph and the result list. `states` records every `data-state` written,
 * so a proof can check the whole progression and not just its last step.
 *
 * @type {(withView?: boolean) => { readonly root: Element, readonly summary: _Element, readonly results: _Element, readonly runButton: _Element, readonly view: _View, readonly states: readonly string[] }}
 */
const page = (withView = true) => {
    /** @type {string[]} */
    const states = []
    /** @type {_Document} */
    const document = {
        defaultView: null,
        createElement: tag => element(document, tag, [], states),
    }
    /** @type {_View} */
    const view = {
        events: [],
        navigator: { userAgent: 'stand-in browser' },
        dispatchEvent: event => {
            view.events = [...view.events, /** @type {CustomEvent} */ (event)]
            return true
        },
    }
    if (withView) { document.defaultView = view }
    const root = element(document, 'main', ['data-browser-tests'], states)
    root.replaceChildren(
        element(document, 'p', ['data-test-summary'], states),
        element(document, 'button', ['data-test-run'], states),
        element(document, 'ol', ['data-test-results'], states))
    return {
        root: /** @type {Element} */ (/** @type {unknown} */ (root)),
        summary: assertNotNullish(root.querySelector('[data-test-summary]')),
        results: assertNotNullish(root.querySelector('[data-test-results]')),
        runButton: assertNotNullish(root.querySelector('[data-test-run]')),
        view,
        states,
    }
}

/** Runs one in-memory proof module through the whole browser stack.
 *
 * @type {(proof: unknown) => Promise<BrowserTestReport>}
 */
const run = proof =>
    startBrowserTestSources(page().root, ['proof'], async () => ({ proof }))

/** @type {(element: _Element) => readonly (string | undefined)[]} */
const statuses = element => element.children.map(child => child.attributes.get('data-status'))

/**
 * The browser handlers on their own, so the operations the proof application
 * never reaches — `fetch`, `await`, a nested `all` — are still exercised.
 */
const operations = browserOperationMap(
    effect => commonRun(effect),
    async source => ({ source }))

/** @type {CommonRun} */
const commonRun = asyncRun(operations)

const { all, await: awaitOp, fetch: fetchOp, import: importOp, now, sandbox } = operations

export const proof = {
    // The whole stack: a module is linked, its proofs run, each result is
    // rendered as it lands, and the report is published and announced.
    passing: async () => {
        const { root, summary, results, view, states } = page()
        const report = await startBrowserTestSources(root, ['a'], async () => ({
            proof: { x: () => undefined },
        }))
        assertEq(report.status, 'passed')
        assertEq(report.browser, 'stand-in browser')
        assertEq(report.totals.tests, 1)
        assertEq(report.results[0]?.path, '.x')
        assertEq(statuses(results).join(','), 'passed')
        // The page names a test exactly as `fjs t` names it. The two spellings
        // had drifted — `./a .x` here against the call expression there — which
        // is the thing a shared runner is supposed to make impossible.
        assert(
            results.children[0]?.textContent.startsWith('PASS import("a").proof.x()'),
            results.children[0]?.textContent)
        assert(summary.textContent.startsWith('1 passed, 0 failed'), summary.textContent)
        assertEq(states.join(','), 'loading,running,passed')
        assertEq(view.events.length, 1)
        assertEq(/** @type {BrowserTestReport} */ (view.events[0]?.detail).status, 'passed')
        assertEq(await view.fjsBrowserTestReport, report)
    },
    failing: async () => {
        const { root, results, runButton } = page()
        const report = await startBrowserTestSources(root, ['a'], async () => ({
            proof: { boom: () => { throw new Error('bang') } },
        }))
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'bang')
        assert((report.results[0]?.stack ?? '').includes('bang'))
        assertEq(statuses(results).join(','), 'failed')
        // The control is available again the moment the run reaches a terminal
        // state, and was not while it was loading or running.
        assert(!runButton.attributes.has('disabled'))
    },
    expectedThrow: async () => {
        const report = await run({ throw: { boom: () => { throw 'expected' } } })
        assertEq(report.status, 'passed')
    },
    // Only a real promise is an asynchronous value, which is exactly the rule
    // `fjs t` follows: the browser `sandbox` awaits one and reports what it
    // resolves to.
    promise: async () => {
        const report = await run({ nested: () => Promise.resolve({ inner: () => undefined }) })
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 0)
        assertEq(report.results[1]?.path, '.nested().inner')
    },
    rejectedPromise: async () => {
        const report = await run({ nested: () => Promise.reject(new Error('later')) })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'later')
    },
    // ...and an ordinary object carrying a `then` proof is a proof tree, never
    // a thenable to assimilate.
    thenIsATestName: async () => {
        const report = await run({ nested: () => ({ then: () => undefined }) })
        assertEq(report.totals.tests, 2)
        assertEq(report.results[1]?.path, '.nested().then')
    },
    // A module that will not link stops the run before any proof body, and says
    // so with a status an automated consumer must not read as a failing suite.
    unlinkable: async () => {
        const { root, summary, states } = page()
        const report = await startBrowserTestSources(root, ['a'], async () => {
            throw new Error('404')
        })
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.totals.failed, 1)
        assertEq(report.results[0]?.module, 'a')
        assertEq(report.results[0]?.message, '404')
        assert(summary.textContent.startsWith('Infrastructure error: 1 failed'), summary.textContent)
        assertEq(states.join(','), 'loading,running,infrastructure-error')
    },
    // The importer is page code, so obtaining the promise is itself a failure
    // point: a synchronous throw is a load failure, not an escape past a
    // `loading` state no report ever replaces.
    importerThrowsSynchronously: async () => {
        const { root } = page()
        const report = await startBrowserTestSources(root, ['a'], () => {
            throw new Error('bad specifier')
        })
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.message, 'bad specifier')
    },
    // Past the batch size the adapter hands the event loop back, so a long
    // suite paints instead of freezing the page on its first frame.
    batches: async () => {
        const proof = Object.fromEntries(
            [...new Array(60).keys()].map(i => [`t${i}`, () => undefined]))
        const report = await run(proof)
        assertEq(report.totals.tests, 60)
        assertEq(report.totals.passed, 60)
    },
    // Reading the tree a proof returns runs user code, and the shared traversal
    // has no `try`/`catch` to give it — so a throwing getter panics *through*
    // the run. The page must still reach a terminal state and still publish a
    // report: a rejected run left in `running` is the one outcome an automated
    // controller cannot act on.
    hostileProofTree: async () => {
        const { root, view, states } = page()
        const report = await startBrowserTestSources(root, ['a'], async () => ({
            proof: { hostile: () => ({ get boom() { throw new Error('trap') } }) },
        }))
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.message, 'trap')
        assertEq(states.join(','), 'loading,running,infrastructure-error')
        assertEq(view.events.length, 1)
    },
    // The summary must not keep showing idle text through loading: it is
    // replaced the instant a run starts, before any import has had a chance to
    // settle — even one that never does.
    loadingSummaryIsSynchronous: () => {
        const { root, summary } = page()
        void startBrowserTestSources(root, ['a.mjs', 'b.mjs'], () => new Promise(() => undefined))
        assertEq(summary.textContent, 'Loading 0/2')
    },
    // ...and it counts up as modules link, so a slow graph shows progress
    // rather than one frozen line.
    loadingProgress: async () => {
        const { root, summary } = page()
        /** @type {(module: Module) => void} */
        let release = () => undefined
        /** @type {Promise<Module>} */
        const pending = new Promise(resolve => { release = resolve })
        const done = startBrowserTestSources(root, ['a.mjs', 'b.mjs'],
            source => source === 'a.mjs' ? Promise.resolve({ proof: {} }) : pending)
        await Promise.resolve()
        await Promise.resolve()
        assertEq(summary.textContent, 'Loading 1/2: a.mjs')
        release({ proof: {} })
        assertEq((await done).status, 'passed')
    },
    // The same action starts every run: nothing but the `Run` control's own
    // state stands between a completed run and the next one.
    newRunAfterCompletion: async () => {
        const { root, runButton, states } = page()
        /** @type {() => Promise<Module>} */
        const load = () => Promise.resolve({ proof: { t: () => undefined } })
        await startBrowserTestSources(root, ['a.mjs'], load)
        assert(!runButton.attributes.has('disabled'))
        const second = await startBrowserTestSources(root, ['a.mjs'], load)
        assertEq(second.status, 'passed')
        assertEq(second.totals.tests, 1)
        assertEq(states.join(','), 'loading,running,passed,loading,running,passed')
    },
    // Rendering a result is the page's own code, so it is a failure point of
    // the page and not of the run: a renderer that throws must not cost the
    // report every consumer is waiting for.
    renderingThrows: async () => {
        const { root, results } = page()
        const append = results.append
        const report = await startBrowserTestSources(root, ['a.mjs'], async () => {
            // Break rendering only once the run is under way, so the page is
            // built normally and only the per-result append fails.
            Object.assign(results, { append: () => { throw new Error('render') } })
            return { proof: { t: () => undefined } }
        })
        Object.assign(results, { append })
        assertEq(report.status, 'passed')
        assertEq(report.totals.passed, 1)
    },
    // Describing a panic reads the value that caused it, so a value every trap
    // of which throws *itself* makes the description panic in turn. That is the
    // last handler there is: it may not fail, or the guard against a stuck page
    // becomes the thing that sticks it.
    unreadableFailure: async () => {
        /** @type {ProxyHandler<object>} */
        const handler = {}
        const hostile = new Proxy({}, handler)
        const rethrow = () => { throw hostile }
        Object.assign(handler, { has: rethrow, get: rethrow, ownKeys: rethrow })
        const { root, states } = page()
        const report = await startBrowserTestSources(root, ['a'], async () => ({
            proof: { boom: () => { throw hostile } },
        }))
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.message, 'The run failed with a value that cannot be read')
        assertEq(states.join(','), 'loading,running,infrastructure-error')
    },
    // `infrastructure-error` covers a panic and a runner missing an operation as
    // well as a module that would not link, so the summary must not diagnose
    // every one of them as a loading failure.
    infrastructureSummaryNamesNoCause: () => {
        const { root, summary } = page()
        renderBrowserReport(root, {
            status: 'infrastructure-error',
            browser: 'x',
            totals: { tests: 1, passed: 0, failed: 1 },
            duration: 0,
            results: [{ module: '', path: '', status: 'failed', duration: 0, message: 'no sandbox', stack: '' }],
        })
        assert(!summary.textContent.includes('to load'), summary.textContent)
        assert(summary.textContent.startsWith('Infrastructure error: 1 failed'), summary.textContent)
    },
    // A root whose document has no window still runs and still answers: there
    // is simply nowhere to publish the promise or dispatch the event.
    withoutView: async () => {
        const { root, view } = page(false)
        const report = await startBrowserTestSources(root, ['a'], async () => ({
            proof: { x: () => undefined },
        }))
        assertEq(report.status, 'passed')
        assertEq(report.browser, '')
        assertEq(view.events.length, 0)
        assertEq(view.fjsBrowserTestReport, undefined)
    },
    // A root with none of the page's elements is rendered into without a throw:
    // an embedder may host the runner in a bare container.
    renderWithoutElements: () => {
        const { root, states } = page()
        root.replaceChildren()
        renderBrowserReport(root, {
            status: 'passed',
            browser: 'x',
            totals: { tests: 0, passed: 0, failed: 0 },
            duration: 0,
            results: [],
        })
        assertEq(states.join(','), 'passed')
    },
    operations: {
        // `fetch` reads a `data:` URL rather than a network one, so the proof
        // stays offline while still going through the realm's own `fetch`.
        fetch: async () => {
            const r = await fetchOp('data:text/plain,ok')
            assert(r[0] === 'ok', r)
        },
        fetchFailure: async () => {
            const r = await fetchOp('not-a-scheme://x')
            assert(r[0] === 'error', r)
            assertEq(r[1][0], 'ioError')
        },
        import: async () => {
            const r = await importOp('./x.mjs')
            assertEq(/** @type {Module} */ (unwrap(r)).source, './x.mjs')
        },
        awaitsPromise: async () => {
            assertEq(unwrap(await awaitOp(Promise.resolve(7)))[0], 7)
        },
        awaitsPlainValue: async () => {
            assertEq(unwrap(await awaitOp(7))[0], 7)
        },
        // Epoch milliseconds, as the Node runner answers — but read through
        // `performance`, so two reads never come out in the wrong order however
        // the system clock is adjusted between them.
        now: async () => {
            const before = unwrap(await now())
            const after = unwrap(await now())
            assert(before > Date.UTC(2020, 0, 1), before)
            assert(after >= before, [before, after])
        },
        sandboxMeasures: async () => {
            const { result, duration } = unwrap(await sandbox(() => 1))
            assertEq(unwrap(result), 1)
            assert(duration >= 0, duration)
        },
        all: async () => {
            const results = unwrap(await all(pureOk(1), pureOk(2)))
            assertEq(results.map(unwrap).join(','), '1,2')
        },
        // Slicing must not serialize: every child is *started* before any is
        // awaited, so a child waiting on something a later sibling produces
        // still sees that sibling run. Awaiting each slice before starting the
        // next hangs this — the releaser sits in the second slice, which is
        // never reached — on a graph the Node runner completes.
        allStartsEveryChildBeforeAwaiting: async () => {
            /** @type {(value: unknown) => void} */
            let release = () => undefined
            /** @type {Promise<unknown>} */
            const gate = new Promise(resolve => { release = resolve })
            const filler = sandboxEffect(() => 0)
            const waits = sandboxEffect(() => gate)
            const releases = sandboxEffect(() => { release(1); return 0 })
            const many = [waits, ...[...new Array(9).keys()].map(() => filler), releases]
            /** @type {'hung'} */
            const hung = 'hung'
            const outcome = await Promise.race([
                commonRun(allEffect(...many)),
                new Promise(resolve => { setTimeout(resolve, 1000, hung) }),
            ])
            assert(outcome !== hung, 'all serialized its slices')
            assertEq(unwrap(/** @type {Result<readonly unknown[], never>} */ (outcome)).length, 11)
        },
        // Past the batch size `all` hands the event loop back, which is the only
        // thing that lets a page paint mid-suite: a timer queued before the call
        // has to run before it resolves. Without the slicing every child settles
        // on microtasks and no timer gets a turn — which is what this asserts,
        // since the effects below perform nothing.
        allYieldsBetweenBatches: async () => {
            let fired = false
            setTimeout(() => { fired = true }, 0)
            const many = [...new Array(60).keys()].map(i => pureOk(i))
            const results = unwrap(await all(...many))
            assertEq(results.length, 60)
            assertEq(results.map(unwrap).join(','), many.map((_, i) => i).join(','))
            assert(fired, 'all resolved without yielding to the event loop')
        },
    },
}
