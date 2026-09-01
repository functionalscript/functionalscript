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
import { renderBrowserReport, runBrowserProofs, startBrowserTests, startBrowserTestSources } from './module.mjs'
import { fmtImport, testResult } from '../module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/**
 * Builds the DOM stand-in the proofs drive the runner with. A single factory
 * rather than file-scope helpers so the mutually recursive
 * element/document/view types can stay function-local.
 */
const dom = () => {
    /** @typedef {{ readonly tag: string, attributes: ReadonlyMap<string, string>, readonly ownerDocument: _Document, textContent: string, readonly texts: string[], children: readonly _Element[], readonly setAttribute: (name: string, value: string) => void, readonly removeAttribute: (name: string) => void, readonly querySelector: (selector: string) => _Element | null, readonly replaceChildren: (...nodes: readonly _Element[]) => void, readonly append: (node: _Element) => void }} _Element */
    /** @typedef {{ defaultView: _View | null, readonly baseURI: string, readonly createElement: (tag: string) => _Element }} _Document */
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
        /** @type {string[]} */
        const texts = []
        /** @type {_Element} */
        const self = {
            tag,
            attributes: new Map(attributes.map(name => [name, ''])),
            ownerDocument: document,
            // Every line the element was given, not only the last: a page that
            // renders `Loading 3/141` and then a summary has said two things,
            // and a proof that reads the property afterwards can only see the
            // second. What the runner said *while running* is the subject of
            // the progress proof below.
            texts,
            get textContent() { return texts.length === 0 ? '' : texts[texts.length - 1] },
            set textContent(value) { texts.push(value) },
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
            // The runner resolves a source against this rather than against its
            // own module URL, so the stand-in has to carry one. The `data:`
            // sources below are already absolute and ignore it, which is what
            // makes them usable as fixtures at all.
            baseURI: 'https://example.invalid/',
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

    /** @type {(element: _Element) => readonly (string | undefined)[]} */
    const statuses = element => element.children.map(child => child.attributes.get('data-status'))

    return { element, page, statuses }
}

const { element, page, statuses } = dom()

/** @type {(proof: unknown) => ReturnType<typeof runBrowserProofs>} */
const run = proof => runBrowserProofs([['proof', proof]])

/**
 * A module written here, as a specifier the page's own `import()` resolves.
 *
 * The runner no longer takes an importer, so there is nothing to inject: the
 * loading proofs below import for real, which is closer to what a page does
 * than a hand-supplied loader was. What the *walk* decides — which outcome a
 * failure produces, what is announced — is proven without a DOM in
 * `./proof.f.mjs`.
 *
 * @type {(body: string) => string}
 */
const dataModule = body => `data:text/javascript,${encodeURIComponent(body)}`

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
    // A promise built in another realm is not `instanceof Promise`, so it is
    // walked as an ordinary proof tree rather than awaited — which is exactly
    // what `fjs t` does with it, and the point of this proof is that the two
    // agree. It is a known gap in both, recorded in
    // `../todo/imports-promises-realms.md`, and not one this runner may close on
    // its own. Reaching it needs `node:vm`, an iframe or a worker, which
    // FunctionalScript as specified cannot express — so only an impure proof
    // can build one, as this one does.

    // **This pins a defect, not a desired behaviour.** The name says so on
    // purpose: it appears in the suite output and in any report built from it,
    // where a reader meets the failure mode rather than an assertion that reads
    // like an endorsement.
    //
    // A rejected cross-realm promise is reported as a **pass**, and a resolved
    // one's subtree disappears — a promise has no enumerable keys, so the tests
    // inside it are never counted. `fjs t` does exactly the same, which is why
    // it is not fixed here: it is a property of the shared rule, and one runner
    // fixing it alone is the divergence this work exists to remove. See
    // `../todo/imports-promises-realms.md`, which carries the options and what
    // each costs.
    crossRealmPromiseSilentlyPasses: async () => {
        const other = runInNewContext('({ resolve: v => Promise.resolve(v) })')
        const resolved = await run({
            nested: () => other.resolve({ child: () => { throw 'boom' } }),
        })
        // One test where there are two: the `child` inside the promise is never
        // discovered.
        assertEq(resolved.totals.tests, 1)
        assertEq(resolved.totals.failed, 0)
        assertEq(resolved.results[0]?.path, '.nested')
        // A *rejected* cross-realm promise is the sharper symptom and cannot be
        // proven here: never awaited, its rejection goes unhandled, and Node's
        // default takes the process down before the report is even read. That
        // is measured in `../todo/imports-promises-realms.md` rather than
        // asserted, because a proof that kills the runner is not a proof.
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
    manyLeaves: async () => {
        // The walk is a loop over one leaf at a time now rather than a batch
        // recursion, and it still runs all of them.
        const report = await run(Object.fromEntries(
            Array.from({ length: 30 }, (_, index) => [`t${index}`, () => undefined])))
        assertEq(report.totals.tests, 30)
        assertEq(report.totals.passed, 30)
    },
    /**
     * **The run yields the task between leaves**, which is the port's only
     * scheduling and the page's only defence against the single-task freeze: a
     * suite that never returns to the event loop paints nothing until it ends,
     * however many rows it has appended.
     *
     * The assertion is an *ordering sentinel* rather than anything read off the
     * DOM, and that is the point. A row is appended synchronously inside the
     * report handler, so the document looks identical with the await deleted —
     * the trap `todo/share-browser-console-runner.md` catalogs as item 11, a
     * proof that observes a coincidence. What only a real yield can produce is
     * a *macrotask enqueued by one leaf running before the next leaf does*.
     *
     * Mutation-checked: delete the `await` in the report handler and the
     * sentinel lands after both leaves — `a b sentinel` — because nothing
     * returned to the event loop in between.
     */
    yieldsBetweenLeaves: async () => {
        /** @type {readonly string[]} */
        let events = []
        /** @type {(name: string) => void} */
        const record = name => { events = [...events, name] }
        await runBrowserProofs([['m', {
            a: () => {
                record('a')
                setTimeout(() => record('sentinel'), 0)
            },
            b: () => { record('b') },
        }]])
        assertStructurallySame(events, ['a', 'sentinel', 'b'])
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
        const report = await startBrowserTestSources(p.root, [
            dataModule('export const proof = { a: () => undefined }'),
            dataModule('export const proof = { b: () => undefined }'),
        ])
        assertEq(report.status, 'passed')
        assertEq(report.totals.tests, 2)
        assertStructurallySame([...p.states], ['loading', 'running', 'passed'])
        assertEq(await p.view.fjsBrowserTestReport, report)
    },
    // **A module's other exports are not tests.** What reaches the traversal is
    // the module's `proof`, so a suite whose modules export anything else runs
    // what it was asked to and nothing more — and the leaf is named `.a`, not
    // `.proof.a`. Counting tests cannot see this: one extra export and one
    // proof come to the same total either way.
    onlyTheProofExportIsRun: async () => {
        const p = page()
        const report = await startBrowserTestSources(p.root, [dataModule(
            'export const other = () => { throw new Error("not a test") }\n'
            + 'export const proof = { a: () => undefined }')])
        assertEq(report.status, 'passed')
        assertEq(report.totals.tests, 1)
        assert((report.results[0]?.name ?? '').endsWith('.proof.a()'), report.results[0]?.name)
    },
    sourcesLoadingSummaryIsSynchronous: () => {
        // The summary must not keep showing idle text through loading: it is
        // replaced the instant a run starts, before any import has had a chance
        // to settle — even one that never does.
        const p = page()
        void startBrowserTestSources(p.root, ['data:text/javascript,export const proof = {}'])
        assertEq(p.summary.textContent, 'Loading 0/1')
    },
    sourcesProgress: async () => {
        // **The count is the page's**, and this is where it is proven. Loads are
        // fanned out, so no branch of the walk knows how many others have
        // finished: it announces each module as it lands, and this file counts
        // what it has seen. A runner that announced under another name — or a
        // page that counted the wrong event — would sit at `Loading 0/N` for a
        // whole run, which reading the summary at the end cannot see.
        //
        // The *lines said while loading* are the subject, so the assertion is
        // on what was rendered rather than on what is left showing. One source,
        // because two concurrent imports have no guaranteed order between them.
        const p = page()
        const source = dataModule('export const proof = { a: () => undefined }')
        const report = await startBrowserTestSources(p.root, [source])
        assertEq(report.status, 'passed')
        assertStructurallySame(
            p.summary.texts.filter(t => t.startsWith('Loading')),
            ['Loading 0/1', `Loading 1/1: ${source}`])
    },
    sourceThatCannotBeImported: async () => {
        // A source the page cannot import is a loader failure like any other:
        // the page must not be left in `loading` with no report and no
        // completion event for a controller to act on.
        const p = page()
        const report = await startBrowserTestSources(p.root, ['data:text/javascript,synt@x error'])
        assertEq(report.status, 'infrastructure-error')
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertStructurallySame([...p.states], ['loading', 'infrastructure-error'])
        assertEq(p.view.events.length, 1)
    },
    // A module whose *thrown value* cannot be described either — the page must
    // still reach a terminal state. Describing runs the value's own code, so an
    // unguarded normalisation rejects the run and leaves the page at
    // `Loading 0/N` for ever: no report, no completion event, nothing an
    // automated controller can act on.
    hostileModuleRejectionIsStillReported: async () => {
        const p = page()
        const report = await startBrowserTestSources(p.root, [
            dataModule('throw { toString() { throw new Error("hostile") } }'),
        ])
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.message, 'Unknown thrown value')
        assertStructurallySame([...p.states], ['loading', 'infrastructure-error'])
        assertEq(p.view.events.length, 1)
    },
    runControlAbsentButtonIsIgnored: async () => {
        // An embedding root with no `[data-test-run]` control is still
        // supported: `setState` finds nothing to toggle and moves on rather
        // than throwing.
        /** @type {string[]} */
        const states = []
        /** @type {Parameters<typeof element>[0]} */
        const document = {
            defaultView: null,
            // The runner resolves a source against this rather than against its
            // own module URL, so the stand-in has to carry one. The `data:`
            // sources below are already absolute and ignore it, which is what
            // makes them usable as fixtures at all.
            baseURI: 'https://example.invalid/',
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
        const done = startBrowserTestSources(p.root,
            [dataModule('export const proof = { t: () => undefined }')])
        // Synchronously, before the import settles: the control is passive from
        // the click, not from the first module's arrival.
        assertEq(p.states[0], 'loading')
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
        const report = await startBrowserTestSources(p.root, ['data:text/javascript,synt@x'])
        assertEq(report.status, 'infrastructure-error')
        assertEq(p.runButton.attributes.has('disabled'), false)
    },
    runControlNewRunAfterCompletion: async () => {
        // The same action starts every run: nothing but the `Run` control's
        // own state stands between a completed run and the next one.
        const p = page()
        const source = dataModule('export const proof = { t: () => undefined }')
        await startBrowserTestSources(p.root, [source])
        assertEq(p.runButton.attributes.has('disabled'), false)
        const second = await startBrowserTestSources(p.root, [source])
        assertEq(second.status, 'passed')
        assertStructurallySame([...p.states],
            ['loading', 'running', 'passed', 'loading', 'running', 'passed'])
    },
    sourcesLoadFailure: async () => {
        const p = page()
        const bad = 'data:text/javascript,synt@x error'
        const report = await startBrowserTestSources(p.root,
            [dataModule('export const proof = { t: () => undefined }'), bad])
        assertEq(report.status, 'infrastructure-error')
        // The totals have to agree with `results`: a consumer reading
        // `0 of 0` would take a broken suite for an empty one.
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        // Named by the source, which is all a module that never linked has.
        assertEq(report.results[0]?.module, bad)
        assertStructurallySame([...p.states], ['loading', 'infrastructure-error'])
        assert(p.summary.textContent.startsWith('Infrastructure error: 1 failed to load'),
            p.summary.textContent)
        assertStructurallySame([...statuses(p.results)], ['failed'])
        assertEq(p.view.events.length, 1)
    },
}
