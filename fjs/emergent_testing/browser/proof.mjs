/**
 * Proofs for the browser runner.
 *
 * The runner reaches the page only through the root element it is handed, so
 * the DOM stand-in below is enough to drive every rendering branch from Node —
 * no headless browser, and no global `window`/`document` for these proofs to
 * install and unset.
 */

import { runInNewContext } from 'node:vm'

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { renderBrowserReport, runBrowserProofs, startBrowserTests, startBrowserTestSources } from '../browser.mjs'
import { fmtImport, testResult } from '../module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/** @typedef {{ readonly tag: string, attributes: ReadonlyMap<string, string>, readonly ownerDocument: _Document, textContent: string, children: readonly _Element[], readonly setAttribute: (name: string, value: string) => void, readonly removeAttribute: (name: string) => void, readonly querySelector: (selector: string) => _Element | null, readonly replaceChildren: (...nodes: readonly _Element[]) => void, readonly append: (node: _Element) => void }} _Element */
/** @typedef {{ defaultView: _View | null, readonly createElement: (tag: string) => _Element }} _Document */
/** @typedef {{ events: readonly CustomEvent[], readonly dispatchEvent: (event: Event) => boolean, fjsBrowserTestReport?: Promise<unknown> }} _View */

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
        // The runner only ever queries an attribute selector of `[name]` form.
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
 * Builds what the generated page gives the runner: a root carrying the summary
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

/** @type {(proof: unknown) => ReturnType<typeof runBrowserProofs>} */
const run = proof => runBrowserProofs([['proof', proof]])

/** @type {(element: _Element) => readonly (string | undefined)[]} */
const statuses = element => element.children.map(child => child.attributes.get('data-status'))

export const proof = {
    namedThrow: async () => {
        const named = { throw: () => { throw 'expected' } }.throw
        const report = await run({ extracted: named })
        assertEq(report.status, 'passed')
    },
    path: async () => {
        const report = await run({ 'a.b': () => undefined })
        assertEq(report.results[0]?.path, '["a.b"]')
    },
    // The page and `fjs t` must name a leaf identically, or two reports of the
    // same suite cannot be compared. Asserting against `fmtImport` — the
    // function the console runner prints its result lines with — is what makes
    // that a shared fact rather than two spellings that happen to agree today.
    nameMatchesTheConsoleRunner: async () => {
        const report = await run({ nested: () => ({ child: () => undefined }) })
        assertEq(report.results[0]?.name, fmtImport('proof', ['nested']))
        assertEq(report.results[1]?.name, fmtImport('proof', ['nested', null, 'child']))
        assertEq(report.results[1]?.name, 'import("proof").proof.nested().child()')
    },
    // The page does not build a leaf's identity, status or duration itself: it
    // asks `testResult`, which is what the console runner asks. Comparing a
    // real browser result against that function — rather than against a literal
    // — is what makes the two runners' agreement a fact about shared code.
    normalizedResultMatchesTheSharedOne: async () => {
        const report = await run({ passes: () => undefined, fails: () => { throw 'boom' } })
        const [first, second] = report.results
        assertNotNullish(first)
        assertNotNullish(second)
        assertStructurallySame(
            { ...first },
            testResult('proof', ['passes'], { result: ok(undefined), duration: first.duration }))
        assertStructurallySame(
            { ...second, message: undefined, stack: undefined },
            { ...testResult('proof', ['fails'], { result: error('boom'), duration: second.duration }),
                message: undefined, stack: undefined })
        assertEq(second.status, 'failed')
    },
    // The expectation is inverted through the same `invert` the console runner
    // uses, so a proof that was supposed to throw and did is a pass in both.
    expectedThrowStatusMatchesTheSharedOne: async () => {
        const report = await run({ throw: { boom: () => { throw 'expected' } } })
        assertEq(report.results[0]?.status, 'passed')
        assertEq(report.results[0]?.status,
            testResult('proof', ['throw', 'boom'], { result: ok('expected'), duration: 0 }).status)
    },
    // A module that cannot be enumerated has no leaf to name, and an empty
    // `path` does not distinguish it from a proof exported as a bare function.
    // The module is what is known, so the module is the name.
    unreadableModuleIsNamedByItsSource: async () => {
        const report = await run(new Proxy({}, { ownKeys: () => { throw 'hostile' } }))
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.name, 'proof')
    },
    arbitraryThrow: async () => {
        const report = await run({ fail: () => { throw Object.create(null) } })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'Unknown thrown value')
    },
    errorFields: async () => {
        const error = new Proxy(new Error(), {
            get: (target, property) => property === 'message' || property === 'stack'
                ? Symbol(property)
                : Reflect.get(target, property),
        })
        const report = await run({ fail: () => { throw error } })
        assertEq(report.results[0]?.message, 'Symbol(message)')
        assertEq(report.results[0]?.stack, 'Symbol(stack)')
    },
    errorAccessorThrows: async () => {
        const error = new Error('hidden')
        Object.defineProperty(error, 'message', {
            get: () => { throw new Error('message getter failed') },
        })
        const report = await run({ fail: () => { throw error } })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'Unknown thrown value')
        assertEq(report.results[0]?.stack, 'Unknown thrown value')
    },
    revokedErrorProxy: async () => {
        const { proxy, revoke } = Proxy.revocable(new Error('revoked'), {})
        revoke()
        const report = await run({ fail: () => { throw proxy } })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'Unknown thrown value')
    },
    crossRealmError: async () => {
        // An Error from another realm is not `instanceof Error` here, and its
        // stack is what the report exists to carry.
        const other = runInNewContext(
            '({ fail: () => { throw new Error(\'cross boom\') } })')
        const report = await run({ fail: other.fail })
        assertEq(report.results[0]?.message, 'cross boom')
        const stack = report.results[0]?.stack ?? ''
        assert(stack !== 'cross boom', stack)
        assert(stack.includes('cross boom'), stack)
    },
    errorWithoutStack: async () => {
        const error = new Error('no stack')
        const report = await run({ fail: () => { throw Object.assign(error, { stack: undefined }) } })
        assertEq(report.results[0]?.message, 'no stack')
        assertEq(report.results[0]?.stack, 'no stack')
    },
    expectedThrow: async () => {
        const report = await run({ throw: { silent: () => undefined } })
        assertEq(report.status, 'failed')
        assertEq(report.results[0]?.message, 'Expected the proof to throw')
    },
    crossRealmPromise: async () => {
        // A promise built in another realm is not `instanceof Promise`. The
        // runner has to await it anyway and walk the tree it resolves to,
        // otherwise a rejected cross-realm promise is reported as a pass.
        const other = runInNewContext('({ resolve: value => Promise.resolve(value) })')
        const report = await run({
            nested: () => other.resolve({ child: () => { throw 'boom' } }),
        })
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[1]?.path, '.nested().child')
    },
    spoofedPromiseTag: async () => {
        const report = await run({
            nested: () => ({
                [Symbol.toStringTag]: 'Promise',
                then: /** @type {(...args: (() => void)[]) => void} */ ((...args) => { args[0]?.() }),
            }),
        })
        assertEq(report.totals.tests, 2)
        assertEq(report.results[1]?.path, '.nested().then')
    },
    frozenPromiseTag: async () => {
        // A non-extensible spoof leaves the runner nothing to shadow, the same
        // dead end a pinned promise reaches. It is still an ordinary proof
        // tree, so it is walked rather than reported as a brand-check failure.
        const report = await run({
            nested: () => Object.freeze({
                [Symbol.toStringTag]: 'Promise',
                then: () => undefined,
            }),
        })
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 0)
        assertEq(report.results[1]?.path, '.nested().then')
    },
    exportedTreeThrows: async () => {
        // The exported tree is read before any test runs, and reading it runs
        // user code as well. The module fails; the page still gets its report.
        const p = page()
        const report = await startBrowserTests(p.root,
            [['m', { get bad() { throw new Error('enumerating') } }]])
        assertEq(report.status, 'failed')
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertEq(report.results[0]?.module, 'm')
        assertEq(report.results[0]?.message, 'enumerating')
        assertStructurallySame([...p.states], ['running', 'failed'])
        assertEq(p.view.events.length, 1)
    },
    returnedTreeThrows: async () => {
        // Reading the returned tree runs user code. When it throws, the test
        // that produced the value fails and the page still reaches a terminal
        // state — a rejected run would leave it in `running` forever.
        const p = page()
        const report = await startBrowserTests(p.root,
            [['m', { nested: () => ({ get bad() { throw new Error('getter') } }) }]])
        assertEq(report.status, 'failed')
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertEq(report.results[0]?.message, 'getter')
        assertStructurallySame([...p.states], ['running', 'failed'])
        assertEq(p.view.events.length, 1)
    },
    speciesResultIsNotAPromise: async () => {
        // `then` builds its result through `constructor[Symbol.species]`, and a
        // promise can make that an ordinary object. The run has to answer with
        // the promise it subscribed to, not with what `then` handed back, or
        // the test ends before the promise settles and the species object
        // itself lands in the report.
        const species = function (/** @type {(...args: (() => void)[]) => void} */ executor) {
            executor(() => undefined, () => undefined)
            return { notAPromise: true }
        }
        const promised = new Promise(resolve =>
            setTimeout(resolve, 1, { child: () => { throw 'boom' } }))
        Object.defineProperty(promised, 'constructor',
            { value: { [Symbol.species]: species }, configurable: true })
        const report = await run({ nested: () => promised })
        assertEq(report.totals.tests, 2)
        assertEq(report.totals.failed, 1)
        assertEq(report.results[1]?.path, '.nested().child')
    },
    reportingThrows: async () => {
        // Announcing a result as it lands is the page's own rendering. It must
        // not take the run down with it: the report is what the page waits for.
        const report = await runBrowserProofs([['m', { t: () => undefined }]],
            () => { throw new Error('render') })
        assertEq(report.status, 'passed')
        assertEq(report.totals.passed, 1)
    },
    thenIsATestName: async () => {
        // A `then` proof entry is a test called `then`, never a thenable for
        // the runner to adopt.
        const report = await run({ then: () => undefined })
        assertEq(report.totals.tests, 1)
        assertEq(report.results[0]?.path, '.then')
    },
    batches: async () => {
        // More leaves than one batch holds, so the batch loop recurses.
        const report = await run(Object.fromEntries(
            Array.from({ length: 30 }, (_, index) => [`t${index}`, () => undefined])))
        assertEq(report.totals.tests, 30)
        assertEq(report.totals.passed, 30)
    },
    render: async () => {
        const p = page()
        const report = await startBrowserTests(p.root,
            [['m', { ok: () => undefined, bad: () => { throw 'x' } }]])
        assertEq(report.status, 'failed')
        assertStructurallySame([...p.states], ['running', 'failed'])
        assertEq(p.summary.textContent, `1 passed, 1 failed (${report.duration.toFixed(1)} ms)`)
        assertStructurallySame([...statuses(p.results)], ['passed', 'failed'])
        const event = assertNotNullish(p.view.events[0])
        assertEq(event.type, 'fjs-browser-test-complete')
        assertEq(event.detail, report)
        assertEq(await p.view.fjsBrowserTestReport, report)
    },
    renderWithoutView: async () => {
        // A detached document has no window: the run still renders, and
        // nothing is published or announced.
        const p = page(false)
        const report = await startBrowserTests(p.root, [['m', { ok: () => undefined }]])
        assertEq(report.status, 'passed')
        assertEq(p.summary.textContent, `1 passed, 0 failed (${report.duration.toFixed(1)} ms)`)
        assertEq(p.view.events.length, 0)
        assertEq(p.view.fjsBrowserTestReport, undefined)
    },
    renderReport: () => {
        // The renderer is exported on its own for a controller that already
        // holds a report.
        const p = page()
        renderBrowserReport(p.root, {
            status: 'passed',
            browser: 'test',
            totals: { tests: 1, passed: 1, failed: 0 },
            duration: 1,
            results: [{ module: 'm', path: '.t', name: 'import("m").proof.t()', status: 'passed', duration: 0.5 }],
        })
        assertEq(p.summary.textContent, '1 passed, 0 failed (1.0 ms)')
        assertEq(p.results.children[0]?.textContent, 'PASS import("m").proof.t() (0.5 ms)')
    },
    sources: async () => {
        const p = page()
        const report = await startBrowserTestSources(p.root, ['a.mjs', 'b.mjs'],
            source => Promise.resolve({ proof: { [source]: () => undefined } }))
        assertEq(report.status, 'passed')
        assertEq(report.totals.tests, 2)
        assertStructurallySame([...p.states], ['loading', 'running', 'passed'])
        assertEq(await p.view.fjsBrowserTestReport, report)
    },
    sourcesLoadingSummaryIsSynchronous: () => {
        // The summary must not keep showing idle text through loading: it is
        // replaced the instant a run starts, before any import has had a
        // chance to settle — even one that never does.
        const p = page()
        void startBrowserTestSources(p.root, ['a.mjs', 'b.mjs'], () => new Promise(() => undefined))
        assertEq(p.summary.textContent, 'Loading 0/2')
    },
    sourcesProgress: async () => {
        const p = page()
        /** @type {(module: { readonly proof?: unknown }) => void} */
        let release = () => undefined
        /** @type {Promise<{ readonly proof?: unknown }>} */
        const pending = new Promise(resolve => { release = resolve })
        const done = startBrowserTestSources(p.root, ['a.mjs', 'b.mjs'],
            source => source === 'a.mjs' ? Promise.resolve({ proof: {} }) : pending)
        await Promise.resolve()
        await Promise.resolve()
        assertEq(p.summary.textContent, 'Loading 1/2: a.mjs')
        release({ proof: {} })
        assertEq((await done).status, 'passed')
    },
    sourcesImporterThrows: async () => {
        // An importer that throws before it returns a promise is a loader
        // failure like any other: the page must not be left in `loading` with
        // no report and no completion event.
        const p = page()
        const report = await startBrowserTestSources(p.root, ['bad.mjs'],
            source => { throw new Error(`no loader for ${source}`) })
        assertEq(report.status, 'infrastructure-error')
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertEq(report.results[0]?.message, 'no loader for bad.mjs')
        assertStructurallySame([...p.states], ['loading', 'infrastructure-error'])
        assertEq(p.view.events.length, 1)
    },
    runControlAbsentButtonIsIgnored: async () => {
        // An embedding root with no `[data-test-run]` control is still
        // supported: `setState` finds nothing to toggle and moves on rather
        // than throwing.
        /** @type {string[]} */
        const states = []
        /** @type {_Document} */
        const document = {
            defaultView: null,
            createElement: tag => element(document, tag, [], states),
        }
        const root = element(document, 'main', ['data-browser-tests'], states)
        root.replaceChildren(
            element(document, 'p', ['data-test-summary'], states),
            element(document, 'ol', ['data-test-results'], states))
        const report = await startBrowserTests(/** @type {Element} */ (/** @type {unknown} */ (root)),
            [['m', { ok: () => undefined }]])
        assertEq(report.status, 'passed')
    },
    runControlDisabledWhileActive: async () => {
        // `Run` must be passive — genuinely disabled, not just click-ignoring —
        // for the whole span between a click and the next terminal state:
        // through loading and through execution.
        const p = page()
        /** @type {(module: { readonly proof?: unknown }) => void} */
        let release = () => undefined
        /** @type {Promise<{ readonly proof?: unknown }>} */
        const pending = new Promise(resolve => { release = resolve })
        const done = startBrowserTestSources(p.root, ['a.mjs'], () => pending)
        await Promise.resolve()
        assertEq(p.states[0], 'loading')
        assertEq(p.runButton.attributes.has('disabled'), true)
        release({ proof: { t: () => undefined } })
        await Promise.resolve()
        await Promise.resolve()
        assertEq(p.runButton.attributes.has('disabled'), true)
        const report = await done
        assertEq(report.status, 'passed')
        // Terminal state hands control back: a new run can be started.
        assertEq(p.runButton.attributes.has('disabled'), false)
    },
    runControlReenabledAfterFailure: async () => {
        // A failed or infrastructure-error run is just as terminal as a passed
        // one: `Run` reactivates either way.
        const p = page()
        const report = await startBrowserTestSources(p.root, ['bad.mjs'],
            source => Promise.reject(new Error(`offline: ${source}`)))
        assertEq(report.status, 'infrastructure-error')
        assertEq(p.runButton.attributes.has('disabled'), false)
    },
    runControlNewRunAfterCompletion: async () => {
        // The same action starts every run: nothing but the `Run` control's
        // own state stands between a completed run and the next one.
        const p = page()
        await startBrowserTestSources(p.root, ['a.mjs'],
            () => Promise.resolve({ proof: { t: () => undefined } }))
        assertEq(p.runButton.attributes.has('disabled'), false)
        const second = await startBrowserTestSources(p.root, ['a.mjs'],
            () => Promise.resolve({ proof: { t: () => undefined } }))
        assertEq(second.status, 'passed')
        assertStructurallySame([...p.states],
            ['loading', 'running', 'passed', 'loading', 'running', 'passed'])
    },
    sourcesLoadFailure: async () => {
        const p = page()
        const report = await startBrowserTestSources(p.root, ['ok.mjs', 'bad.mjs'],
            source => source === 'bad.mjs'
                ? Promise.reject(new Error('offline'))
                : Promise.resolve({ proof: { t: () => undefined } }))
        assertEq(report.status, 'infrastructure-error')
        // The totals have to agree with `results`: a consumer reading
        // `0 of 0` would take a broken suite for an empty one.
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertEq(report.results[0]?.module, 'bad.mjs')
        assertEq(report.results[0]?.message, 'offline')
        assertStructurallySame([...p.states], ['loading', 'infrastructure-error'])
        assert(p.summary.textContent.startsWith('Infrastructure error: 1 failed to load'),
            p.summary.textContent)
        assertStructurallySame([...statuses(p.results)], ['failed'])
        assertEq(p.view.events.length, 1)
    },
}
