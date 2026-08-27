/**
 * Types for running and reporting FunctionalScript tests.
 *
 * @module
 */

import type { Effect, Operation } from '../effects/types.ts'
import type { IoChannel, OpResult, SandboxResult } from '../effects/common/types.ts'

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

/**
 * Receives semantic test-run events. Each method is the runner's notification
 * of an event; the reporter decides how to render it (terminal, GitHub
 * annotations, JSON, node `--test`, etc.). `path` is the chain of object keys
 * leading to the current location; `null` marks a function-call boundary, e.g.
 * `['outer', null, 'inner']` means `outer` was invoked and its return value
 * contained `inner`.
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
export type Reporter<O extends Operation> = {
    readonly result: (file: string, path: Path, r: SandboxResult<unknown>, throws: boolean) => Effect<O, void, IoChannel>
    readonly summary: (pass: number, fail: number, time: number) => Effect<O, void, IoChannel>
    readonly test: (file: string, path: Path, set: TestEntry) => Effect<O, SandboxResult<unknown>, IoChannel>
}

/** How a leaf test ended. */
export type TestStatus = 'passed' | 'failed'

/**
 * One leaf result, normalized: which module it came from, the property chain
 * that names it, how it ended, and how long it took. A failure also carries the
 * message and stack it should be reported by.
 *
 * **It carries no terminal text and no DOM.** This is what a runner *observes*,
 * so every reporter can render it its own way — coloured lines on a TTY, a
 * `::error` annotation on GitHub, a list item in a page — and an automated
 * consumer can read it off the wire. `path` is already rendered by
 * {@link fmtPath} rather than left as a `Path`, because the chain is what a
 * reader identifies the test by and nothing downstream walks it again.
 */
export type TestResult = {
    readonly module: string
    readonly path: string
    readonly status: TestStatus
    readonly duration: number
    readonly message?: string
    readonly stack?: string
}

/**
 * Records one normalized leaf result the moment it lands.
 *
 * It is an *operation* rather than a value threaded through the run because the
 * results arrive concurrently: `all` performs a module's leaves at once, so a
 * read-modify-write over shared memory would interleave and lose them. A
 * runner's handler appends in one step, and {@link Reported} reads the whole
 * sequence back once the run is over.
 */
export type Report = readonly['report', (result: TestResult) => OpResult<void>]

/** Every result {@link Report} has recorded, in the order they landed. */
export type Reported = readonly['reported', () => OpResult<readonly TestResult[]>]

/** The pair of operations a recording runner implements. */
export type ReportOp = Report | Reported

/** @internal */
export type _TestState = {
    readonly time: number,
    readonly pass: number,
    readonly fail: number,
}

/** @internal */
export type _TestAndPath = readonly [Path, TestEntry]
