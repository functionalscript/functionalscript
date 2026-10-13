/**
 * What a quiet `node --test` report keeps: the events a reader acts on.
 *
 * Node's `spec` reporter prints a line per test and a coverage row per file,
 * which on this repository's suite is twelve thousand lines of passes and
 * `100.00`s around the few lines that matter. {@link quiet} is the filter
 * `module.mjs` puts in front of it. A passed test is dropped, with the
 * `test:start` that announced it; the coverage report keeps the files that
 * miss a threshold, and its totals; everything else — a failure, the run's
 * summary, a threshold error — passes through unchanged.
 *
 * @module
 *
 * @import { TestEvent } from 'node:test/reporters'
 */

/**
 * The coverage report without the files that meet every threshold. Its totals
 * still count them, so the `all files` row stays the summary of the whole run.
 *
 * @type {(event: Extract<TestEvent, { readonly type: 'test:coverage' }>) => TestEvent}
 */
const coverage = ({ type, data }) => {
    const { summary } = data
    const { line, branch, function: fn } = summary.thresholds
    const files = summary.files.filter(f =>
        f.coveredLinePercent < line ||
        f.coveredBranchPercent < branch ||
        f.coveredFunctionPercent < fn)
    return { type, data: { ...data, summary: { ...summary, files } } }
}

/**
 * The event as the report should see it, or `null` for one it should not.
 *
 * `test:start` goes with `test:pass` because the `spec` reporter pairs the
 * two: a start it has seen must be closed by the pass or fail of the same
 * test, and a start left open would be matched against the next failure.
 *
 * @type {(event: TestEvent) => TestEvent | null}
 */
export const quiet = event =>
    event.type === 'test:start' || event.type === 'test:pass' ? null :
    event.type === 'test:coverage' ? coverage(event) :
    event
