/**
 * What a quiet `node --test` report keeps: the events a reader acts on.
 *
 * Node's `spec` reporter prints a line per test and a coverage row per file,
 * which on this repository's suite is twelve thousand lines of passes and
 * `100.00`s around the few lines that matter. {@link quiet} is the filter
 * `module.mjs` puts in front of it. A passed test is dropped unless it was
 * skipped or left `todo`; the coverage report keeps the files that miss a
 * threshold, and its totals; everything else — a failure, the run's summary,
 * a threshold error — passes through unchanged.
 *
 * @module
 *
 * @import { Coverage, Event, Pass } from './types.ts'
 */

/**
 * The coverage report without the files that meet every threshold. Its totals
 * still count them, so the `all files` row stays the summary of the whole run.
 *
 * @type {(event: Coverage) => Coverage}
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
 * A pass is dropped unless the test was skipped or is `todo`: the counts at
 * the end of the run say how many of those there were, and only the event
 * says which.
 *
 * @type {(event: Pass) => Pass | null}
 */
const pass = event =>
    event.data.skip !== undefined || event.data.todo !== undefined ? event : null

/**
 * The event as the report should see it, or `null` for one it should not.
 *
 * Every `test:start` goes, not only a passed test's: the `spec` reporter
 * pairs a start with the pass or fail that closes it, and with most passes
 * dropped the pairing cannot hold. A failure then prints at its indentation,
 * without the `▶` line naming its suite.
 *
 * @type {(event: Event) => Event | null}
 */
export const quiet = event =>
    event.type === 'test:start' ? null :
    event.type === 'test:pass' ? pass(event) :
    event.type === 'test:coverage' ? coverage(event) :
    event
