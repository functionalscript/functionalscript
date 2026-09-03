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
 * @import { TestFn, TestEntry, TestSet, Path, LeafReporter, Reporter, RunState, RunTotals, TestFailure, TestId, TestResult, _TestAndPath } from './types.ts'
 * @import { All, Await, Env, IoChannel, NodeProgram, NodeProgramOptions, Program, Test, TestContext, Write, WriteConsoles } from '../effects/node/types.ts'
 * @import { Catch, Sandbox, SandboxResult } from '../effects/common/types.ts'
 */

import { reset, fgGreen, fgRed, bold, csiWrite } from '../text/sgr/module.f.mjs'
import { allOk, awaitIfPromise, errorExit, errorMessage, errorSummary, exitStep, test } from '../effects/node/module.f.mjs'
import { catch_, sandbox } from '../effects/common/module.f.mjs'
import {
    catchStep, foldStep, forEachStep, history, historyStep, mapStep, pure, pureError, pureOk,
    resultMapStep, resultStep, step,
    walkStep,
} from '../effects/module.f.mjs'
import { loadModuleMap } from '../dev/module.f.mjs'
import { invert, ok } from '../types/result/module.f.mjs'
import { definedEntries } from '../types/object/module.f.mjs'
import { concat } from '../types/list/module.f.mjs'

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
 * The empty {@link RunState}: what a run has accumulated before any leaf lands.
 *
 * @type {RunState}
 */
export const zeroState = { totals: zeroTotals, failures: null, aborted: null }

/**
 * Folds one leaf-landed event into a run's state: the counts through
 * {@link addResult}, and the leaf itself when it failed.
 *
 * A failed leaf is *collected* rather than described here, because what to say
 * about a thrown value is the reporter's, and when to say it is the reporter's
 * too — `fjs t` prints the details together once the run has ended, so that a
 * long run's diagnostics are one block rather than a scattering. Collecting is
 * the runner's part because the alternative is a reporter remembering things
 * between two calls it does not own.
 *
 * The append is `concat`, not a spread: this runs once per failing leaf and the
 * state is threaded through every one of them.
 *
 * @type {(state: RunState, t: TestResult, r: SandboxResult<unknown>) => RunState}
 */
export const addLeaf = (state, t, r) => ({
    ...state,
    totals: addResult(state.totals, t),
    failures: t.status === 'failed'
        ? concat(state.failures)([{ t, error: r.result[1] }])
        : state.failures,
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

/**
 * Runs leaves that have **already been collected**, for one module.
 *
 * This is the seam a host enters when it must enumerate an export itself.
 * `runModule` below is this with the enumeration in front of it, and that
 * enumeration is the whole difference: reading a module's `proof` runs user
 * code, once per read, and it must not be read twice — so a host that has
 * already read it hands the entries over rather than the value. The browser
 * page is that host: it reads the export to build its own module-failure row,
 * and enters here with what it collected.
 *
 * It also keeps a host's modules a *list*: two modules may share a label, and
 * they are two runs. Nothing here is a map.
 *
 * **It has no error channel**, and that is a property of the walk rather than
 * of the operations it uses: every failure a leaf's chain can produce is
 * recorded in `RunState.aborted` and answered as a value, because a run that
 * ended early still has failures worth describing. A host therefore gets the
 * state back whatever happened, and reads `aborted` to find out what happened.
 *
 * @template {Operation} O
 * @param {LeafReporter<O>} reporter
 * @returns {(k: string, entries: readonly _TestAndPath[]) => (state: RunState) => Effect<O | Catch, RunState, never>}
 */
export const runEntries = ({ result, start, test }) => (k, entries) => state => {
    /**
     * @type {(entry: _TestAndPath) =>
     *     (acc: RunState) =>
     *         Effect<O | Catch, readonly[RunState, readonly _TestAndPath[]], never>}
     */
    const one = ([testPath, set]) => acc => {
        // Nothing runs after the run has been abandoned. The walk cannot simply
        // stop — the state it collected has to reach the summary, which is why
        // the failure is carried in `acc` rather than thrown — so every
        // remaining leaf answers the state unchanged instead. `collectTests` is
        // not reached either, so no further proof export is enumerated: the run
        // is over, and enumerating one runs user code.
        if (acc.aborted !== null) { return pureOk(/** @type {const} */ ([acc, emptyEntries])) }
        // The leaf is named once, for both of the events that name it: the
        // announcement below and the record built from its result.
        const id = testId(k, testPath)
        // The leaf's shared record is built here, next to the sandbox result it
        // is read from, so the leaf-landed event carries the value already
        // decided — a reporter renders `t`, it does not derive its own.
        //
        // **The announcement is inside the same chain, ahead of `test`.** Not
        // beside it and not in the fold: what makes a start record worth
        // anything is that it is on the reader's screen while the leaf is
        // running, so it has to be written before the leaf's own effect is
        // performed, and a reporter that cannot write it ends the run there
        // rather than running a leaf it has failed to announce.
        //
        // **Reading the returned sub-tree is guarded, because reading it runs
        // user code.** `collectTests` enumerates what the leaf returned, so an
        // enumerable getter or a proxy trap in that value throws *here* — and
        // that is a failure of the leaf which produced it, not of the run.
        // Unguarded it unwinds the whole traversal, taking with it the results
        // of every module that had already passed. The read happens before the
        // leaf is reported, so its failure is part of what gets reported rather
        // than a correction issued after the fact.
        const evaluated = step(step(start(id), () => test(k, testPath, set)), sr => {
            const t = resultOf(id, sr)
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
        //
        // **Its `Result` is carried as a value** — that is what `resultMapStep`
        // with `ok` does — because the leaf has already run by the time it is
        // reported, and a report that fails must not erase the test that
        // succeeded or failed underneath it. Handling the failure by nesting a
        // continuation inside this one would see `t` and `sr`, and is what
        // §3.4 rules out; carrying it in the history keeps the chain flat and
        // hands the next line both the outcome and the leaf it belongs to.
        const reported = historyStep(
            history(evaluated),
            ([t, sr]) => resultMapStep(result(t, sr, set.throws), ok))
        // The leaf's children are *answered*, not walked here: `walkEntries`
        // puts them in front of the siblings that remain, which is the same
        // order — the tree a leaf returned, then the next leaf — without a
        // nested walk. Recursing instead left one continuation pending per
        // ancestor, so a leaf returning a deep enough chain of children died
        // with `RangeError` where the fan-out this replaced had not; see
        // `../effects/module.f.mjs`'s `walkStep`.
        // A failure ends the run, but as a *value*: the walk carries it to the
        // summary, which describes what the run had already collected before
        // the channel gave out. Propagating it instead discarded exactly the
        // diagnostics a dying run is worth having.
        //
        // Where it happened decides what the run keeps. A leaf whose *report*
        // failed still ran, and is folded in before the failure is recorded —
        // its count and, if it failed, the value it failed with are part of
        // what the summary describes. A failure in `start` or `test` is the
        // other case: there is no outcome to keep, and `acc` is the state
        // unchanged.
        return resultStep(
            mapStep(
                reported,
                ([reportOutcome, [t, sr, children]]) => {
                    const landed = addLeaf(acc, t, sr)
                    return reportOutcome[0] === 'ok'
                        ? /** @type {const} */ ([landed, children])
                        : /** @type {const} */ ([
                            { ...landed, aborted: reportOutcome[1] },
                            emptyEntries,
                        ])
                }),
            r => r[0] === 'ok'
                ? pure(r)
                : pureOk(/** @type {const} */ ([{ ...acc, aborted: r[1] }, emptyEntries])))
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
     * This replaced `allOk(...entries.map(one))`, and the reasons are items
     * 1-3 of `./README.md`'s pitfall catalog: fanning out made the whole suite
     * one uninterruptible task in a browser, queued every report behind the
     * last leaf, and put each fan-out under the engine's argument limit
     * (`../effects/todo/all-argument-limit.md`). None of those were paid for
     * by anything: a proof runner has no deadline, and the wall clock a
     * fan-out saves is not a goal here.
     *
     * `walkStep` and not a hand-rolled recursion because it is this layer's
     * `for` loop, and the accumulator is the run's `RunState` — the counts
     * added to per leaf, the failures appended to with `concat`, so every join
     * is O(1) whichever half of it grew. It is `walkStep` rather than
     * `foldStep` because a leaf's children are items of *this* loop: `one`
     * answers them and they go in front of the siblings that remain. Folding and recursing into the children instead kept one
     * continuation pending per ancestor, which is flat along the siblings and
     * not along the path — a leaf returning a 5,000-deep chain of children
     * died with `RangeError` where the fan-out this replaced had not.
     *
     * The run's state is threaded in rather than a per-module delta being
     * merged out: `one` extends what it is given, so a module continues the run
     * it is part of and there is nothing to join afterwards.
     *
     * @type {(entries: readonly _TestAndPath[]) => Effect<O | Catch, RunState, never>}
     */
    const walkEntries = entries => walkStep(pureOk(entries), state, one)
    return walkEntries(entries)
}

/**
 * One module: its `proof` export enumerated, then its leaves walked.
 *
 * Enumerating the export reads nothing but plain FunctionalScript data — a
 * `proof` is a function or a tree of them — so the read itself cannot fail and
 * is not guarded. `fjs/AGENTS.md` §1.6 is why: a value carrying a getter or a
 * proxy trap is not a value FunctionalScript builds, and the effect system's
 * job is to keep such a value from reaching one, not to have every walk defend
 * against it.
 *
 * @template {Operation} O
 * @param {Reporter<O>} reporter
 * @returns {(k: string, v: unknown) => (state: RunState) => Effect<O | Catch, RunState, IoChannel>}
 */
const runModule = reporter => (k, v) => state =>
    runEntries(reporter)(k, collectTests([], false, v))(state)

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
    // are all reported before the next module's first one — and the state is
    // threaded rather than merged afterwards, because `runModule` already
    // accepts the running state and answers the extended one.
    const total = foldStep(
        pureOk(modules),
        zeroState,
        // Skipped rather than stopped, for the reason `one` gives: an
        // abandoned run still has to reach its summary.
        ([k, v]) => state =>
            state.aborted !== null ? pureOk(state) : runModule(reporter)(k, v)(state))
    // The state is still needed after the summary has been printed, so it is
    // carried forward in a history rather than closed over by a nested
    // continuation.
    const reported = historyStep(
        history(total),
        summary)
    // A run that was abandoned ends with the failure that abandoned it, not
    // with an exit code computed from counts that stopped early — the tail
    // reports it and exits `1`. The summary has already run by then, so the
    // failures it collected are described either way.
    return step(
        reported,
        ([, { totals, aborted }]) =>
            aborted !== null ? pureError(aborted) : pureOk(totals.failed !== 0 ? 1 : 0))
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
 * Names one leaf: what module it is in, where in that module, and what to call
 * it.
 *
 * Separate from {@link testResult} because a leaf is named at two moments and
 * judged at one — a runner announces it before running it and reports it
 * afterwards, and both should call it the same thing. The traversal builds this
 * once per leaf and hands it to both events.
 *
 * @type {(file: string, path: Path) => TestId}
 */
export const testId = (file, path) => ({
    module: file,
    path: fmtPath(path),
    name: fmtImport(file, path),
})

/** @type {(id: TestId, r: SandboxResult<unknown>) => TestResult} */
const resultOf = (id, { result: [s], duration }) => ({
    ...id,
    status: s === 'ok' ? 'passed' : 'failed',
    duration,
})

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
export const testResult = (file, path, r) => resultOf(testId(file, path), r)

/**
 * The *end* of a leaf's line. The name is already on the stream — `start` wrote
 * it before the leaf ran — so this completes that line rather than repeating
 * it.
 *
 * @type {(r: TestResult, color: string, label: string) => string}
 */
const fmtResultEnd = ({ duration }, color, label) =>
    `${color}${label}${reset}, ${timeFormat(duration)}`

/**
 * What a value that cannot be read is called.
 *
 * A value reaches a report by being described, and describing runs the value's
 * own code — a `toString`, a getter, a proxy trap — which can throw in its
 * turn. Every route that meets one says this, so a reader meets one phrase
 * rather than a spelling per runner.
 */
export const unknownValue = 'Unknown thrown value'

/**
 * The text of a value that may not want to be read. `String` runs user code, so
 * it is attempted rather than called.
 *
 * **A runner that cannot `catch` gets the same phrase**, which is why the
 * refusal is folded in here rather than propagated: there is no reader for whom
 * "the value could not be read" and "the runner would not read it" are
 * different facts, and a describer with an error channel would put that
 * distinction in every caller.
 *
 * @type {(value: unknown) => Effect<Catch, string, never>}
 */
export const text = value => resultStep(
    catch_(() => String(value)),
    r => pureOk(r[0] === 'ok' && r[1][0] === 'ok'
        ? /** @type {string} */ (r[1][1])
        : unknownValue))

/**
 * The terminal/GitHub reporter used by `fjs t`. Output goes through
 * `csiWrite`, so ANSI styles are stripped on non-TTY streams. When
 * `GITHUB_ACTIONS` is set, failures are emitted as `::error` workflow
 * annotations instead of colored lines. Exported as a factory so the
 * GitHub format path can be exercised directly from tests.
 *
 * @type {(options: NodeProgramOptions) => Reporter<Write | Sandbox | Catch>}
 */
export const defaultReporter = options => {
    const write = csiWrite(options.std)
    // A reporter that cannot emit its own output has no fallback to choose —
    // there is nowhere left to report the failure — but it does not have to
    // decide that here: the failure travels to the program's tail, which ends
    // the run with the reason on `stderr` and exit `1`. That is the same
    // outcome a panic produced, minus the stack trace.
    const out = write('stdout')
    // **Every record a run produces goes to `stdout`, failures included.** The
    // two streams are not ordered against each other, so splitting the report
    // across them means a reader — or a consumer collecting the log — cannot
    // tell where a failure's detail belongs among the tests that surround it,
    // which is the one thing the ordering of these records is for. `stderr` is
    // left for a runner *crash*: the tail's channel-failure message, written by
    // `errorExit` after the run is over, where nothing remains to correlate it
    // with.
    const csiLog = (/** @type {string} */ s) => out(s + '\n')
    const isGitHub = options.env['GITHUB_ACTIONS'] !== undefined
    // What a failure *was* is written once the run has ended, not where it
    // happened: an error's detail — a message, a whole stack — is as many lines
    // as it likes, and inline it splits the one thing the progress output is
    // for, which is a leaf per line in the order they ran. So a leaf writes its
    // pass or fail and nothing else, and this describes them together
    // afterwards, in the order they landed.
    //
    // https://github.com/OndraM/ci-detector/blob/main/src/Ci/GitHubActions.php
    //
    // **The value is read through {@link text}, because reading it runs the
    // value's own code.** A proof that throws `{ toString() { throw … } }` used
    // to kill the summary *here* — after every leaf had run and been reported —
    // so a completed run printed no totals and no exit code, which is the one
    // outcome an automated consumer cannot act on. The page has described
    // values this way since functionalscript#1802; this is the same read, in
    // the reporter that needed it.
    /** @type {(f: TestFailure) => Effect<Write | Catch, void, NotImplemented>} */
    const detail = ({ t, error }) => step(text(error), described =>
        isGitHub
            ? csiLog(`::error file=${t.module},line=1,title=${ghEscape(t.name)}::${ghEscape(described)}`)
            // `step`, so the value is attempted only when the line naming the
            // test it belongs to was written: two halves of one report, and
            // half of it is worse than none.
            : step(
                csiLog(`${fgRed}${t.name}${reset}`),
                () => csiLog(`${fgRed}${described}${reset}`)))
    return {
        // One line per leaf, opened before it runs and closed when it lands:
        // `name: ` here, `ok, 1.2345 ms` from `result`. A reader watching a
        // suite sees the name of the test that is running now, and the finished
        // line says the same thing a single-record reporter would.
        //
        // The line is open while the leaf runs, so anything the leaf itself
        // puts on this stream — a proof that logs, a node warning — splices
        // into it, and the same happens to a leaf whose run never reports: the
        // line stays open. Both are visible rather than silent, the name is on
        // the stream either way, and `summary` closes a line left open by a run
        // that was abandoned.
        //
        // **Two complete records was the first form, and was reverted.** A
        // start naming the test and a result naming it again defends the
        // splice above, at the price of doubling every line of every run to
        // keep a case tidy that announces itself when it happens. A non-TTY
        // consumer does want a record per event, and that is a second format
        // for a second audience — `todo/tty-and-line-consumers.md` — not a
        // reason to reinstate it here.
        start: ({ name }) => out(`${name}: `),
        result: (t, _r, throws) =>
            t.status === 'passed'
                ? csiLog(fmtResultEnd(t, fgGreen, 'ok') + (throws ? ' # EXPECTED TO THROW' : ''))
                : csiLog(fmtResultEnd(t, fgRed, 'error')),
        // The details come before the counts, so the numbers a reader is
        // looking for are still the last thing on the screen.
        // A run that was abandoned gets its failures described and no counts:
        // a `pass/fail/total` line for a walk that stopped early reads as a
        // finished run and is not one. What ended it is the tail's to report.
        summary: ({ totals: { passed, failed, duration }, failures, aborted }) => {
            const fgFail = failed === 0 ? fgGreen : fgRed
            // A run that was abandoned left its last leaf's line open — the
            // leaf was announced and never landed. Close it before anything
            // else is written, so the detail below starts where a line starts.
            return step(
                step(
                    aborted === null ? pureOk(undefined) : csiLog(''),
                    () => forEachStep(pureOk(failures), detail)),
                () => aborted !== null
                    ? pureOk(undefined)
                    : step(
                        csiLog(`${bold}Number of tests: pass: ${fgGreen}${passed}${reset}${bold}, fail: ${fgFail}${failed}${reset}${bold}, total: ${passed + failed}${reset}`),
                        () => csiLog(`${bold}Time: ${timeFormat(duration)}${reset}`)))
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
