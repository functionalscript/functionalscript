/**
 * Proofs for the browser runner.
 *
 * The runner reaches the page only through the root element it is handed, so
 * the DOM stand-in below is enough to drive every rendering branch from Node —
 * no headless browser, and no global `window`/`document` for these proofs to
 * install and unset.
 *
 * @import { _BrowserReport } from '../types.ts'
 * @import { Catch, Sandbox } from '../../effects/common/types.ts'
 * @import { ToAsyncOperationMap } from '../../effects/types.ts'
 */

import { runInNewContext } from 'node:vm'

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { _runBrowserProofsWith, renderBrowserReport, runBrowserProofs, startBrowserTests, startBrowserTestSources } from './module.mjs'
import { fmtImport, testResult } from '../module.f.mjs'
import { groupByModule, runnerSource } from './module.f.mjs'
import { demo } from './demo.f.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { commonOperationMap } from '../../effects/common/module.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'

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
     * `baseURI` is what the runner resolves a relative source against, so a
     * proof about resolution supplies a real one.
     *
     * @type {(withView?: boolean, baseURI?: string) => { readonly root: Element, readonly counts: _Element, readonly summary: _Element, readonly results: _Element, readonly runButton: _Element, readonly view: _View, readonly states: readonly string[] }}
     */
    const page = (withView = true, baseURI = 'https://example.invalid/') => {
        /** @type {string[]} */
        const states = []
        /** @type {_Document} */
        const document = {
            defaultView: null,
            // The runner resolves a source against this rather than against its
            // own module URL, so the stand-in has to carry one. The `data:`
            // sources below are already absolute and ignore it, which is what
            // makes them usable as fixtures at all.
            baseURI,
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
            element(document, 'span', ['data-test-counts'], states),
            element(document, 'p', ['data-test-summary'], states),
            element(document, 'button', ['data-test-run'], states),
            element(document, 'div', ['data-test-results'], states))
        return {
            root: /** @type {Element} */ (/** @type {unknown} */ (root)),
            counts: assertNotNullish(root.querySelector('[data-test-counts]')),
            summary: assertNotNullish(root.querySelector('[data-test-summary]')),
            results: assertNotNullish(root.querySelector('[data-test-results]')),
            runButton: assertNotNullish(root.querySelector('[data-test-run]')),
            view,
            states,
        }
    }

    /**
     * Every row of a rendered report, in order, across its module groups — so a
     * proof about rows reads the same whether or not it is about grouping.
     *
     * @type {(results: _Element) => readonly _Element[]}
     */
    const rows = results => results.children.flatMap(group =>
        group.children.find(child => child.tag === 'ol')?.children ?? [])

    /** @type {(element: _Element) => readonly (string | undefined)[]} */
    const statuses = element => rows(element).map(child => child.attributes.get('data-status'))

    /**
     * What the title's counts say, one entry per part — which part it is,
     * and its text. The duration's text is a wall-clock reading, so it is
     * named and not compared.
     *
     * @type {(counts: _Element) => readonly (readonly [string, string])[]}
     */
    const countParts = counts => counts.children.map(child => {
        const [name] = [...child.attributes.keys()]
        return /** @type {const} */ ([name ?? '', name === 'data-duration' ? '' : child.textContent])
    })

    return { countParts, element, page, rows, statuses }
}

const { countParts, element, page, rows, statuses } = dom()

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

    /**
     * **The run's own failure, not any proof's.** A handler of the page's
     * interpreter throws, so the whole run rejects — the one route
     * `runProofs` cannot decide, because its error channel is `never` and a
     * rejection is not a value it was handed.
     *
     * What the page depends on is that the rejection still *resolves* the
     * published report: a run that rejected without this guard leaves the page
     * in `running` forever, waiting on a promise that will not settle. So the
     * assertions are the report's, not the promise's — it arrives, it says
     * `infrastructure-error`, and its one row is named after the runner rather
     * than after a module, because the walk is one effect and a rejection is
     * not attributable to the module it happened under.
     *
     * Mutation-checked: delete `.catch(runnerFailure)` and this rejects
     * instead of reporting, which is the failure mode itself.
     */
    aThrowingHandlerIsTheRunnersOwnFailure: async () => {
        const report = await _runBrowserProofsWith(map => ({
            ...map,
            sandbox: () => { throw new Error('interpreter') },
        }))([['m', { t: () => undefined }]])
        assertEq(report.status, 'infrastructure-error')
        assertStructurallySame({ ...report.totals }, { tests: 1, passed: 0, failed: 1 })
        assertEq(report.results[0]?.module, runnerSource)
        assertEq(report.results[0]?.message, 'interpreter')
    },
    /**
     * The same route reached one level deeper: a command the interpreter
     * cannot dispatch at all. `match` panics on a missing handler — an omitted
     * operation is a malformed program, not a capability answer — and that
     * panic is inside the awaited loop, so it arrives as the same rejection.
     *
     * Worth its own case because the two are indistinguishable *after* the
     * `catch` and not before it: this one never reaches a handler, so a fix
     * that only guarded handler bodies would leave it hanging the page.
     */
    anUndispatchableCommandIsTheSameFailure: async () => {
        const report = await _runBrowserProofsWith(({ sandbox, ...rest }) =>
            /** @type {ToAsyncOperationMap<Catch | _BrowserReport | Sandbox>} */ (rest))(
            [['m', { t: () => undefined }]])
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.module, runnerSource)
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
     * the trap `../README.md`'s pitfall catalog names as item 11, a proof
     * that observes a coincidence. What only a real yield can produce is
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
    /**
     * **A leaf is announced, and the thread goes back to the browser before
     * its body takes it.** Appending the pending row is not the property — the
     * row is in the document either way, and a body that blocks cannot see
     * from inside its own task whether anything was painted. Catalog item 11
     * is exactly this shape of proof, so the assertion is an *ordering
     * sentinel*: a macrotask queued before the run must be observed to fire
     * before the first proof body runs, which only a real yield between the
     * announcement and the body can produce.
     *
     * Mutation-checked: delete the `await macrotask()` in the page's `report`
     * handler and the order becomes `a sentinel` — the body ran first, because
     * nothing returned to the event loop after the leaf was announced.
     */
    startYieldsBeforeTheBody: async () => {
        /** @type {readonly string[]} */
        let events = []
        /** @type {(name: string) => void} */
        const record = name => { events = [...events, name] }
        setTimeout(() => record('sentinel'), 0)
        await runBrowserProofs([['m', { a: () => { record('a') } }]])
        assertStructurallySame(events, ['sentinel', 'a'])
    },
    /**
     * **The row exists, says `running`, and names the leaf — while the leaf is
     * running.** Read from inside the proof body, because that is the only
     * moment the claim is about: afterwards every row is settled, and a run
     * that never announced anything would look identical.
     */
    aRunningLeafHasItsOwnRow: async () => {
        const p = page()
        /** @type {readonly (string | undefined)[]} */
        let seen = []
        /** @type {readonly (string | undefined)[]} */
        let text = []
        await startBrowserTests(p.root, [['m', {
            a: () => {
                seen = [...statuses(p.results)]
                text = [rows(p.results)[0]?.textContent]
            },
        }]])
        assertStructurallySame(seen, ['running'])
        assertStructurallySame(text, ['RUN  import("m").proof.a()'])
    },
    /**
     * **The result settles that row rather than adding a second one.** One
     * leaf, one row, from announcement to verdict — checked before
     * `renderBrowserReport` rewrites the list at the end, which would hide a
     * duplicate.
     */
    aResultSettlesThePendingRow: async () => {
        const p = page()
        /** @type {number[]} */
        let counts = []
        await startBrowserTests(p.root, [['m', {
            a: () => { counts = [...counts, rows(p.results).length] },
            b: () => { counts = [...counts, rows(p.results).length] },
        }]])
        // One row while `a` runs, two while `b` does: `a`'s verdict landed in
        // the row `a` was already in.
        assertStructurallySame(counts, [1, 2])
        assertStructurallySame([...statuses(p.results)], ['passed', 'passed'])
    },
    render: async () => {
        const p = page()
        const report = await startBrowserTests(p.root,
            [['m', { ok: () => undefined, bad: () => { throw 'x' } }]])
        assertEq(report.status, 'failed')
        assertStructurallySame([...p.states], ['running', 'failed'])
        // The counts are the title's, so the line under it has nothing to add.
        assertEq(p.summary.textContent, '')
        assertStructurallySame(countParts(p.counts),
            [['data-count-passed', '1 passed'], ['data-count-failed', '1 failed'], ['data-duration', '']])
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
        assertEq(p.summary.textContent, '')
        // Nothing failed, so there is no red count at all — not a red zero.
        assertStructurallySame(countParts(p.counts), [['data-count-passed', '1 passed'], ['data-duration', '']])
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
        assertEq(p.summary.textContent, '')
        assertStructurallySame(p.counts.children.map(child => child.textContent), ['1 passed', '1.0 ms'])
        assertEq(rows(p.results)[0]?.textContent, 'PASS import("m").proof.t() (0.5 ms)')
    },
    /**
     * **One group per module, folded when it passed and open when it did
     * not.** A suite of thousands of rows becomes a list of modules, and the
     * only groups a reader has to open are the failed ones — which the page
     * has already opened.
     */
    groupsByModule: async () => {
        const p = page()
        await startBrowserTests(p.root, [
            ['m', { a: () => undefined, b: () => undefined }],
            ['n', { c: () => { throw 'x' } }],
        ])
        const groups = p.results.children
        assertStructurallySame(groups.map(g => g.attributes.get('data-test-module')), ['m', 'n'])
        assertStructurallySame(groups.map(g => g.attributes.get('data-status')), ['passed', 'failed'])
        assertStructurallySame(groups.map(g => g.attributes.has('open')), [false, true])
        assertStructurallySame(groups.map(g => g.querySelector('[data-path]')?.textContent), ['m', 'n'])
        assertStructurallySame(groups.map(g => g.querySelector('[data-counts]')?.textContent), ['2 passed', '1 failed · 0 passed'])
        // The dot is its own element, so the stylesheet colours it by the
        // group's status rather than by reading its text.
        assert(groups.every(g => g.querySelector('[data-dot]') !== null), 'every group line has a dot')
    },
    /**
     * **A failure's error is a block of its own under its row**, not more text
     * on the same line: the row stays one line to scan past, and the message
     * and stack keep their line breaks.
     */
    anErrorIsItsOwnBlock: async () => {
        const p = page()
        await startBrowserTests(p.root, [['m', { bad: () => { throw new Error('boom') } }]])
        const row = assertNotNullish(rows(p.results)[0])
        assert(row.textContent.startsWith('FAIL import("m").proof.bad() ('), row.textContent)
        const block = assertNotNullish(row.children.find(child => child.attributes.has('data-test-error')))
        assertEq(block.tag, 'pre')
        assert(block.textContent.startsWith('boom\n'), block.textContent)
    },
    /**
     * **While the run goes on, a module that passed folds as soon as the next
     * one starts, and one that failed stays open.** Read from inside the last
     * module's leaf, because the settled report is rebuilt at the end and would
     * look the same whether or not the live page ever folded anything.
     */
    groupsSettleDuringTheRun: async () => {
        const p = page()
        /** @type {readonly (readonly [string | undefined, boolean])[]} */
        let seen = []
        await startBrowserTests(p.root, [
            ['m', { a: () => undefined }],
            ['f', { b: () => { throw 'x' } }],
            ['n', {
                c: () => {
                    seen = p.results.children.map(g =>
                        /** @type {const} */ ([g.attributes.get('data-status'), g.attributes.has('open')]))
                },
            }],
        ])
        assertStructurallySame(seen, [['passed', false], ['failed', true], ['running', true]])
    },
    /**
     * **The demo's example really fails, the way a real run fails.** Run on the
     * page's own operations — a real `sandbox` and a real `catch` — because its
     * failures are real throws, which a pure runner cannot catch. One module
     * passes and one fails twice: an assertion that does not hold, and a proof
     * expected to throw that returned.
     */
    theDemoRunsItsExample: async () => {
        const state = unwrap(await asyncRun(commonOperationMap)(demo.update(demo.init)({ kind: 'click', name: 'run' })))
        assertEq(state.kind, 'done')
        if (state.kind !== 'done') { return }
        assertEq(state.report.status, 'failed')
        assertStructurallySame(groupByModule(state.report.results).map(g => [g.module, g.passed, g.failed]),
            [['./example/passing.f.mjs', 3, 0], ['./example/failing.f.mjs', 1, 2]])
        const failures = state.report.results.filter(row => row.status === 'failed')
        assertStructurallySame(failures.map(row => row.name), [
            'import("./example/failing.f.mjs").proof.many()',
            'import("./example/failing.f.mjs").proof.throw.onEmpty()',
        ])
        assertEq(failures[1]?.message, 'Expected the proof to throw')
    },
    /**
     * **A new run's title drops the last run's counts** before it has any of
     * its own — read from inside the second run's leaf, since afterwards the
     * title holds the second run's counts and would look the same either way.
     */
    countsClearWhenARunStarts: async () => {
        const p = page()
        await startBrowserTests(p.root, [['m', { a: () => undefined }]])
        assertEq(p.counts.children.length, 2)
        /** @type {number[]} */
        let during = []
        await startBrowserTests(p.root, [['m', { a: () => { during = [...during, p.counts.children.length] } }]])
        assertStructurallySame(during, [0])
    },
    // Two entries may share a label and are two runs (catalog item 6), so they
    // are two groups: folding them into one would also reorder what ran
    // between them.
    aRepeatedModuleIsTwoGroups: async () => {
        const p = page()
        await startBrowserTests(p.root, [
            ['m', { a: () => undefined }],
            ['n', { b: () => undefined }],
            ['m', { c: () => undefined }],
        ])
        assertStructurallySame(p.results.children.map(g => g.attributes.get('data-test-module')), ['m', 'n', 'm'])
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
        // **The count is the page's**, and this is where it is proven. The walk
        // announces each module as it lands, and this file counts what it has
        // seen. A runner that announced under another name — or a page that
        // counted the wrong event — would sit at `Loading 0/N` for a whole run,
        // which reading the summary at the end cannot see.
        //
        // The *lines said while loading* are the subject, so the assertion is
        // on what was rendered rather than on what is left showing. Two
        // sources, and the order between them is asserted: loading is
        // sequential, so the modules arrive in the order they were asked for.
        // Under the fan-out this replaced, only one source could be pinned at
        // all — concurrent imports have no guaranteed order — which is one
        // measure of what the concurrency cost.
        const p = page()
        const first = dataModule('export const proof = { a: () => undefined }')
        const second = dataModule('export const proof = { b: () => undefined }')
        const report = await startBrowserTestSources(p.root, [first, second])
        assertEq(report.status, 'passed')
        assertStructurallySame(
            p.summary.texts.filter(t => t.startsWith('Loading')),
            ['Loading 0/2', `Loading 1/2: ${first}`, `Loading 2/2: ${second}`])
    },
    /**
     * **A bare specifier is handed to `import()` unchanged.**
     *
     * `proofs/core` is an import map's key, and rebasing it would quietly turn
     * it into a URL under the document's directory that the map never sees.
     *
     * Neither specifier resolves here, so what is asserted is that the
     * document's directory is *not* in the failure: an engine that failed to
     * load a rebased specifier names the path it tried, and this one must not
     * name that path. Asserting the message itself would pin one engine's
     * wording, which is the mistake this file already made once.
     */
    bareSpecifiersAreNotRebased: async () => {
        const p = page(true, 'file:///the-document-directory/')
        const report = await startBrowserTestSources(p.root, ['proofs/core'])
        assertEq(report.status, 'infrastructure-error')
        assertEq(report.results[0]?.module, 'proofs/core')
        assertEq(
            (report.results[0]?.message ?? '').includes('the-document-directory'),
            false)
    },
    /**
     * The other half of the same branch, proven by a load that **succeeds**: a
     * relative source is resolved against the document.
     *
     * The document's base is this repository's root and the source is written
     * the way the root page writes one — `./fjs/…`. Resolved against
     * `module.mjs`'s own URL instead, it would be
     * `fjs/emergent_testing/browser/fjs/types/…` and load nothing, which is
     * exactly the 404 that resolving against the document exists to avoid. A
     * real module is imported rather than a `data:` one because a `data:`
     * source is absolute and would pass either way.
     */
    relativeSourcesAreRebasedOnTheDocument: async () => {
        const p = page(true, new URL('../../../', import.meta.url).href)
        const report = await startBrowserTestSources(p.root,
            ['./fjs/types/nullable/proof.f.mjs'])
        assertEq(report.status, 'passed')
        assert(report.totals.tests > 0, report.totals)
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
        assertStructurallySame(countParts(p.counts),
            [['data-count-passed', '0 passed'], ['data-count-failed', '1 failed'], ['data-duration', '']])
        assertStructurallySame([...statuses(p.results)], ['failed'])
        assertEq(p.view.events.length, 1)
    },
}
