/**
 * Types for running and reporting FunctionalScript tests.
 *
 * @module
 */

import type { Effect, OpResult, Operation } from '../effects/types.ts'
import type { IoChannel } from '../effects/node/types.ts'
import type { SandboxResult } from '../effects/common/types.ts'
import type { List } from '../types/list/types.ts'

/** A zero-argument test function whose return value may contain sub-tests. */
export type TestFn = () => unknown

/**
 * A leaf test bundled with its throw expectation.
 *
 * `throws: true` means the test is expected to throw; the runner inverts the
 * `sandbox` result so a caught error becomes a pass and a clean return becomes
 * a failure. Using a record instead of a wrapper function avoids a double
 * `sandbox` call and gives accurate per-test timing.
 */
export type TestEntry = {
    readonly fn: TestFn
    readonly throws: boolean
}

/**
 * Either a leaf `TestEntry` (function + throw flag) or a named sub-tree of
 * `[key, value]` pairs to recurse into. Discriminate with `Array.isArray`.
 */
export type TestSet = TestEntry | readonly (readonly [string, unknown])[]

/**
 * A chain of property-access keys leading to a test location. String entries
 * are object/array keys; `null` marks a function-call boundary (the return
 * value was walked as a sub-tree).
 */
export type Path = readonly (string | null)[]

/** Whether a leaf passed, after the throw expectation has been applied. */
export type TestStatus = 'passed' | 'failed'

/**
 * What a leaf *is*, normalized: the module it lives in, where in that module's
 * `proof` export it is, and what to call it — with no terminal escape codes and
 * no DOM node in it.
 *
 * It exists so that every runner decides those things the same way. The
 * console runner and the browser runner each used to derive them inline — one
 * on its way to a printed line, the other on its way to a serializable report —
 * and a status is exactly the kind of small decision that drifts unnoticed when
 * it is made twice.
 *
 * **A thrown value is deliberately absent.** Describing one is not a decision
 * every host can share: the browser's report must survive a wire hop, so it
 * reads `message` and `stack` off the value, while `fjs t` prints the value
 * itself and keeps the stack the panic would have shown. Both need the raw
 * value to do that, and a raw value cannot live in a serializable record. So
 * the description stays with each host and this carries the part they agree
 * on — the shape of an extension point, not an omission.
 */
export type TestId = {
    /** The module key the outcome belongs to, relative to the run's root. */
    readonly module: string
    /**
     * The key chain within that module's `proof` export, as `fmtPath` renders
     * it — empty when the outcome is not a leaf's.
     */
    readonly path: string
    /**
     * What ran. For a leaf this is `fmtImport(module, path)`, the identity every
     * runner names it by. A runner may also report an outcome that has no leaf —
     * the browser reports a module that will not link, so that a report saying
     * "0 tests" cannot be confused with a suite that is merely broken — and
     * names it by whatever it does know, which for a module is its source.
     *
     * So this is "what ran", not "which leaf ran". Whether a runner should
     * report a non-leaf outcome through this type at all, or through a separate
     * variant with its own fields, is open — see
     * `todo/share-browser-console-runner.md`, with the rest of the report
     * shape.
     *
     * **The runners are not symmetric here, and that is a known gap rather than
     * a design.** Only the browser reports a non-leaf outcome at all: the same
     * `proof` export that it records as one failed result makes `fjs t` panic,
     * taking down the whole run — including the modules that would have passed,
     * which are then never reported either. So a consumer must not read this
     * field's tolerance as a promise that every runner keeps going. Closing the
     * gap is `todo/hostile-proof-values.md`, which needs an operation the
     * shared traversal does not have.
     */
    readonly name: string
}

/**
 * One leaf's outcome: its {@link TestId}, whether it passed, and how long it
 * took.
 *
 * The identity is a type of its own because it is known at two moments and the
 * outcome at one: a runner names a leaf *before* running it — that is what
 * `Reporter.start` carries — and can only say how it went afterwards. Splitting
 * the record is what lets both events name a test the same way rather than
 * each spelling an identity of its own.
 */
export type TestResult = TestId & {
    readonly status: TestStatus
    /**
     * How long it took. For a leaf, its own execution; for a non-leaf outcome,
     * whatever the runner was measuring when it failed.
     */
    readonly duration: number
}

/**
 * A leaf's outcome as the browser page reports it: the shared
 * {@link TestResult} — identity, status and duration, decided by `testResult`
 * rather than by the browser runner — plus the two fields only a browser
 * report needs.
 *
 * `message` and `stack` are the browser's own part, and stay outside the shared
 * record for the reason `TestResult` gives: describing a thrown value needs the
 * value, a serializable report cannot carry one, and `fjs t` describes it
 * differently because it is writing to a terminal rather than to a wire.
 *
 * @internal
 */
export type _BrowserTestResult = TestResult & {
    readonly message?: string
    readonly stack?: string
}

/**
 * What the page is told, as it happens: a module finished loading, or a leaf
 * landed.
 *
 * One operation carries both because both are the same thing to a page — the
 * suite made progress, show it — and because the browser's whole vocabulary is
 * the shared operations plus *one*, which is what made the interpreter's own
 * failure cheap to reach in a proof.
 *
 * The loading half names only the module. Counting how many have arrived is
 * the observer's, not the walk's: the walk says *what* happened and a page
 * decides what to render from the sequence it has seen, which is the same
 * bargain the leaf-landed half makes.
 *
 * @internal
 */
export type _BrowserEvent =
    | readonly['loading', string]
    | readonly['result', _BrowserTestResult]

/**
 * The page's own operation: something happened, here it is.
 *
 * It is declared here rather than in `effects/` because it is nobody else's —
 * `effects/common` holds what is not one host's, and rendering into a document
 * is what *this* host is. The page's interpreter is the shared operations plus
 * this one, which is the whole of what the browser adds.
 *
 * @internal
 */
export type _BrowserReport = readonly['report', (event: _BrowserEvent) => OpResult<void>]

/**
 * What loading the suite's modules answered: the proofs to run, or the rows
 * describing why the run cannot start.
 *
 * A module that will not link has no tests, so one failure stops the suite —
 * the page reports `infrastructure-error` and the rows say which sources.
 * Every failure is still a counted row, because totals that disagreed with
 * `results` would tell a consumer the suite was empty rather than broken.
 *
 * @internal
 */
export type _LoadOutcome =
    | readonly['ready', readonly (readonly[string, unknown])[]]
    | readonly['failed', readonly _BrowserTestResult[]]

/**
 * The loading walk's accumulator: what has loaded, what would not, and the
 * failure that stopped the walk.
 *
 * Three fields and not two, because the two failures are not the same failure.
 * A module that will not link is *its* failure and the walk goes on — a report
 * naming one of two broken modules sends a reader to fix half the problem —
 * while a page that cannot be told is the run's, and stops it: a run whose
 * reporting is broken cannot describe the rest either.
 *
 * The two collections are `List`s joined with `concat`, not arrays appended to:
 * the walk adds one entry per source, and an immutable append would copy the
 * prefix every time — quadratic in the size of the suite. Catalog item 9. They
 * are materialised once, when the walk has finished.
 *
 * @internal
 */
export type _LoadState = {
    readonly ready: List<readonly[string, unknown]>
    readonly rejected: List<_BrowserTestResult>
    readonly stopped: _BrowserTestResult | null
}

/** The serializable report a browser test run resolves with. */
export type BrowserTestReport = {
    readonly status: string
    readonly browser: string
    readonly totals: {
        readonly tests: number
        readonly passed: number
        readonly failed: number
    }
    readonly duration: number
    readonly results: readonly _BrowserTestResult[]
}

/**
 * A run's outcome, folded from its leaf results: how many passed, how many
 * failed, and how long they took together.
 *
 * It is built one `TestResult` at a time with `addResult`, starting from
 * `zeroTotals`, so a stream of leaf-landed events and a finished totals record
 * are the same information at two moments — which is what lets both runners
 * answer "did the run pass" (`failed !== 0`) from the same fold.
 *
 * `duration` is the *sum* of the folded results' durations, and it is a sum
 * rather than a span even now that both runners walk sequentially. `fjs t`
 * prints it as its `Time:` line, where it is within a second of the wall clock.
 * The browser's is not: its report keeps its own wall clock, which includes the
 * macrotask it yields between leaves so the page can paint — time the run took
 * and no leaf spent. So the two numbers answer different questions wherever a
 * runner does anything between leaves, which is why the wire report carries its
 * own and takes only the counts from the fold.
 */
export type RunTotals = {
    readonly passed: number
    readonly failed: number
    readonly duration: number
}

/**
 * One failed leaf, kept until the run ends.
 *
 * It pairs the shared {@link TestResult} with the **raw** value the leaf failed
 * with — after the throw expectation has been applied, so an expected throw
 * that threw is not here and one that returned cleanly is. That raw value is
 * why this is a separate type rather than a field on `TestResult`: describing a
 * thrown value is each host's part and a raw value cannot cross a wire, which
 * is the rule `TestResult` states. This record never leaves the process it was
 * produced in.
 */
export type TestFailure = {
    readonly t: TestResult
    readonly error: unknown
}

/**
 * What a run accumulates as it walks: the {@link RunTotals} every runner folds,
 * and the failures a reporter may want to describe once at the end rather than
 * where they happened.
 *
 * The failures are a {@link List} rather than an array because the traversal
 * threads this record through every leaf and joins it at every module boundary:
 * appending to an array copies it, so a suite's *n*th failure would cost *n*
 * again — the linear-join rule in
 * `todo/share-browser-console-runner.md`'s catalog. `concat` is O(1) and keeps
 * the order the leaves landed in, which is the order the report is asked to be
 * in.
 *
 * `failures` holds exactly `totals.failed` entries: both are decided by the
 * same `status` on the same event, in `addLeaf`.
 */
export type RunState = {
    readonly totals: RunTotals
    readonly failures: List<TestFailure>
    /**
     * The channel failure that ended the run early, or `null` for a run that
     * reached its end.
     *
     * **It is carried here rather than thrown**, and that is the whole reason
     * this field exists. A failing `start`, `test` or `result` used to
     * short-circuit the walk, which took the collected failures with it: a run
     * that died after one test had already failed printed that test's name and
     * never its error, because `summary` — the only thing that describes them
     * — was never reached. Diagnostics being lost precisely when something went
     * wrong is backwards, so the failure travels *in* the fold: the walk stops
     * (every remaining leaf and module is skipped, so no further proof export
     * is even enumerated), the summary still runs, and the run ends with this
     * error afterwards.
     */
    readonly aborted: IoChannel | null
}

/**
 * Receives semantic test-run events. Each method is the runner's notification
 * of an event; the reporter decides how to render it (terminal, GitHub
 * annotations, JSON, node `--test`, etc.).
 *
 * **Every method is fallible**, because reporting is IO and IO can fail: a
 * write to a closed pipe, a runner that cannot dispatch `write` at all. The
 * runner propagates what a method answers, so a reporter that cannot emit ends
 * the run rather than being silently ignored.
 *
 * `result` and `summary` in particular *must* carry their `Result` in the type.
 * They used to answer a raw effect of `void`, and TypeScript accepts an effect of
 * any value type where a `void` one is expected — so an implementation whose
 * writes were fallible type-checked while its failures went nowhere. That is
 * the hazard the error channel exists to remove, and a `void` return position hides
 * it exactly where a reporter's whole job is to perform IO.
 *
 * The channel is the standard node one ({@link IoChannel}) rather than a type
 * parameter: a reporter is free in which *operations* it performs, but it fails
 * the way node IO fails, and pinning it here keeps the type — and the program
 * tail that reports it — free of a parameter every caller would have to thread
 * through unchanged.
 */
export type LeafReporter<O extends Operation> = {
    /**
     * A leaf is about to run, named before there is anything to say about it.
     *
     * It carries the identity and nothing else, because nothing else exists
     * yet: a duration would have to be invented and a status guessed. **It must
     * not cost a `sandbox` call or a clock read of its own** — the duration a
     * run reports stays the sandboxed one, measured around the leaf's body and
     * nothing this event does.
     *
     * A start with no matching `result` is the signal a run that died mid-test
     * leaves behind, and it is the whole reason this event exists: the last
     * thing printed used to be the last test that *succeeded*, so the one that
     * actually broke was never named.
     */
    readonly start: (id: TestId) => Effect<O, void, IoChannel>
    /**
     * A leaf landed. The first argument is the shared {@link TestResult} — the
     * runner builds it with `testResult` before notifying, so a reporter
     * receives the leaf's identity and status rather than deriving its own.
     * The raw `SandboxResult` and the throw expectation travel with it because
     * describing a *thrown value* is each host's part (see {@link TestResult}),
     * and the description needs the value.
     */
    readonly result: (t: TestResult, r: SandboxResult<unknown>, throws: boolean) => Effect<O, void, IoChannel>
    readonly test: (file: string, path: Path, set: TestEntry) => Effect<O, SandboxResult<unknown>, IoChannel>
}

/**
 * A reporter for a whole run: the leaf events, plus the one that ends it.
 *
 * The split is not decoration. `runEntries` walks leaves and calls exactly the
 * three events above; the run-ended event belongs to whoever decided the run
 * was over, which for a host that walks several modules is the host. Requiring
 * it of every reporter meant a browser page — which folds its own report from
 * the rows it collected — supplying a `summary` that nothing ever called, and a
 * member nobody calls is a claim the type was making falsely.
 */
export type Reporter<O extends Operation> = LeafReporter<O> & {
    /**
     * The run ended, with everything folded from the leaves that landed: the
     * totals, and the failures in the order they happened.
     *
     * **The failures are passed, not remembered.** A reporter that wants to
     * describe them together at the end — as `fjs t` does — could collect them
     * itself as `result` is called, but only by keeping state between two calls
     * it does not own, which a reporter has no way to scope to one run. The
     * runner already threads a fold through the walk, so it carries these too
     * and hands them over here.
     */
    readonly summary: (state: RunState) => Effect<O, void, IoChannel>
}

/** @internal */
export type _TestAndPath = readonly [Path, TestEntry]
