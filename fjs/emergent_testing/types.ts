/**
 * Types for running and reporting FunctionalScript tests.
 */

import type { Effect, Operation } from '../effects/types.ts'
import type { List } from '../types/list/types.ts'
import type { IoChannel, OpResult, SandboxResult } from '../effects/node/types.ts'

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
 * One leaf's outcome, normalized: what ran, whether it passed, and how long it
 * took, with no terminal escape codes and no DOM node in it.
 *
 * It exists so that every runner decides those three things the same way. The
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
export type TestResult = {
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
 * The browser page's own reporting operation: the shared traversal hands it one
 * leaf record, and the page's interpreter renders it and answers it back.
 *
 * It is an operation rather than a callback because the traversal is pure —
 * rendering a row is a side effect, and the effect system is where those go.
 * One operation for the whole event is enough: making each DOM detail its own
 * operation would grow the browser's op-set without making the shared API any
 * better.
 *
 * @internal
 */
export type _BrowserReport =
    readonly['report', (r: _BrowserTestResult) => OpResult<_BrowserTestResult>]

/**
 * Loads one proof module by its source path for the browser runner.
 *
 * @internal
 */
export type _BrowserImporter = (source: string) => Promise<{ readonly proof?: unknown }>

/**
 * A run's outcome, folded from its leaf results: how many passed, how many
 * failed, and how long they took together.
 *
 * It is built one `TestResult` at a time with `addResult`, starting from
 * `zeroTotals`, so a stream of leaf-landed events and a finished totals record
 * are the same information at two moments — which is what lets both runners
 * answer "did the run pass" (`failed !== 0`) from the same fold.
 *
 * `duration` is the *sum* of the folded results' durations. For `fjs t`, which
 * runs leaves sequentially, that is also the run's time and is what its
 * `Time:` line prints. The browser runs leaves concurrently, so the sum stops
 * meaning "how long the run took" there; its wire report keeps its own
 * wall-clock `duration` and takes only the counts from the fold.
 */
export type RunTotals = {
    readonly passed: number
    readonly failed: number
    readonly duration: number
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
export type Reporter<O extends Operation, R = void> = {
    /**
     * A leaf landed. The first argument is the shared {@link TestResult} — the
     * runner builds it with `testResult` before notifying, so a reporter
     * receives the leaf's identity and status rather than deriving its own.
     * The raw `SandboxResult` and the throw expectation travel with it because
     * describing a *thrown value* is each host's part (see {@link TestResult}),
     * and the description needs the value.
     *
     * **It answers `R`, the host's own record of the leaf**, and the traversal
     * keeps those in {@link RunOutcome}. That is how a host gets its results in
     * *structural* order — a parent before the children its return value
     * produced, siblings in declaration order — rather than in the order they
     * happened to finish. The distinction is not academic: leaves run
     * concurrently, so completion order belongs to the scheduler, and a report
     * built from it would be pinning an engine's behaviour rather than the
     * suite's.
     *
     * `fjs t` answers `void`, having already written its line by the time it
     * returns; the browser answers the record its wire report is built from.
     */
    readonly result: (t: TestResult, r: SandboxResult<unknown>, throws: boolean) => Effect<O, R, IoChannel>
    /** The run ended, with the totals folded from every leaf that landed. */
    readonly summary: (totals: RunTotals) => Effect<O, void, IoChannel>
    readonly test: (file: string, path: Path, set: TestEntry) => Effect<O, SandboxResult<unknown>, IoChannel>
}

/**
 * What a run produced: its folded {@link RunTotals}, and every leaf record the
 * reporter answered, in the traversal's own order.
 *
 * The two are not redundant. The totals are a fold and cannot be rebuilt from a
 * list a host chose to leave empty (`fjs t` collects `void`), and the list is
 * ordered by the walk rather than by when each leaf settled.
 */
export type RunOutcome<R> = {
    readonly totals: RunTotals
    readonly results: readonly R[]
}

/**
 * What the walk itself accumulates, before the run answers a {@link RunOutcome}.
 *
 * The records are a `List` rather than an array because joining two arrays
 * copies both: a parent that joined its children's records would recopy every
 * descendant at every level, and the walk would cost more the deeper it went.
 * `concat` on a `List` is one node, and `toArray` walks the whole rope once,
 * at the end.
 *
 * Each record is **boxed**, because a `List` reads a bare array or function in
 * an element position as a sub-list to splice. `R` is the host's own leaf
 * record and this module has no business restricting what it may be, so it
 * never puts one in that position.
 *
 * @internal
 */
export type _RunAcc<R> = {
    readonly totals: RunTotals
    readonly results: List<{ readonly value: R }>
}

/** @internal */
export type _TestAndPath = readonly [Path, TestEntry]
