/**
 * @import { RunInstance } from '../effects/mock/types.ts'
 * @import { Effect, NotImplemented } from '../effects/types.ts'
 * @import { NodeProgramOptions, OpResult, Sandbox, Write } from '../effects/node/types.ts'
 * @import { JsModule } from '../effects/node/virtual/types.ts'
 * @import { Reporter } from './types.ts'
 * @import { All, Await, Catch, Import, Readdir, Test, TestContext } from '../effects/node/types.ts'
 * @import { Ts } from '../rtti/ts/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { log } from '../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { assert, assertEq, todo } from '../asserts/module.f.mjs'
import {
    testAll, fmtPath, fmtImport, ghEscape, isInteger, isIdentifier,
    registerModule, parseTestSet,
    addResult, defaultReporter, defaultTest, main, register, testResult, zeroTotals,
} from './module.f.mjs'
import { run as mockRun } from '../effects/mock/module.f.mjs'
import { shouldLoad } from '../dev/module.f.mjs'
import { parse as parseJson } from '../media/json/module.f.mjs'
import { number as rttiNumber, or, string as rttiString } from '../rtti/module.f.mjs'
import { parse as rttiParse } from '../rtti/parse/module.f.mjs'
import { error, ok, unwrap } from '../types/result/module.f.mjs'
import { pureError, step } from '../effects/module.f.mjs'

/**
 * The mock reporter's stdout lines. A schema rather than a hand-written type:
 * the events round-trip through JSON, and this is what turns a line back into
 * a typed value without an `as` cast — a shape change fails at the parse
 * instead of silently at an assertion.
 *
 * `Reporter.result` also receives the test's `SandboxResult`, which is not
 * written: no assertion here reads it, and its `undefined` payloads have no
 * JSON representation to round-trip through anyway.
 */
const event = or(
    /** @type {const} */ (['start', rttiString, rttiString]),
    /** @type {const} */ (['result', rttiString, rttiString]),
    /** @type {const} */ (['summary', rttiNumber, rttiNumber, rttiNumber]),
)

const parseEvent = rttiParse(event)

/** @type {(e: Ts<typeof event>) => Effect<Write, void, NotImplemented>} */
const writeEvent = e => log(JSON.stringify(e))

/** @type {(stdout: string) => readonly Ts<typeof event>[]} */
const parseEvents = stdout =>
    stdout === '' ? [] : stdout.trimEnd().split('\n')
        .map(line => unwrap(parseEvent(unwrap(parseJson(line)))))

/** @type {() => Reporter<Sandbox | Write>} */
const makeReporter = () => ({
    // The leaf-landed event arrives with the shared `TestResult` already
    // built, so what this writes — and what the proofs below assert on — is
    // the record's own `module` and formatted `path`, not a spelling of the
    // mock's own.
    start: id => writeEvent(['start', id.module, id.path]),
    result: (t, _r, _throws) => writeEvent(['result', t.module, t.path]),
    summary: ({ totals: { passed, failed, duration } }) => writeEvent(['summary', passed, failed, duration]),
    test: defaultTest,
})

/** @type {(initCwd: string, github?: boolean) => NodeProgramOptions} */
const options = (initCwd, github = false) => ({
    ...defaultNodeProgramOptions,
    env: { INIT_CWD: initCwd, ...(github ? { GITHUB_ACTIONS: 'true' } : {}) },
})

/** @type {() => unknown} */
const ok0 = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 0 })
/** @type {() => unknown} */
const fail0 = () => ({ result: /** @type {const} */ (['error', 'oops']), duration: 0 })
// A failing leaf whose thrown value says which one it is, so the deferred
// report can be read for order rather than only for length.
/** @type {(v: string) => () => unknown} */
const failWith = v => () => ({ result: /** @type {const} */ (['error', v]), duration: 0 })
/** @type {() => unknown} */
const ok1 = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 1 })

/** @type {(dir: Record<string, JsModule>, initCwd?: string) => readonly [readonly Ts<typeof event>[], number]} */
const run = (dir, initCwd = '.') => {
    const reporter = makeReporter()
    const state = { ...emptyState, root: dir }
    const [finalState, code] = virtual(state)(testAll(reporter)(options(initCwd)))
    return [parseEvents(finalState.stdout), exitCode(code)]
}

// Runs the `fjs t` entry point (`main`) and returns its captured stdout/stderr
// so the terminal and GitHub output formats can be asserted directly.
/** @type {(dir: Record<string, JsModule>, github?: boolean) => readonly [string, string, number]} */
const runMain = (dir, github = false) => {
    const state = { ...emptyState, root: dir }
    const opts = options('.', github)
    const [finalState, code] = virtual(state)(main(opts))
    return [finalState.stdout, finalState.stderr, exitCode(code)]
}

// flat object: two passing tests
export const flat = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { a: ok0, b: ok1 } }),
    })
    assertEq(exit, 0)
    // Each leaf is announced before it is reported, and no other leaf's events
    // come between the two: the pairing the start event exists to make
    // readable.
    const [e0, e1, e2, e3, e4] = events
    assert(e0[0] === 'start' && e0[2] === '.a')
    assert(e1[0] === 'result' && e1[2] === '.a')
    assert(e2[0] === 'start' && e2[2] === '.b')
    assert(e3[0] === 'result' && e3[2] === '.b')
    assert(e4[0] === 'summary')
    const [, pass, fail] = e4
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// nested object: leaf tests carry the full path including the sub-tree key
export const nested = () => {
    const [events, exit] = run({
        'n.proof.f.ts': () => ({ proof: { math: { add: ok0, sub: ok0 } } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2, e3, e4] = events
    assert(e0[0] === 'start' && e0[2] === '.math.add')
    assert(e1[0] === 'result' && e1[2] === '.math.add')
    assert(e2[0] === 'start' && e2[2] === '.math.sub')
    assert(e3[0] === 'result' && e3[2] === '.math.sub')
    assert(e4[0] === 'summary')
    const [, pass, fail] = e4
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// throw key: tests inside 'throw' pass on error result
export const throwKey = () => {
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { throw: { a: fail0 } } }),
    })
    assertEq(exit, 0)
    const [e0, e1, e2] = events
    assert(e0[0] === 'start' && e0[2] === '.throw.a')
    assert(e1[0] === 'result' && e1[2] === '.throw.a')
    assert(e2[0] === 'summary')
    const [, pass, fail] = e2
    assertEq(pass, 1)
    assertEq(fail, 0)
}

// throw key fails when test does not throw (returns ok in throw context)
export const throwKeyFail = () => {
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { throw: { a: ok0 } } }),
    })
    assertEq(exit, 1)
    const [e0, e1, e2] = events
    assert(e0[0] === 'start')
    assert(e1[0] === 'result')
    const [, pass, fail] = e2
    assertEq(pass, 0)
    assertEq(fail, 1)
}

// mixed pass/fail updates summary counts
export const mixedPassFail = () => {
    const [events, exit] = run({
        'm.proof.f.ts': () => ({ proof: { good: ok0, bad: fail0 } }),
    })
    assertEq(exit, 1)
    const summary = events[events.length - 1]
    assert(summary[0] === 'summary')
    const [, pass, fail] = summary
    assertEq(pass, 1)
    assertEq(fail, 1)
}

// return-value sub-tree: passing test's return value is walked
export const returnValueSubTree = () => {
    /** @type {() => unknown} */
    const inner = () => ({ result: /** @type {const} */ (['ok', undefined]), duration: 0 })
    const [events, exit] = run({
        'r.proof.f.ts': () => ({
            proof: {
                outer: () => ({
                    result: /** @type {const} */ (['ok', { inner }]),
                    duration: 0,
                }),
            }
        }),
    })
    // outer passes, then inner (from return value) also passes
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    const [p0, p1] = passEvents
    assertEq(p0[2], '.outer')
    assertEq(p1[2], '.outer().inner')
}

// integer-indexed array keys appear as numeric path segments
export const arrayKeys = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { arr: [ok0, ok0] } }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2)
    assertEq(passEvents[0][2], '.arr[0]')
    assertEq(passEvents[1][2], '.arr[1]')
}

// non-proof files are skipped: plain `.ts` is not loaded; `.f.ts` without
// a `proof` export is loaded but produces no events
export const nonTestFilesSkipped = () => {
    const [events, exit] = run({
        'helper.ts': () => ({ a: ok0 }),                // not loaded (plain .ts)
        'module.f.ts': () => ({ someExport: ok0 }),     // loaded, no proof → skipped
        'b.proof.f.ts': () => ({ proof: { x: ok0 } }), // loaded, has proof → runs
    })
    assertEq(exit, 0)
    const results = events.filter(e => e[0] === 'result')
    assertEq(results.length, 1)
    assertEq(results[0][1], './b.proof.f.ts')
}

// multiple test files each produce result events
export const multipleFiles = () => {
    const [events, exit] = run({
        'a.proof.f.ts': () => ({ proof: { x: ok0 } }),
        'b.proof.f.ts': () => ({ proof: { y: ok0 } }),
    })
    assertEq(exit, 0)
    const results = events.filter(e => e[0] === 'result')
    assertEq(results.length, 2)
    const [, pass, fail] = events[events.length - 1]
    assertEq(pass, 2)
    assertEq(fail, 0)
}

// a function literally named `throw` is a throwing test even when its key is not `throw`
export const throwByFunctionName = () => {
    // // `bun` calls the function `named` instead of `throw`
    // const named = ({ throw: () => fail0() }).throw
    const x = { throw: () => fail0() }
    const [events, exit] = run({
        't.proof.f.ts': () => ({ proof: { here: x.throw } }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 1)
    assertEq(passEvents[0][2], '.here')
}

// only the `proof` export is used; other module properties are ignored
export const namedExports = () => {
    const [events, exit] = run({
        'e.proof.f.ts': () => ({ proof: { a: ok0, b: ok0 }, other: ok0 }),
    })
    assertEq(exit, 0)
    const passEvents = events.filter(e => e[0] === 'result')
    assertEq(passEvents.length, 2) // `other` is ignored
    assertEq(passEvents[0][2], '.a')
    assertEq(passEvents[1][2], '.b')
}

// the default (non-GitHub) reporter formats module/pass/summary lines on stdout
export const defaultReporterOutput = () => {
    const [stdout, stderr, exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { x: ok0 } }),
    })
    assertEq(exit, 0)
    assertEq(stderr, '')
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.x(): running\n'
        + 'import("./a.proof.f.ts").proof.x(): ok, 0.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 0.0000 ms\n',
    )
}

// timeFormat with duration >= 1ms covers the `yl <= 0` branch (no leading zeros needed)
export const defaultReporterOutputLargeDuration = () => {
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { x: ok1 } }),
    })
    assertEq(exit, 0)
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.x(): running\n'
        + 'import("./a.proof.f.ts").proof.x(): ok, 1.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 1.0000 ms\n',
    )
}

/**
 * A failure is written to `stdout`, in among the tests it happened between:
 * the pass/fail line as the leaf lands, and the value it failed with
 * afterwards.
 *
 * `stderr` stays empty, and the assertion on it is the point rather than
 * incidental thoroughness. The two streams are not ordered against each other,
 * so a report split across them cannot be read back as a sequence — where a
 * failure sat among the tests around it is exactly what a reader is asking.
 * `stderr` is left for a runner crash, which is the tail's to write once there
 * is no longer a run to correlate anything with.
 */
export const defaultReporterFailOutput = () => {
    const [stdout, stderr, exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { bad: fail0 } }),
    })
    assertEq(exit, 1)
    assertEq(stderr, '')
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.bad(): running\n'
        + 'import("./a.proof.f.ts").proof.bad(): error, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.bad()\n'
        + 'oops\n'
        + 'Number of tests: pass: 0, fail: 1, total: 1\n'
        + 'Time: 0.0000 ms\n',
    )
}

/**
 * Every failure's *detail* lands after every leaf has run, in the order the
 * leaves failed — the property this whole arrangement exists for.
 *
 * The assertion is the exact stream, and the exactness is what makes it a
 * proof: with the details inline, `one`'s value would follow `one`'s line and
 * `three`'s would follow `three`'s, so a run of two failures reads the same
 * lines in a different order. Asserting only that the details are present, or
 * that they are in order among themselves, would pass either way — the two
 * blocks are the observation.
 *
 * `two` passes and writes to stdout, so it is absent here; its presence in the
 * run is what makes the two failures non-adjacent.
 */
export const defaultReporterFailuresAtEnd = () => {
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({
            proof: { one: failWith('first'), two: ok0, three: failWith('second') },
        }),
    })
    assertEq(exit, 1)
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.one(): running\n'
        + 'import("./a.proof.f.ts").proof.one(): error, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.two(): running\n'
        + 'import("./a.proof.f.ts").proof.two(): ok, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.three(): running\n'
        + 'import("./a.proof.f.ts").proof.three(): error, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.one()\n'
        + 'first\n'
        + 'import("./a.proof.f.ts").proof.three()\n'
        + 'second\n'
        + 'Number of tests: pass: 1, fail: 2, total: 3\n'
        + 'Time: 0.0000 ms\n',
    )
}

// Failures are collected across modules, in the order the modules ran — the
// walk threads one state through all of them rather than one per module.
export const defaultReporterFailuresAcrossModules = () => {
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { x: failWith('from-a') } }),
        'b.proof.f.ts': () => ({ proof: { y: failWith('from-b') } }),
    })
    assertEq(exit, 1)
    assertEq(
        stdout,
        'import("./a.proof.f.ts").proof.x(): running\n'
        + 'import("./a.proof.f.ts").proof.x(): error, 0.0000 ms\n'
        + 'import("./b.proof.f.ts").proof.y(): running\n'
        + 'import("./b.proof.f.ts").proof.y(): error, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.x()\n'
        + 'from-a\n'
        + 'import("./b.proof.f.ts").proof.y()\n'
        + 'from-b\n'
        + 'Number of tests: pass: 0, fail: 2, total: 2\n'
        + 'Time: 0.0000 ms\n',
    )
}

// A leaf expected to throw that *did* throw is a pass, so it contributes
// nothing to the report — the expectation is applied before a failure is
// collected, not after.
export const defaultReporterExpectedThrowNotReported = () => {
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { throw: { x: fail0 } } }),
    })
    assertEq(exit, 0)
    assert(!stdout.includes('oops'), stdout)
}

/**
 * A leaf's *own* output lands between its two records and leaves both intact —
 * the reason the terminal format is two complete lines rather than one line
 * completed in place.
 *
 * Under the sequential traversal no other leaf runs in that gap, but the leaf
 * itself does, and purity is a convention the sandbox does not enforce (see
 * `todo/hostile-proof-values.md`): a proof that logs at runtime, or a node
 * warning on the same stream, writes here. Were the start record an unfinished
 * line, that output would be appended to it and the later `ok` would attach to
 * whatever the leaf said.
 *
 * The writer is the reporter's own `test`, which is where a leaf's execution
 * is dispatched from, so what it writes lands exactly where a leaf's own
 * writing would.
 */
export const defaultReporterOutputDuringATest = () => {
    const opts = options('.')
    const reporter = defaultReporter(opts)
    /** @type {typeof reporter} */
    const noisy = {
        ...reporter,
        test: (file, path, entry) =>
            step(log('a line from inside the test'), () => reporter.test(file, path, entry)),
    }
    const state = { ...emptyState, root: { 'a.proof.f.ts': () => ({ proof: { x: ok0 } }) } }
    const [finalState, code] = virtual(state)(testAll(noisy)(opts))
    assertEq(exitCode(code), 0)
    assertEq(
        finalState.stdout,
        'import("./a.proof.f.ts").proof.x(): running\n'
        + 'a line from inside the test\n'
        + 'import("./a.proof.f.ts").proof.x(): ok, 0.0000 ms\n'
        + 'Number of tests: pass: 1, fail: 0, total: 1\n'
        + 'Time: 0.0000 ms\n',
    )
}

/**
 * A run that dies mid-test leaves the running test's name behind — the case
 * the start event exists for.
 *
 * Before it, the last line printed was the last test that *succeeded*, so the
 * one that actually broke was the one thing the log did not contain. Here the
 * second leaf's execution fails outright, which ends the run: `y` is announced
 * and never reported, and that unmatched start is the name a reader — or a
 * controller reading the stream — needs.
 *
 * The failure is dispatched through `test` because that is what running a leaf
 * goes through; what kills the process in the field (a panic, an
 * out-of-memory) leaves the same trace for the same reason, and cannot be
 * staged inside a proof that has to survive it.
 */
export const startSurvivesARunThatDies = () => {
    const opts = options('.')
    const reporter = defaultReporter(opts)
    /** @type {typeof reporter} */
    const dying = {
        ...reporter,
        test: (file, path, entry) =>
            path[path.length - 1] === 'y'
                ? pureError(/** @type {const} */ (['ioError', { message: 'the run died here' }]))
                : reporter.test(file, path, entry),
    }
    const state = { ...emptyState, root: { 'a.proof.f.ts': () => ({ proof: { x: ok0, y: ok0 } }) } }
    const [finalState, code] = virtual(state)(testAll(dying)(opts))
    assertEq(exitCode(code), 1)
    // No result for `y`, and no summary: the run stopped inside it. The name is
    // there anyway.
    assertEq(
        finalState.stdout,
        'import("./a.proof.f.ts").proof.x(): running\n'
        + 'import("./a.proof.f.ts").proof.x(): ok, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.y(): running\n',
    )
}

/**
 * A run that dies does not take the failures it had already collected with it.
 *
 * Deferring the details created this hazard and the fix is the reason
 * `RunState` carries `aborted` rather than throwing it: the walk used to
 * short-circuit, `summary` was never reached, and every collected failure died
 * with it — so a run that died after a test had failed printed that test's
 * name and never its error. Losing diagnostics exactly when something went
 * wrong is the opposite of what deferring them is for.
 *
 * `bad` fails normally; `later` cannot be dispatched at all. The whole stream
 * is asserted, so it pins all three halves of the answer: `oops` survives, the
 * summary's *counts* do not appear — a `pass/fail/total` line for a walk that
 * stopped early would read as a finished run — and the crash itself is the
 * one thing on `stderr`, written by the tail once there is no run left to
 * correlate it with.
 */
export const failuresSurviveARunThatDies = () => {
    const opts = options('.')
    const reporter = defaultReporter(opts)
    /** @type {typeof reporter} */
    const dying = {
        ...reporter,
        test: (file, path, entry) =>
            path[path.length - 1] === 'later'
                ? pureError(/** @type {const} */ (['ioError', { message: 'runner gave up' }]))
                : reporter.test(file, path, entry),
    }
    const root = { 'a.proof.f.ts': () => ({ proof: { bad: fail0, later: ok0 } }) }
    const [finalState, code] = virtual({ ...emptyState, root })(testAll(dying)(opts))
    assertEq(exitCode(code), 1)
    assertEq(
        finalState.stdout,
        'import("./a.proof.f.ts").proof.bad(): running\n'
        + 'import("./a.proof.f.ts").proof.bad(): error, 0.0000 ms\n'
        + 'import("./a.proof.f.ts").proof.later(): running\n'
        + 'import("./a.proof.f.ts").proof.bad()\n'
        + 'oops\n',
    )
    assertEq(finalState.stderr, 'runner gave up\n')
}

/**
 * Nothing runs after a run has been abandoned — not the leaves that remain,
 * and not the modules.
 *
 * Carrying the failure in the state rather than throwing it is what makes this
 * a thing to state: the walk keeps going structurally, and only the skip in
 * `one` and in the module fold stops it doing any work. `b` is never announced,
 * which is the observable form of "its `proof` export was never even
 * enumerated" — enumerating one runs user code, and a run that has given up
 * has no business running any more of it.
 */
export const nothingRunsAfterARunIsAbandoned = () => {
    const opts = options('.')
    const reporter = defaultReporter(opts)
    /** @type {typeof reporter} */
    const dying = {
        ...reporter,
        test: (file, path, entry) =>
            path[path.length - 1] === 'stop'
                ? pureError(/** @type {const} */ (['ioError', { message: 'runner gave up' }]))
                : reporter.test(file, path, entry),
    }
    const root = {
        'a.proof.f.ts': () => ({ proof: { stop: ok0, after: ok0 } }),
        'b.proof.f.ts': () => ({ proof: { never: ok0 } }),
    }
    const [finalState, code] = virtual({ ...emptyState, root })(testAll(dying)(opts))
    assertEq(exitCode(code), 1)
    assertEq(finalState.stdout, 'import("./a.proof.f.ts").proof.stop(): running\n')
}

// the GitHub reporter emits an `::error` annotation with a percent-encoded
// title (the JSON path) and message, in the same deferred position
export const githubReporterOutput = () => {
    const [stdout, stderr, exit] = runMain({
        's.proof.f.ts': () => ({ proof: { 'a:b,c%d': fail0 } }),
    }, true)
    assertEq(exit, 1)
    // The annotation goes to `stdout` with everything else: a workflow log
    // collects both streams, so nothing is gained by splitting them and the
    // ordering against the surrounding records is lost.
    assertEq(stderr, '')
    assert(
        stdout.includes(
            '::error file=./s.proof.f.ts,line=1,title=import("./s.proof.f.ts").proof["a%3Ab%2Cc%25d"]()::oops\n'),
        stdout)
}

// A reporter that cannot write neither panics nor reports success. The failed
// `result` line short-circuits its own leaf, and the sequential fold carries
// that failure out of the walk rather than running the remaining leaves into
// the same wall: the summary is skipped and the program tail answers exit `1`.
//
// `write` fails for every stream here, including the one `errorExit` reports
// the failure on, so the exit code rather than a message is what is observable:
// a run that cannot say anything at all still says it failed.
export const reporterWriteFailure = () => {
    /** @typedef {All | Catch | Import | Readdir | Sandbox | Write} _FailOps */
    /** @type {RunInstance<_FailOps, undefined>} */
    let runner
    runner = mockRun(/** @type {Parameters<typeof mockRun<_FailOps, undefined>>[0]} */ ({
        readdir: (_path, _o) => s => [s, ok([{ name: 'a.proof.f.ts', parentPath: '.', isFile: true }])],
        import: _path => s => [s, ok({ proof: { x: () => { } } })],
        all: (...effects) => s => {
            const [st, rs] = effects.reduce(
                ([st1, rs1], e) => {
                    const [ns, r] = runner(st1)(e)
                    return [ns, [...rs1, r]]
                },
                /** @type {readonly [undefined, readonly unknown[]]} */([s, []]),
            )
            return [st, ok(rs)]
        },
        sandbox: (/** @type {() => unknown} */ f) => (/** @type {undefined} */ s) =>
            [s, ok({ result: ok(f()), duration: 0 })],
        // Benign, like the virtual runner's: this proof is about a reporter
        // that cannot write, and its fixture's tree reads cleanly.
        catch: (/** @type {() => unknown} */ f) => (/** @type {undefined} */ s) =>
            [s, ok(ok(f()))],
        write: (_stream, _data) => s => [s, error(['notImplemented', 'write'])],
    }))
    const [, code] = runner(undefined)(
        /** @type {Effect<_FailOps, 0, number>} */(main(options('.'))))
    assertEq(exitCode(code), 1)
}

/**
 * A `TestContext` that is never invoked. Every mock runner below intercepts the
 * `test` *effect* and reads the context as data, so `test` here exists only to
 * satisfy the type — and it panics rather than answering, so an accidental call
 * fails loudly instead of resolving quietly. A throw is also what lets a pure
 * module satisfy `TestFn` at all: the body's type is `never`, which is
 * assignable to the `Promise<void>` the signature demands, with no `Promise`
 * constructed and no cast.
 *
 * @type {TestContext}
 */
const registerNoopCtx = { test: (_n, _o, _f) => { throw 'registerNoopCtx is data, not a runner' } }

/**
 * Builds a synchronous mock runner for `registerModule`'s `Test`/`All`/`Await`
 * effect operations. Only the `test` op varies between call sites (whether it
 * invokes the registered callback), so `all`/`await` are shared here.
 *
 * `testOp` is the `test` op body for a `registerModule` mock; `runner` is
 * threaded in explicitly (rather than closed over) so it can recurse into
 * sub-effects returned by `fn`.
 */
/** @type {(testOp: (
 *     runner: RunInstance<Test | All | Await, readonly string[]>,
 *     ctx: TestContext,
 *     name: string,
 *     expectFailure: boolean,
 *     fn: (t: TestContext) => Effect<Test | All | Await, void, never>,
 * ) => (s: readonly string[]) => readonly [readonly string[], OpResult<void>]
 * ) => RunInstance<Test | All | Await, readonly string[]>} */
const makeRegisterRunner = testOp => {
    /** @typedef {readonly string[]} _RegisterMockState */
    /** @typedef {Test | All | Await} _RegisterMockOps */
    /** @typedef {RunInstance<_RegisterMockOps, _RegisterMockState>} _RegisterRunner */
    /** @type {_RegisterRunner} */
    let runner
    runner = mockRun(/** @type {Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockState>>[0]} */ ({
        test: (ctx, name, xf, fn) => testOp(runner, ctx, name, xf, fn),
        all: (...effects) => s => {
            const [st, rs] = effects.reduce(
                ([st1, rs1], e) => {
                    const [ns, r] = runner(st1)(e)
                    return [ns, [...rs1, r]]
                },
                /** @type {readonly [_RegisterMockState, readonly unknown[]]} */ ([s, []]),
            )
            return [st, ok(rs)]
        },
        await: p => s => /** @type {const} */ ([s, ok([p])]),
    }))
    return runner
}

// registerModule appends ' ...' for inline runners (Bun).
// This mock never invokes the registered callback; it only records names.
export const registerSuffixes = () => {
    const runner = makeRegisterRunner((_runner, _ctx, name, _xf, _fn) => s => [[...s, name], ok(undefined)])

    const proof = /** @type {const} */ ({
        ok: () => {},
        throw: { a: () => { throw 'expected' } },
    })

    // Node (star = ''): no suffixes
    const [nodeNames] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ''))
    assertEq(nodeNames.length, 2)
    assert(nodeNames[0] === 'import("./a.f.ts").proof.ok()')
    assertEq(nodeNames[1], 'import("./a.f.ts").proof.throw.a()')

    // Bun (star = ' ...'): ... on normal tests, path shows throw for throw-tests
    const [inlineNames] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ' ...'))
    assertEq(inlineNames.length, 2)
    assert(inlineNames[0] === 'import("./a.f.ts").proof.ok() ...')
    assertEq(inlineNames[1], 'import("./a.f.ts").proof.throw.a()')
}

// The registered callback panics when its own effects cannot be dispatched.
// `Test` hands the body to an external framework that reads a throw and
// nothing else, so a body that could not run must not be reported as a pass —
// which is why `registerOne` ends in a `catchStep` that throws rather than in
// a channel nobody reads.
const registerBodyPanicsOnUndispatchableEffect = () => {
    /** @typedef {readonly string[]} _RegisterMockState */
    /** @typedef {Test | All | Await} _RegisterMockOps */
    /** @typedef {RunInstance<_RegisterMockOps, _RegisterMockState>} _RegisterRunner */
    /** @type {_RegisterRunner} */
    let runner
    runner = mockRun(/** @type {Parameters<typeof mockRun<_RegisterMockOps, _RegisterMockState>>[0]} */ ({
        test: (ctx, _name, _xf, fn) => s => [runner(s)(fn(ctx))[0], ok(undefined)],
        all: (...effects) => s => {
            const [st, rs] = effects.reduce(
                ([st1, rs1], e) => {
                    const [ns, r] = runner(st1)(e)
                    return [ns, [...rs1, r]]
                },
                /** @type {readonly [_RegisterMockState, readonly unknown[]]} */ ([s, []]),
            )
            return [st, ok(rs)]
        },
        // The runner has no `await`, which is what the body's channel carries.
        await: _p => s => [s, error(['notImplemented', 'await'])],
    }))
    // The leaf's value never needs to be a promise: `registerOne` routes every
    // leaf through the `await` effect unconditionally, and this runner's
    // handler ignores the payload and answers `notImplemented` regardless.
    const proof = /** @type {const} */ ({ a: () => undefined })
    runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ''))
}

// A `throw`-tagged test whose function completes without throwing (the
// external framework, not this module, is responsible for turning that into
// a failure via `expectFailure`). registerModule's own callback must still
// short-circuit before walking the returned value for sub-tests: it invokes
// the callback and returns without recursing, rather than treating the
// returned object as a sub-tree.
export const registerThrowsWithoutThrowing = () => {
    // Unlike registerSuffixes' mock, this one actually invokes the registered
    // callback so registerOne's inner `.step` body runs, and asserts the
    // callback is registered with `expectFailure: true`.
    const runner = makeRegisterRunner((runner, ctx, name, xf, fn) => s => {
        assert(xf)
        const [ns] = runner(s)(fn(ctx))
        return [[...ns, name], ok(undefined)]
    })

    // Returns a sub-tree that would register more tests if it were walked.
    const proof = /** @type {const} */ ({ throw: { a: () => ({ sub: () => {} }) } })

    const [names] = runner([])(registerModule(registerNoopCtx, './a.f.ts', proof, ''))
    // Only the throw-test itself is registered; `sub` is never reached.
    assertEq(names.length, 1)
    assertEq(names[0], 'import("./a.f.ts").proof.throw.a()')
}

// registerModule with an empty proof object registers zero tests and
// returns without invoking the mock's `test` op at all.
export const registerEmptyProof = () => {
    const runner = makeRegisterRunner((_runner, _ctx, name, _xf, _fn) => s => [[...s, name], ok(undefined)])
    const [names] = runner([])(registerModule(registerNoopCtx, './a.f.ts', {}, ''))
    assertEq(names.length, 0)
}

// register (the NodeProgram entry point) against an empty virtual root: no
// modules to register means registerModuleMap short-circuits before ever
// calling the selected TestContext's `test` op, so this reaches that branch
// without hitting the virtual harness's `test: todo` stub.
export const registerEmptyModuleMap = () => {
    const state = { ...emptyState, root: {} }
    const [, code] = virtual(state)(register(options('.')))
    assertEq(exitCode(code), 0)
}

// register's `star`/`ctx` selection, proven observably: the virtual harness's
// own `test` op is `todo`, so a non-empty root can't go through `virtual()`
// here without throwing. Instead this interprets register's effect with a
// fully synthetic runner (discovery faked via `readdir`/`import`, mirroring
// makeRegisterRunner's approach to `test`/`all`/`await`) that records which
// TestContext object and which registered name each `test` call received —
// so a swapped `engine` ternary or a deleted `inlineTestContext` branch
// changes what's observed here, not just whether the line ran.
export const registerSelectsContextAndStar = () => {
    /** @typedef {Test | All | Await} _RegisterMockOps */
    /** @type {TestContext} */
    const nodeCtx = { test: todo }
    /** @type {TestContext} */
    const bunCtx = { test: todo }

    /** @type {(extra: Partial<NodeProgramOptions>) => readonly (readonly [TestContext, string])[]} */
    const runRegister = extra => {
        /** @type {(readonly [TestContext, string])[]} */
        let calls = []
        /** @type {RunInstance<_RegisterMockOps | Readdir | Import, undefined>} */
        let runner
        runner = mockRun(/** @type {Parameters<typeof mockRun<_RegisterMockOps | Readdir | Import, undefined>>[0]} */ ({
            readdir: (_path, _o) => s => [s, ok([{ name: 'a.proof.f.ts', parentPath: '.', isFile: true }])],
            import: _path => s => [s, ok({ proof: { ok: () => {} } })],
            all: (...effects) => s => {
                const [st, rs] = effects.reduce(
                    ([st1, rs1], e) => {
                        const [ns, r] = runner(st1)(e)
                        return [ns, [...rs1, r]]
                    },
                    /** @type {readonly [undefined, readonly unknown[]]} */ ([s, []]),
                )
                return [st, ok(rs)]
            },
            await: p => s => [s, ok([p])],
            test: (ctx, name, _xf, _fn) => s => { calls = [...calls, [ctx, name]]; return [s, ok(undefined)] },
        }))
        runner(undefined)(/** @type {Effect<_RegisterMockOps | Readdir | Import, 0, number>} */ (register({
            ...defaultNodeProgramOptions, env: {}, testContext: nodeCtx, bunTestContext: bunCtx, ...extra,
        })))
        return calls
    }

    // Node engine, non-inline context: registers under nodeCtx, no ' ...' suffix.
    const nodeCalls = runRegister({})
    assertEq(nodeCalls.length, 1)
    assert(nodeCalls[0][0] === nodeCtx)
    assertEq(nodeCalls[0][1], 'import("./a.proof.f.ts").proof.ok()')

    // Bun engine, inline context: registers under bunCtx, with ' ...' suffix.
    const bunCalls = runRegister({ inlineTestContext: true, engine: 'bun' })
    assertEq(bunCalls.length, 1)
    assert(bunCalls[0][0] === bunCtx)
    assertEq(bunCalls[0][1], 'import("./a.proof.f.ts").proof.ok() ...')
}

// direct unit tests for the pure path-format helpers
export const helpers = {
    isInteger: () => {
        assert(isInteger('0'))
        assert(isInteger('123'))
        assert(!isInteger(''))
        assert(!isInteger('01'))
        assert(!isInteger('1a'))
        assert(!isInteger('-1'))
    },
    isIdentifier: () => {
        assert(isIdentifier('abc'))
        assert(isIdentifier('_x'))
        assert(isIdentifier('$y'))
        assert(isIdentifier('a1'))
        assert(!isIdentifier(''))
        assert(!isIdentifier('1a'))
        assert(!isIdentifier('a-b'))
    },
    shouldLoad: () => {
        // all .f.ts / .f.js — FS modules are safe to bulk-load
        assert(shouldLoad('module.f.ts'))
        assert(shouldLoad('module.f.js'))
        assert(shouldLoad('a.proof.f.ts'))
        assert(shouldLoad('dir/module.f.ts'))
        // vanilla opt-in by filename
        assert(shouldLoad('proof.ts'))
        assert(shouldLoad('proof.js'))
        assert(shouldLoad('proof.mts'))
        assert(shouldLoad('proof.mjs'))
        assert(shouldLoad('math.proof.ts'))
        assert(shouldLoad('math.proof.js'))
        assert(shouldLoad('math.proof.mts'))
        assert(shouldLoad('dir/math.proof.ts'))
        // non-FS, non-proof vanilla files are not loaded
        assert(!shouldLoad('helper.ts'))
        assert(!shouldLoad('module.ts'))
        assert(!shouldLoad('proof.tsx'))
    },
    fmtImport: () => {
        assertEq(fmtImport('./a.proof.f.ts', []), 'import("./a.proof.f.ts").proof()')
        assertEq(fmtImport('./a.proof.f.ts', ['math', 'add']), 'import("./a.proof.f.ts").proof.math.add()')
        assertEq(fmtImport('./a.proof.f.ts', ['users', '3']), 'import("./a.proof.f.ts").proof.users[3]()')
        assertEq(fmtImport('./a.proof.f.ts', ['x', 'hello world']), 'import("./a.proof.f.ts").proof.x["hello world"]()')
        assertEq(fmtImport('./a.proof.f.ts', ['outer', null, 'inner']), 'import("./a.proof.f.ts").proof.outer().inner()')
    },
    fmtPath: () => {
        assertEq(fmtPath([]), '')
        assertEq(fmtPath(['math', 'add']), '.math.add')
        assertEq(fmtPath(['users', '3', 'name']), '.users[3].name')
        assertEq(fmtPath(['x', 'hello world']), '.x["hello world"]')
        assertEq(fmtPath(['outer', null, 'inner']), '.outer().inner')
    },
    ghEscape: () => {
        assertEq(ghEscape('a%b'), 'a%25b')
        assertEq(ghEscape('a:b'), 'a%3Ab')
        assertEq(ghEscape('a,b'), 'a%2Cb')
        assertEq(ghEscape('a\r\nb'), 'a%0D%0Ab')
        assertEq(ghEscape('a%b:c,d'), 'a%25b%3Ac%2Cd')
    },
    parseTestSet: {
        nullReturnsEmpty: () => {
            const result = parseTestSet(false, null)
            assert(result instanceof Array, result)
            assertEq(result.length, 0)
        },
        functionWithParamsReturnsEmpty: () => {
            const result = parseTestSet(false, (/** @type {number} */ _x) => _x)
            assert(result instanceof Array, result)
            assertEq(result.length, 0)
        },
    },
}

// a passing throw-test emits '# EXPECTED TO THROW' in its output line
const defaultReporterExpectedToThrow = () => {
    // fail0 returns a SandboxResult indicating an error; in a throw context
    // defaultTest inverts it to ok, so defaultReporter.result sees s==='ok' and throws===true
    const [stdout, , exit] = runMain({
        'a.proof.f.ts': () => ({ proof: { throw: { x: fail0 } } }),
    })
    assertEq(exit, 0)
    assert(stdout.includes('# EXPECTED TO THROW'), stdout)
}

/**
 * `testResult` is where every runner decides what a leaf is called and whether
 * it passed, so these pin both.
 *
 * The result it takes is the one *after* the throw expectation has been
 * applied, which is why an expected throw does not appear here: inverting is
 * `defaultTest`'s job and `invert`'s rule, and this reads whatever that
 * produced.
 */
const testResultProofs = {
    passes: () => {
        const t = testResult('./a.f.mjs', ['x'], { result: ok(1), duration: 0.5 })
        assertEq(t.status, 'passed')
        assertEq(t.duration, 0.5)
        assertEq(t.module, './a.f.mjs')
    },
    fails: () => {
        const t = testResult('./a.f.mjs', ['x'], { result: error('boom'), duration: 2 })
        assertEq(t.status, 'failed')
    },
    // The identity and the key chain come from the same two functions the
    // console runner formats its own output with, so a runner cannot spell
    // either of them its own way by building this record itself.
    namesTheLeaf: () => {
        const path = ['nested', null, 'a.b']
        const t = testResult('./a.f.mjs', path, { result: ok(undefined), duration: 0 })
        assertEq(t.name, fmtImport('./a.f.mjs', path))
        assertEq(t.name, 'import("./a.f.mjs").proof.nested()["a.b"]()')
        assertEq(t.path, fmtPath(path))
    },
}

/**
 * `addResult` is where every runner turns a stream of leaf results into the
 * run's totals — the summary line, the exit code and the browser report's
 * counts all read this fold — so the fold itself is pinned here, not only its
 * end-to-end effects.
 */
const runTotalsProofs = {
    startsEmpty: () => {
        assertEq(zeroTotals.passed, 0)
        assertEq(zeroTotals.failed, 0)
        assertEq(zeroTotals.duration, 0)
    },
    countsByTheSharedStatus: () => {
        const pass = testResult('./a.f.mjs', ['x'], { result: ok(1), duration: 0.5 })
        const fail = testResult('./a.f.mjs', ['y'], { result: error('boom'), duration: 2 })
        const totals = [pass, fail, pass].reduce(addResult, zeroTotals)
        assertEq(totals.passed, 2)
        assertEq(totals.failed, 1)
        assertEq(totals.duration, 3)
    },
}

export const proof = {
    testResult: testResultProofs,
    runTotals: runTotalsProofs,
    throw: {
        registerBodyPanicsOnUndispatchableEffect,
    },
    flat,
    nested,
    throwKey,
    throwKeyFail,
    mixedPassFail,
    returnValueSubTree,
    arrayKeys,
    nonTestFilesSkipped,
    multipleFiles,
    throwByFunctionName,
    namedExports,
    defaultReporterOutput,
    defaultReporterOutputLargeDuration,
    defaultReporterFailOutput,
    defaultReporterFailuresAtEnd,
    defaultReporterFailuresAcrossModules,
    defaultReporterExpectedThrowNotReported,
    defaultReporterOutputDuringATest,
    startSurvivesARunThatDies,
    failuresSurviveARunThatDies,
    nothingRunsAfterARunIsAbandoned,
    githubReporterOutput,
    reporterWriteFailure,
    registerSuffixes,
    registerThrowsWithoutThrowing,
    registerEmptyProof,
    registerEmptyModuleMap,
    registerSelectsContextAndStar,
    defaultReporterExpectedToThrow,
    helpers
}
