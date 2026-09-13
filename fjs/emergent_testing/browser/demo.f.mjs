/**
 * What the browser report looks like when a test fails, shown by running an
 * example suite in this page rather than by breaking a real one.
 *
 * A reader meeting the report needs to see its failure state, and a suite that
 * is green everywhere never shows it. Breaking a real proof would turn every
 * run red — the root page's, `fjs t`'s and CI's alike — and a screenshot goes
 * stale. So this runs a small example through the same pieces a real run uses:
 * `collectTests` walks it, `defaultTest` sandboxes each leaf, `browserResult`
 * reads a failure, and `reportView` draws the rows. Its failures are real
 * throws, so what is drawn is exactly what a real failure produces. One module
 * has no tests at all, so the demo also shows what a real page does with a
 * source that reported nothing: it has no group, and stays listed as such.
 *
 * **It is not a proof.** The example lives under `demo`, and proofs are
 * discovered by the `proof` export and nothing else, so `fjs t`, CI and the Run
 * button on every page never see it.
 *
 * **It shares the report's markup and none of the runner's hooks.** The runner
 * looks up `data-test-results`, `data-test-counts`, `data-test-summary` and
 * `data-test-sources` across the whole page, and this demo renders above the
 * suite — so it draws into `data-example-report`, `data-example-counts` and
 * `data-example-sources` instead, or a real run on this page would draw its
 * report into the demo and mark the demo's list.
 *
 * @module
 *
 * @import { Catch, Sandbox } from '../../effects/common/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { ReportDemoState, _BrowserTestResult, _TestAndPath } from '../types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { foldStep, mapStep, pureOk, resultStep } from '../../effects/module.f.mjs'
import { collectTests, defaultTest, testResult } from '../module.f.mjs'
import { browserResult, countsView, moduleFailure, reportOf, reportView, unreported } from './module.f.mjs'

/** @type {(xs: readonly number[]) => number} */
const sum = xs => xs.reduce((a, b) => a + b, 0)

/**
 * The example suite: one module that passes, one that fails two different
 * ways — an assertion that does not hold, and a proof expected to throw that
 * returns instead — and one with no tests in it, which runs and produces no
 * result. Named under `./example/` so no reader mistakes it for a module of
 * this repository.
 *
 * @type {readonly (readonly [string, unknown])[]}
 */
const example = [
    ['./example/passing.f.mjs', {
        empty: () => assertEq(sum([]), 0),
        single: () => assertEq(sum([5]), 5),
        many: () => assertEq(sum([1, 2, 3]), 6),
    }],
    ['./example/failing.f.mjs', {
        empty: () => assertEq(sum([]), 0),
        many: () => assertEq(sum([1, 2, 3]), 7),
        throw: { onEmpty: () => sum([]) },
    }],
    ['./example/empty.f.mjs', {}],
]

/** The example's sources, in the order it runs them. @type {readonly string[]} */
const sources = example.map(([module]) => module)

/** What a row says when this page cannot sandbox a leaf at all. */
const refused = 'this page cannot run the example: sandbox is not implemented'

/**
 * One leaf: sandboxed, judged and read exactly as a real run does it.
 *
 * **A refused `sandbox` is a row, not a failure of the demo.** A demo's error
 * channel is `never`, so a runtime that does not implement the operation has to
 * be absorbed into what the demo renders.
 *
 * @type {(module: string) => (entry: _TestAndPath) => (rows: readonly _BrowserTestResult[]) => Effect<Sandbox | Catch, readonly _BrowserTestResult[], never>}
 */
const runLeaf = module => ([path, entry]) => rows =>
    resultStep(defaultTest(module, path, entry), r =>
        r[0] === 'error'
            ? pureOk([...rows, moduleFailure(module, 0, refused, refused)])
            : mapStep(browserResult(testResult(module, path, r[1]), r[1], entry.throws), row => [...rows, row]))

/**
 * The whole example, folded into a report — timed by the leaves' own durations,
 * which are the only clock a demo is given.
 *
 * @type {Effect<Sandbox | Catch, ReportDemoState, never>}
 */
const runExample = mapStep(
    foldStep(pureOk(example), /** @type {readonly _BrowserTestResult[]} */ ([]), ([module, proof]) => rows =>
        foldStep(pureOk(collectTests([], false, proof)), rows, runLeaf(module))),
    rows => ({
        kind: 'done',
        report: reportOf('example', rows.reduce((total, row) => total + row.duration, 0), rows, null),
    }))

/**
 * The example's sources, listed as a real page lists its own: every one before
 * a run, and after it only those that produced no result — each marked
 * `data-no-tests`, which the stylesheet labels "no tests reported".
 *
 * A source that produced results is a group in the report above, so listing
 * it again would say it twice; one that produced none has no group, so this is
 * the only place it appears. Decided by the same `unreported` the real page
 * uses, so the two cannot disagree about which sources those are.
 *
 * @type {(state: ReportDemoState) => readonly Element[]}
 */
const sourcesView = state => {
    const listed = state.kind === 'done'
        ? unreported(sources, state.report.results).map(source => /** @type {Element} */ (['li', { 'data-no-tests': '' }, source]))
        : sources.map(source => /** @type {Element} */ (['li', source]))
    return listed.length === 0 ? [] : [/** @type {Element} */ (['ul', { 'data-example-sources': '' }, ...listed])]
}

/** @type {Demo<ReportDemoState, DemoEvent, Sandbox | Catch>} */
export const demo = {
    init: { kind: 'idle' },
    update: state => event => event.kind === 'click' && event.name === 'run' ? runExample : pureOk(state),
    view: state => ['div',
        ['p', 'An example suite, run in this page: one module that passes, one with failures, '
            + 'and one with no tests. It is not one of this repository\'s proofs, so it never turns a real run red.'],
        ['p',
            ['button', { type: 'button', name: 'run' }, 'Run the example'],
            ...(state.kind === 'done'
                ? [/** @type {Element} */ (['span', { 'data-example-counts': '' }, ...countsView(state.report)])]
                : [])],
        ...(state.kind === 'done'
            ? [/** @type {Element} */ (['div', { 'data-example-report': '' }, ...reportView(state.report.results)])]
            : []),
        ...sourcesView(state),
    ],
}
