/**
 * Test-framework helpers for running and reporting FunctionalScript tests.
 *
 * Two execution paths, side by side:
 * - `runModule` / `Reporter<O>` — self-hosted Effects runner used by `fjs t`;
 *   sandboxes each leaf call individually and accumulates `RunTotals`. It runs
 *   **sequentially**: one leaf's whole chain — the call, its report, the tree
 *   its return value produced — finishes before the next leaf starts. See
 *   `walkEntries` for why that is the traversal's contract rather than an
 *   incidental property of the runner underneath it.
 * - `registerModule` / `TestContext` — registers tests with an external
 *   framework (Node `--test`, Bun, Deno) at import time; the framework owns
 *   scheduling and pass/fail counting.
 *
 * @module
 *
 * @import { Operation } from '../effects/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Effect, NotImplemented } from '../effects/types.ts'
 * @import { LoadModuleOperations, ModuleMap } from '../dev/types.ts'
 * @import { TestFn, TestEntry, TestSet, Path, Reporter, RunTotals, TestResult, _TestAndPath } from './types.ts'
 * @import { All, Await, Catch, Env, IoChannel, NodeProgram, NodeProgramOptions, Program, Sandbox, SandboxResult, Test, TestContext, Write, WriteConsoles } from '../effects/node/types.ts'
 */

import { reset, fgGreen, fgRed, bold, csiWrite } from '../text/sgr/module.f.mjs'
import { allOk, awaitIfPromise, catch_, errorExit, errorMessage, errorSummary, exitStep, sandbox, test } from '../effects/node/module.f.mjs'
import {
    catchStep, foldStep, history, historyStep, mapStep, pureError, pureOk, resultStep, step,
} from '../effects/module.f.mjs'
import { loadModuleMap } from '../dev/module.f.mjs'
import { invert } from '../types/result/module.f.mjs'
import { definedEntries } from '../types/object/module.f.mjs'

/**
 * The empty {@link RunTotals}: what a run's totals are before any leaf lands.
 *
 * @type {RunTotals}
 */
export const zeroTotals = { passed: 0, failed: 0, duration: 0 }

/**
 * Folds one leaf-landed event into a run's totals.
 *
 * This is where "did the run pass" is decided, for every runner: the counts
 * come from each result's shared `status`, so the summary line, the exit code
 * and the browser report's totals all read the same fold of the same events
 * rather than each counting their own way.
 *
 * @type {(totals: RunTotals, r: TestResult) => RunTotals}
 */
export const addResult = (totals, r) => ({
    passed: totals.passed + (r.status === 'passed' ? 1 : 0),
    failed: totals.failed + (r.status === 'failed' ? 1 : 0),
    duration: totals.duration + r.duration,
})

/**
 * The empty entry list, named so the three places that mean "this leaf has no
 * sub-tree" share one value rather than three literals.
 *
 * @type {readonly _TestAndPath[]}
 */
const emptyEntries = []

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

/** @type {(a: RunTotals, b: RunTotals) => RunTotals} */
const mergeTotals = (a, b) =>
    ({ passed: a.passed + b.passed, failed: a.failed + b.failed, duration: a.duration + b.duration })

/**
 * @template {Operation} O
 * @param {Reporter<O>} reporter
 * @returns {(k: string, v: unknown) => (ts: RunTotals) => Effect<O | Catch, RunTotals, IoChannel>}
 */
const runModule = ({ result, test }) => (k, v) => ts => {
    /** @type {(entry: _TestAndPath) => Effect<O | Catch, RunTotals, IoChannel>} */
    const one = ([testPath, set]) => {
        // The leaf's shared record is built here, next to the sandbox result it
        // is read from, so the leaf-landed event carries the value already
        // decided — a reporter renders `t`, it does not derive its own.
        //
        // **Reading the returned sub-tree is guarded, because reading it runs
        // user code.** `collectTests` enumerates what the leaf returned, so an
        // enumerable getter or a proxy trap in that value throws *here* — and
        // that is a failure of the leaf which produced it, not of the run.
        // Unguarded it unwinds the whole traversal, taking with it the results
        // of every module that had already passed. The read happens before the
        // leaf is reported, so its failure is part of what gets reported rather
        // than a correction issued after the fact.
        const evaluated = step(test(k, testPath, set), sr => {
            const t = testResult(k, testPath, sr)
            if (t.status !== 'passed' || set.throws) {
                return pureOk(/** @type {const} */ ([t, sr, emptyEntries]))
            }
            // null marks the call boundary, so paths render as
            // `outer().inner`; `throws` resets to false inside a return value.
            const read = /** @type {Effect<Catch, Result<readonly _TestAndPath[], unknown>, NotImplemented>} */ (
                catch_(() => collectTests([...testPath, null], false, sr.result[1])))
            return mapStep(
                read,
                r => r[0] === 'ok'
                    ? /** @type {const} */ ([t, sr, r[1]])
                    // The leaf answers for a tree nothing can read. Its own
                    // duration is kept — that is what running it took — while
                    // the result handed to the reporter carries the reading
                    // failure, so a host that describes a thrown value
                    // describes this one.
                    : /** @type {const} */ ([
                        { ...t, status: 'failed' },
                        { ...sr, result: r },
                        emptyEntries,
                    ]))
        })
        // Both are still needed after they have been reported, so the reporting
        // call is captured rather than nested inside its own step.
        const reported = historyStep(
            history(evaluated),
            ([t, sr]) => result(t, sr, set.throws))
        return step(
            reported,
            ([, [t, sr, children]]) => {
                const total = addResult(zeroTotals, t)
                if (children.length === 0) {
                    return pureOk(total)
                }
                return mapStep(
                    walkEntries(children),
                    sub => mergeTotals(total, sub))
            })
    }
    /**
     * Siblings in order, one whole chain at a time.
     *
     * **The sequence is the contract, not a scheduling detail.** `one` is the
     * leaf's call, its report and the walk of whatever it returned; folding
     * over the siblings puts the next leaf's call *after* the previous leaf's
     * report rather than merely after its call. Everything a reader of a
     * running suite expects follows from that one property: a line lands as
     * its test finishes, in structural order, and a leaf's reported duration
     * is its own time rather than a share of a group's.
     *
     * This replaced `allOk(...entries.map(one))`, and the reasons are in
     * `todo/share-browser-console-runner.md`: fanning out made the whole suite
     * one uninterruptible task in a browser, queued every report behind the
     * last leaf, and put each fan-out under the engine's argument limit
     * (`../effects/todo/all-argument-limit.md`). None of those were paid for
     * by anything: a proof runner has no deadline, and the wall clock a
     * fan-out saves is not a goal here.
     *
     * `foldStep` and not a hand-rolled recursion because it is this layer's
     * `for` loop, and the accumulator is `RunTotals` — merged per leaf, so the
     * join stays a constant-size record rather than a growing list.
     *
     * @type {(entries: readonly _TestAndPath[]) => Effect<O | Catch, RunTotals, IoChannel>}
     */
    const walkEntries = entries =>
        foldStep(
            pureOk(entries),
            zeroTotals,
            entry => acc => mapStep(one(entry), delta => mergeTotals(acc, delta)))
    // The *module's* own export is read unguarded, and that asymmetry is
    // deliberate rather than an oversight: there is no leaf to attribute it to,
    // so an unreadable `proof` export is whatever loaded the module's problem.
    // `fjs t` panics on one; the browser page catches it and reports one failed
    // module. See `todo/hostile-proof-values.md`.
    return mapStep(walkEntries(collectTests([], false, v)), delta => mergeTotals(ts, delta))
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
 * @returns {(moduleMap: ModuleMap) => Effect<O | Catch, number, IoChannel>}
 */
export const runModuleMap = reporter => moduleMap => {
    const { summary } = reporter
    const modules = proofEntries(moduleMap)
    // Modules are folded for the same reason siblings are — one module's leaves
    // are all reported before the next module's first one — and the totals are
    // threaded rather than merged afterwards, because `runModule` already
    // accepts the running totals and answers the extended ones.
    const total = foldStep(
        pureOk(modules),
        zeroTotals,
        ([k, v]) => ts => runModule(reporter)(k, v)(ts))
    // The totals are still needed after the summary has been printed, so they
    // are carried forward in a history rather than closed over by a nested
    // continuation.
    const reported = historyStep(
        history(total),
        summary)
    return mapStep(reported, ([, ts]) => ts.failed !== 0 ? 1 : 0)
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
 * @returns {Program<O | Catch | LoadModuleOperations | Write>}
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

/**
 * Normalizes one leaf's outcome: its identity, whether it passed, and how long
 * it took.
 *
 * `r` is the result *after* the throw expectation has been applied — what
 * {@link defaultTest} answers — so `ok` means the leaf did what it was supposed
 * to, whether that was returning or throwing. Inverting first and normalizing
 * second is what lets one status rule serve both cases.
 *
 * Every runner builds its report through this, so "what is this test called"
 * and "did it pass" are answered once rather than once per host. What a runner
 * does with the answer — a coloured line, a row in a page, a JSON record — is
 * its own.
 *
 * @type {(file: string, path: Path, r: SandboxResult<unknown>) => TestResult}
 */
export const testResult = (file, path, { result: [s], duration }) => ({
    module: file,
    path: fmtPath(path),
    name: fmtImport(file, path),
    status: s === 'ok' ? 'passed' : 'failed',
    duration,
})

/** @type {(r: TestResult, color: string, label: string) => string} */
const fmtResultLine = ({ name, duration }, color, label) =>
    `${name}: ${color}${label}${reset}, ${timeFormat(duration)}`

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
        result: (t, r, throws) => {
            const v = r.result[1]
            return t.status === 'passed'
                ? csiLog(fmtResultLine(t, fgGreen, 'ok') + (throws ? ' # EXPECTED TO THROW' : ''))
                : isGitHub
                    ? csiError(`::error file=${t.module},line=1,title=${ghEscape(t.name)}::${ghEscape(String(v))}`)
                    // `step`, so the detail line is attempted only when the
                    // header line was written: two halves of one report, and
                    // half of it is worse than none.
                    : step(
                        csiError(fmtResultLine(t, fgRed, 'error')),
                        () => csiError(`${fgRed}${v}${reset}`))
        },
        summary: ({ passed, failed, duration }) => {
            const fgFail = failed === 0 ? fgGreen : fgRed
            return step(
                csiLog(`${bold}Number of tests: pass: ${fgGreen}${passed}${reset}${bold}, fail: ${fgFail}${failed}${reset}${bold}, total: ${passed + failed}${reset}`),
                () => csiLog(`${bold}Time: ${timeFormat(duration)}${reset}`))
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
