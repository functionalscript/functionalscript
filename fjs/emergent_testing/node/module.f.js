/**
 * What a quiet `node --test` report keeps: the events a reader acts on.
 *
 * Node's `spec` reporter prints a line per test and a coverage row per file,
 * which on this repository's suite is twelve thousand lines of passes and
 * `100.00`s around the few lines that matter. {@link quiet} is the filter
 * `module.mjs` puts in front of it. A passed test is dropped unless it was
 * skipped or left `todo`; a log names the test that wrote it, a test's
 * diagnostic names where that test is, and what a test wrote to standard
 * output or error names the file it ran in; the coverage report keeps the
 * files that miss a threshold, and its totals; everything else — a failure,
 * the run's summary, a threshold error — passes through unchanged.
 *
 * @module
 *
 * @import { Coverage, Diagnostic, Event, Log, Output, Pass } from './types.ts'
 */

import { entry } from '../../types/object/entry/module.f.js'

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
 * A log with its test's name before the message. The `spec` reporter prints
 * a log as the message alone, and names the test only on the pass that
 * follows, which this filter drops; the name on the line stands in for it,
 * and does not depend on the order tests ran in.
 *
 * The name is read through `entry`: `name` is a name `Function.prototype`
 * gives a value, so the language refuses it as a constant key and reads
 * the own property by the helper instead
 * ([CONVERTING.md](../../../doc/CONVERTING.md#reading-say-what-type-the-key-has)).
 *
 * @type {(event: Log) => Log}
 */
const log = ({ type, data }) =>
    ({ type, data: { ...data, message: `${entry(data, 'name')[0]}: ${data.message}` } })

/**
 * A file's path relative to the working directory, where the file is under
 * it; otherwise the path as given. The `spec` reporter prints a failing
 * test's location the same way.
 *
 * @type {(cwd: string, file: string) => string}
 */
const located = (cwd, file) => {
    const separator = file[Number(cwd.length)]
    return file.startsWith(cwd) && (separator === '/' || separator === '\\')
        ? file.slice(cwd.length + 1)
        : file
}

/**
 * A test's diagnostic with the test's location before the message. Node
 * emits it after the test's own result, which this filter drops for a
 * passed test, and without the test's name; the file, line and column where
 * the test is defined are what it carries, and the location `spec` names a
 * failing test by. The run's summary diagnostics carry no location and pass
 * unchanged.
 *
 * @type {(cwd: string) => (event: Diagnostic) => Diagnostic}
 */
const diagnostic = cwd => event =>
    event.data.file === undefined ? event : {
        ...event,
        data: {
            ...event.data,
            message: `${located(cwd, event.data.file)}:${event.data.line}:${event.data.column}: ${event.data.message}`,
        },
    }

/**
 * What a test wrote to standard output or error, with the file it ran in
 * before it. Node names no test on the event, only the file, and the `spec`
 * reporter prints the text alone.
 *
 * @type {(cwd: string) => (event: Output) => Output}
 */
const output = cwd => event =>
    ({ ...event, data: { ...event.data, message: `${located(cwd, event.data.file)}: ${event.data.message}` } })

/**
 * The event as the report should see it, or `null` for one it should not.
 *
 * Every `test:start` goes, not only a passed test's: the `spec` reporter
 * pairs a start with the pass or fail that closes it, and with most passes
 * dropped the pairing cannot hold. A failure then prints at its indentation,
 * without the `▶` line naming its suite.
 *
 * `cwd` is the working directory a test's location is printed relative to.
 *
 * @type {(cwd: string) => (event: Event) => Event | null}
 */
export const quiet = cwd => event =>
    event.type === 'test:start' ? null :
    event.type === 'test:pass' ? pass(event) :
    event.type === 'test:log' ? log(event) :
    event.type === 'test:diagnostic' ? diagnostic(cwd)(event) :
    event.type === 'test:stdout' || event.type === 'test:stderr' ? output(cwd)(event) :
    event.type === 'test:coverage' ? coverage(event) :
    event
