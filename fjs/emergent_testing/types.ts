/**
 * Types for running and reporting FunctionalScript tests.
 *
 * @module
 */

import type { Operation } from '../effects/types.ts'
import type { Effect } from '../effects/io/types.ts'
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
 * the hazard the Io layer exists to remove, and a `void` return position hides
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
