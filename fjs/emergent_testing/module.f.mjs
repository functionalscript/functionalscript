/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * Two parallel execution paths:
 * - `runModule` / `Reporter<O>` — self-hosted Effects runner; sandboxes each
 *   leaf call individually and accumulates `TestState`. **Both** `fjs t` and
 *   the browser runner (`./browser/module.f.mjs`) go through it: proof-tree
 *   walking, the structural `throw` expectation, promise resolution, path
 *   formatting and the totals are decided here once, and each host differs only
 *   in its `Reporter` and in the runner that interprets `sandbox`.
 * - `registerModule` / `TestContext` — registers tests with an external
 *   framework (Node `--test`, Bun, Deno) at import time; the framework owns
 *   scheduling and pass/fail counting.
 *
 * `recordingReporter` is the host-independent reporter of the first path: it
 * normalizes each leaf into a `TestResult` carrying no terminal text and no DOM
 * and hands it to the `report` operation, leaving presentation to the host.
 *
 * @module
 *
 * @import { Operation } from '../effects/types.ts'
 * @import { Effect, Func, NotImplemented } from '../effects/types.ts'
 * @import { LoadModuleOperations, ModuleMap } from '../dev/types.ts'
 * @import { Report, Reported, TestFn, TestEntry, TestResult, TestSet, Path, Reporter, _TestState, _TestAndPath } from './types.ts'
 * @import { All, Await, Env, IoChannel, NodeProgram, NodeProgramOptions, Program, Sandbox, SandboxResult, Test, TestContext, Write, WriteConsoles } from '../effects/node/types.ts'
 */

import { reset, fgGreen, fgRed, bold, csiWrite } from '../text/sgr/module.f.mjs'
import { allOk, awaitIfPromise, sandbox } from '../effects/common/module.f.mjs'
import { errorExit, errorMessage, errorSummary, exitStep, test } from '../effects/node/module.f.mjs'
import {
    catchStep, do_, history, historyStep, mapStep, pureError, pureOk, resultStep, step,
} from '../effects/module.f.mjs'
import { loadModuleMap } from '../dev/module.f.mjs'
import { invert } from '../types/result/module.f.mjs'
import { definedEntries } from '../types/object/module.f.mjs'

/** @type {(delta: number) => (ts: _TestState) => _TestState} */
const addPass = delta => ts =>
    ({ ...ts, time: ts.time + delta, pass: ts.pass + 1 })

/** @type {(delta: number) => (ts: _TestState) => _TestState} */
const addFail = delta => ts =>
    ({ ...ts, time: ts.time + delta, fail: ts.fail + 1 })

/** @type {(a: number) => string} */
const timeFormat = a => {
    const y = Math.round(a * 10_000).toString()
    const yl = 5 - y.length
    const x = '0'.repeat(yl > 0 ? yl : 0) + y
    const s = x.length - 4
    const b = x.substring(0, s)
    const e = x.substring(s)
    return `${b}.${e} ms`
}

/**
 * Converts an arbitrary JS value into a `TestSet`.
 *
 * - Zero-argument functions become a `TestEntry`; the `throws` flag is set if
 *   `throws` is already `true` (i.e. a `throw` key appears in the ancestor path).
 *   The canonical way to declare a throw-test is structural: nest it under a
 *   `throw` property key. The secondary `fn.name === 'throw'` check is a legacy
 *   path that only fires when a function is extracted from a `throw` key and
 *   placed under a different key; that pattern is engine-dependent (unreliable on
 *   Bun) and is not a supported authoring style.
 * - Non-null objects become an array of `[key, value]` pairs to recurse into.
 * - All other values (including functions with parameters) produce an empty array.
 *
 * @type {(throws: boolean, x: unknown) => TestSet}
 */
export const parseTestSet = (throws, x) => {
    switch (typeof x) {
        case 'function': {
            if (x.length === 0) {
                const fn = /** @type {TestFn} */ (x)
                return { fn, throws: throws || fn.name === 'throw' }
            }
            break
        }
        case 'object': {
            if (x !== null) {
                return Object.entries(x)
            }
            break
        }
    }
    return []
}

/**
 * Recursively collects all leaf tests reachable from `v` as `[path, entry]`
 * pairs, without running anything. Return-value sub-trees are not walked
 * (that requires execution); only the static object/array/function structure
 * is traversed.
 *
 * @type {(path: Path, throws: boolean, v: unknown) => readonly _TestAndPath[]}
 */
export const collectTests = (path, throws, v) => {
    const set = parseTestSet(throws, v)
    if (set instanceof Array) {
        return set.flatMap(([ck, cv]) =>
            collectTests([...path, ck], throws || ck === 'throw', cv)
        )
    }
    return [[path, set]]
}

/**
 * Registers all tests reachable from module export `v` (keyed by `k`) with
 * the given `TestContext`.
 *
 * Unlike `runModule`, which sandboxes only the leaf function, `registerModule`
 * lets the external framework own scheduling: each registered test callback
 * calls `fn`, then recursively registers any sub-trees returned by the function.
 * This is the correct model for Node `--test`, Bun, and Deno, where tests must
 * be declared upfront and the framework drives execution.
 *
 * @type {(ctx: TestContext, k: string, v: unknown, star: string) => Effect<Test | All | Await, void, NotImplemented>}
 */
export const registerModule = (ctx, k, v, star) => {
    /** @type {(ctx: TestContext, entry: _TestAndPath) => Effect<Test | All | Await, void, NotImplemented>} */
    const registerOne = (ctx, [path, { fn, throws }]) => {
        // `star` (non-empty for Bun and for Node below the 26 baseline) signals
        // that all sub-tests run inline inside this single registration, so an
        // external runner reports fewer tests than `fjs t` for the same suite.
        // Not appended to throw-tests since those never produce sub-tests. The
        // path already contains '.throw' when a test is expected to throw, so no
        // extra suffix is needed.
        const base = fmtImport(k, path)
        const name = throws ? base : `${base}${star}`
        // The registered callback panics on failure, deliberately. `Test` hands
        // it to an external framework (node `--test`, Bun, Deno) that takes a
        // body which either returns or throws: there is no channel to answer a
        // failure through, so propagating it here would only discard it one
        // level up.
        // A throw is what that framework *does* understand — it reports the
        // test as failed, which is the outcome a caller wants anyway. The `test`
        // operation's own result is propagated normally, just below.
        //
        // `catchStep` rather than `unwrapStep`, so the absorption is visible in
        // the type: the body answers `Effect<…, void, never>`, and the `never`
        // is *because* this handler panics. `errorSummary` still names what is
        // being panicked on and pins it, so if the body's channel ever widens
        // past the node one, the compiler asks here rather than turning a new
        // recoverable failure into a crash.
        /** @type {(t: TestContext) => Effect<Test | All | Await, void, never>} */
        const body = t =>
            catchStep(step(awaitIfPromise(fn()), resolved => {
                if (throws) {
                    return pureOk(undefined)
                }
                const sub = collectTests([...path, null], false, resolved)
                if (sub.length === 0) {
                    return pureOk(undefined)
                }
                return mapStep(allOk(...sub.map(e => registerOne(t, e))), () => undefined)
            }), e => { throw errorSummary(e) })
        return test(ctx, name, throws, body)
    }
    const tests = collectTests([], false, v)
    if (tests.length === 0) { return pureOk(undefined) }
    return mapStep(allOk(...tests.map(e => registerOne(ctx, e))), () => undefined)
}

/** @type {(a: _TestState, b: _TestState) => _TestState} */
const mergeState = (a, b) =>
    ({ time: a.time + b.time, pass: a.pass + b.pass, fail: a.fail + b.fail })

/** @type {_TestState} */
const zero = { time: 0, pass: 0, fail: 0 }

/**
 * @template {Operation} O
 * @param {Reporter<O>} reporter
 * @returns {(k: string, v: unknown) => (ts: _TestState) => Effect<O | All, _TestState, IoChannel>}
 */
const runModule = ({ result, test }) => (k, v) => ts => {
    /** @type {(entry: _TestAndPath) => Effect<O | All, _TestState, IoChannel>} */
    const one = ([testPath, set]) => {
        // The sandbox result is still needed after it has been reported, so the
        // reporting call is captured rather than nested inside its own step.
        const reported = historyStep(
            history(test(k, testPath, set)),
            sr => result(k, testPath, sr, set.throws))
        return step(
            reported,
            ([, sr]) => {
                const { result: [s, r], duration } = sr
                if (s !== 'ok') {
                    return pureOk(addFail(duration)(zero))
                }
                if (set.throws) {
                    return pureOk(addPass(duration)(zero))
                }
                // Walk return-value sub-tree; null marks the call boundary so
                // paths render as e.g. `outer().inner`. throws resets to false.
                return mapStep(
                    walk([...testPath, null], false, r),
                    sub => mergeState(addPass(duration)(zero), sub))
            })
    }
    /** @type {(path: Path, throws: boolean, v: unknown) => Effect<O | All, _TestState, IoChannel>} */
    const walk = (path, throws, v) => {
        const effects = collectTests(path, throws, v).map(one)
        return mapStep(allOk(...effects), states => states.reduce(mergeState, zero))
    }
    return mapStep(walk([], false, v), delta => mergeState(ts, delta))
}

/** @type {(moduleMap: ModuleMap) => readonly (readonly [string, unknown])[]} */
const proofEntries = moduleMap =>
    definedEntries(moduleMap)
        .flatMap(([k, v]) => v.proof !== undefined ? [/** @type {const} */ ([k, v.proof])] : [])

/**
 * Runs all test modules in `moduleMap` whose names pass `isTest`, accumulates
 * pass/fail/time via `reporter`, and returns an exit code (0 = all passed,
 * 1 = at least one failure).
 *
 * @template {Operation} O
 * @param {Reporter<O>} reporter
 * @returns {(moduleMap: ModuleMap) => Effect<O | All, number, IoChannel>}
 */
export const runModuleMap = reporter => moduleMap => {
    const { summary } = reporter
    const modules = proofEntries(moduleMap)
    const total = mapStep(
        allOk(...modules.map(([k, v]) => runModule(reporter)(k, v)(zero))),
        m => m.reduce(mergeState, zero))
    // The totals are still needed after the summary has been printed, so they
    // are carried forward in a history rather than closed over by a nested
    // continuation.
    const reported = historyStep(
        history(total),
        ts => summary(ts.pass, ts.fail, ts.time))
    return mapStep(reported, ([, ts]) => ts.fail !== 0 ? 1 : 0)
}

/**
 * Ends a run with the exit code it computed, reporting a channel failure on
 * `stderr` as exit `1`.
 *
 * Not `exitStep`, which answers `0` for every success: this chain's success
 * value **is** the exit code, `1` when a test failed. The two policies differ
 * only in what an `ok` means, and conflating them would report a failing suite
 * as a passing run.
 *
 * A non-zero code therefore leaves through the *error* branch, which is what it
 * means — a suite with failures is a failed program — and is why a caller
 * cannot chain past it by accident.
 *
 * @type {<O extends Operation>(e: Effect<O, number, IoChannel>) => Effect<O | Write, 0, number>}
 */
const exitCodeStep = e =>
    resultStep(e, r => {
        /** @type {Effect<Write, 0, number>} */
        const code = r[0] === 'error'
            ? errorExit(errorMessage(r[1]))
            : r[1] === 0 ? pureOk(0) : pureError(r[1])
        return code
    })

/**
 * Discovers all test modules via `loadModuleMap`, then runs them through
 * `runModuleMap`. The composed effect is a `NodeProgram` entry point for the
 * `fjs t` test runner.
 *
 * The chain leaves the error channel here, because this is where a `Program` ends
 * and a `Program`'s answer is an exit code rather than a `Result`. A run that
 * could not report its own results is a failed run, so it exits `1` with the
 * reason on `stderr` instead of unwinding as a panic.
 *
 * @template {Operation} O
 * @param {Reporter<O>} reporter
 * @returns {Program<O | All | LoadModuleOperations | Write>}
 */
export const testAll = reporter => options =>
    exitCodeStep(step(loadModuleMap(options.env), runModuleMap(reporter)))

/**
 * Registers all modules in `moduleMap` that export a `proof` property with
 * `ctx`. Delegates to `registerModule` for each matching entry.
 *
 * @type {(ctx: TestContext, star: string) => (moduleMap: ModuleMap) => Effect<Test | All | Await, void, NotImplemented>}
 */
const registerModuleMap = (ctx, star) => moduleMap => {
    const modules = proofEntries(moduleMap)
    if (modules.length === 0) { return pureOk(undefined) }
    return mapStep(allOk(...modules.map(([k, v]) => registerModule(ctx, k, v, star))), () => undefined)
}

/** @type {(c: string) => boolean} */
const isAlpha = c =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_' || c === '$'

/** @type {(c: string) => boolean} */
const isDigit = c => c >= '0' && c <= '9'

/** Returns `true` if `s` is a non-negative decimal integer without a leading zero.
 *
 * @type {(s: string) => boolean}
 */
export const isInteger = s =>
    s.length > 0 && [...s].every(isDigit) && (s === '0' || s[0] !== '0')

/** Returns `true` if `s` is a valid JS identifier (ASCII subset: `[A-Za-z_$][A-Za-z0-9_$]*`).
 *
 * @type {(s: string) => boolean}
 */
export const isIdentifier = s =>
    s.length > 0 && isAlpha(s[0]) && [...s.slice(1)].every(c => isAlpha(c) || isDigit(c))

/** @type {(k: string | null) => string} */
const fmtKey = k =>
    k === null ? '()'
    : isInteger(k) ? `[${k}]`
    : isIdentifier(k) ? `.${k}`
    : `[${JSON.stringify(k)}]`

/**
 * Renders a key chain as a JS property-access expression: identifier keys use
 * dot notation, integer keys use `[N]`, other strings use `["key"]`, and `null`
 * emits `()` to mark a function-call boundary.
 * E.g. `['math', 'add']` → `.math.add`, `['outer', null, 'inner']` → `.outer().inner`.
 *
 * @type {(path: Path) => string}
 */
export const fmtPath = path =>
    path.reduce((/** @type {string} */ acc, k) => acc + fmtKey(k), '')

/**
 * Formats a fully-qualified test identifier as a JS-like expression, e.g.
 * `import("./math.proof.f.ts").add()` or `import("./a.proof.f.ts").users[3].name()`.
 * Self-contained per line — suitable for parallel output and as a CLI filter argument.
 *
 * @type {(file: string, path: Path) => string}
 */
export const fmtImport = (file, path) =>
    `import(${JSON.stringify(file)}).proof${fmtPath(path)}()`

/**
 * Renders a key chain for terminal output: `| ` per level of depth, followed
 * by the last segment formatted as a bare integer, a bare identifier, or a
 * JSON-quoted string. E.g. `['math', 'add']` → `| | add`,
 * `['a', '0']` → `| | 0`, `['x', 'hello world']` → `| | "hello world"`.
 *
 * @type {(path: Path) => string}
 */
export const fmtTerm = path => {
    const keys = path.flatMap(k => k !== null ? [k] : [])
    const indent = '| '.repeat(keys.length)
    if (keys.length === 0) { return `${indent}()` }
    const last = keys[keys.length - 1]
    return `${indent}${isInteger(last) || isIdentifier(last) ? last : JSON.stringify(last)}`
}

/**
 * Percent-encodes characters that GitHub workflow-command property values
 * treat as separators (`%`, `:`, `,`) plus newlines.
 * https://docs.github.com/en/actions/learn-github-actions/workflow-commands-for-github-actions
 *
 * @type {(s: string) => string}
 */
export const ghEscape = s =>
    s.replaceAll('%', '%25')
        .replaceAll(':', '%3A')
        .replaceAll(',', '%2C')
        .replaceAll('\r', '%0D')
        .replaceAll('\n', '%0A')

/**
 * Default `Reporter.test` implementation: sandboxes `fn` once and inverts the
 * result when `throws` is `true` (caught error → pass, clean return → fail).
 *
 * @type {(file: string, path: Path, entry: TestEntry) => Effect<Sandbox, SandboxResult<unknown>, NotImplemented>}
 */
export const defaultTest = (file, path, { fn, throws }) =>
    mapStep(sandbox(fn), r => throws ? { ...r, result: invert(r.result) } : r)

/** What a `throws` leaf that returned cleanly is reported as. */
const expectedThrow = 'Expected the proof to throw'

/**
 * The message and stack to report a thrown value by.
 *
 * An `Error` thrown from another realm — an iframe, a worker — is not
 * `instanceof Error` here, and its stack is the very thing a report exists to
 * carry. What the fields say is therefore the test, not where the value was
 * made: anything carrying `message` or `stack` is read as the failure it
 * describes, and everything else by its own text.
 *
 * @type {(error: unknown) => readonly[string, string]}
 */
export const errorDetails = error => {
    if (error !== null && (typeof error === 'object' || typeof error === 'function')
        && ('message' in error || 'stack' in error)) {
        const { message, stack } = /** @type {{ readonly message?: unknown, readonly stack?: unknown }} */ (error)
        const described = String(message)
        return [described, stack === undefined ? described : String(stack)]
    }
    const fallback = String(error)
    return [fallback, fallback]
}

/**
 * Normalizes one leaf outcome into the {@link TestResult} every reporter
 * renders from.
 *
 * `r` is what {@link Reporter.test} answered, so a `throws` leaf has already
 * been inverted by {@link defaultTest}: an `error` there means the proof
 * returned when it was expected to throw, which is why that case is named
 * rather than described by the value it returned.
 *
 * @type {(file: string, path: Path, r: SandboxResult<unknown>, throws: boolean) => TestResult}
 */
export const testResult = (file, path, { result, duration }, throws) => {
    const [status, value] = result
    const common = { module: file, path: fmtPath(path), duration }
    if (status === 'ok') { return { ...common, status: 'passed' } }
    const [message, stack] = throws ? [expectedThrow, ''] : errorDetails(value)
    return { ...common, status: 'failed', message, stack }
}

/** Records one normalized leaf result as it lands.
 *
 * @type {Func<Report>}
 */
export const report = do_('report')

/** Reads back every result {@link report} has recorded.
 *
 * @type {Func<Reported>}
 */
export const reported = do_('reported')

/**
 * The reporter that answers in {@link TestResult}s instead of rendering: each
 * leaf is normalized and handed to the {@link report} operation, and the run's
 * consumer reads the sequence back with {@link reported}.
 *
 * **Its `summary` writes nothing**, and that is not an omission. Pass, fail and
 * total are `results.length` and a count of the failed ones, so a summary event
 * would restate what the recorded results already say — and a consumer that
 * derives them cannot disagree with itself about how many tests ran. The
 * terminal reporter keeps its own `summary` because a line of text is genuinely
 * not derivable from the results a user has already scrolled past.
 *
 * @type {Reporter<Report | Sandbox>}
 */
export const recordingReporter = {
    result: (file, path, r, throws) => report(testResult(file, path, r, throws)),
    summary: () => pureOk(undefined),
    test: defaultTest,
}

/** @type {(file: string, path: Path, color: string, label: string, duration: number) => string} */
const fmtResultLine = (file, path, color, label, duration) =>
    `${fmtImport(file, path)}: ${color}${label}${reset}, ${timeFormat(duration)}`

/**
 * The terminal/GitHub reporter used by `fjs t`. Output goes through
 * `csiWrite`, so ANSI styles are stripped on non-TTY streams. When
 * `GITHUB_ACTIONS` is set, failures are emitted as `::error` workflow
 * annotations instead of colored lines. Exported as a factory so the
 * GitHub format path can be exercised directly from tests.
 *
 * @type {(options: NodeProgramOptions) => Reporter<Write | Sandbox>}
 */
export const defaultReporter = options => {
    const write = csiWrite(options)
    // A reporter that cannot emit its own output has no fallback to choose —
    // there is nowhere left to report the failure — but it does not have to
    // decide that here: the failure travels to the program's tail, which ends
    // the run with the reason on `stderr` and exit `1`. That is the same
    // outcome a panic produced, minus the stack trace.
    /** @type {(w: WriteConsoles) => (s: string) => Effect<Write, void, NotImplemented>} */
    const line = w => {
        const x = write(w)
        return s => x(s + '\n')
    }
    const csiLog = line('stdout')
    const csiError = line('stderr')
    const isGitHub = options.env['GITHUB_ACTIONS'] !== undefined
    return {
        // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
        result: (file, path, { result: [s, v], duration }, throws) =>
            s === 'ok'
                ? csiLog(fmtResultLine(file, path, fgGreen, 'ok', duration) + (throws ? ' # EXPECTED TO THROW' : ''))
                : isGitHub
                    ? csiError(`::error file=${file},line=1,title=${ghEscape(fmtImport(file, path))}::${ghEscape(String(v))}`)
                    // `step`, so the detail line is attempted only when the
                    // header line was written: two halves of one report, and
                    // half of it is worse than none.
                    : step(
                        csiError(fmtResultLine(file, path, fgRed, 'error', duration)),
                        () => csiError(`${fgRed}${v}${reset}`)),
        summary: (pass, fail, time) => {
            const fgFail = fail === 0 ? fgGreen : fgRed
            return step(
                csiLog(`${bold}Number of tests: pass: ${fgGreen}${pass}${reset}${bold}, fail: ${fgFail}${fail}${reset}${bold}, total: ${pass + fail}${reset}`),
                () => csiLog(`${bold}Time: ${timeFormat(time)}${reset}`))
        },
        test: defaultTest,
    }
}

/** The `fjs t` entry point: runs all tests using `defaultReporter`.
 *
 * @type {NodeProgram}
 */
export const main =
    options => testAll(defaultReporter(options))(options)

/**
 * Entry point for external test frameworks (Node `--test`, Bun, Deno).
 *
 * Discovers test modules via `loadModuleMap`, then registers each with the
 * framework-appropriate `TestContext` selected from `NodeProgramOptions`
 * based on the detected `engine`.
 *
 * @type {NodeProgram}
 */
export const register = o => {
    const star = o.inlineTestContext ? ' ...' : ''
    const ctx = o.engine === 'bun' ? o.bunTestContext : o.testContext
    const registered = step(loadModuleMap(o.env), registerModuleMap(ctx, star))
    // `exitStep`, not `mapStep(…, () => 0)`: registering is the whole job here,
    // so "registered nothing, exit 0" is the answer this used to give and the
    // one it must not. A success has no code of its own, which is exactly the
    // shape `exitStep` is for.
    return exitStep(registered)
}
