/**
 * Types for running and reporting FunctionalScript tests.
 *
 * @module
 */

import type { Effect, Operation } from '../effects/types.ts'
import type { IoChannel, SandboxResult } from '../effects/node/types.ts'

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

/** @internal */
export type _TestState = {
    readonly time: number,
    readonly pass: number,
    readonly fail: number,
}

/** @internal */
export type _TestAndPath = readonly [Path, TestEntry]
