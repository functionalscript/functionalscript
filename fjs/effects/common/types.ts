/**
 * Types for the operations no host owns.
 *
 * Every operation declared here describes something a JavaScript realm can do
 * on its own — hold a value, wait for a promise, measure a call, link a module,
 * fetch a URL — so a Node runner, a browser runner, and the virtual runner can
 * each implement the same command with the same contract. What is genuinely
 * Node's — streams, the filesystem, subprocesses, an external test framework —
 * stays in [`../node/types.ts`](../node/types.ts), which re-exports these so an
 * existing importer keeps naming one module.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'
import type { Effect, NotImplemented } from '../types.ts'
import type { Result } from '../../types/result/types.ts'
import type { StringMap } from '../../types/object/types.ts'

/**
 * A host failure, normalized: whatever the runtime threw reduced to a
 * serializable record. `code` is the OS error code when the host supplied one
 * (`'ENOENT'`, `'EEXIST'`), absent otherwise.
 *
 * It is a tagged tuple for the same reason {@link NotImplemented} is — the two
 * share an error channel, and the tag is what tells them apart. That
 * distinction is the whole reason this type exists: with a bare `unknown`
 * error, `NotImplemented | unknown` collapses to `unknown` and a program can no
 * longer tell "this runner cannot do it" from "the host tried and failed".
 *
 * Normalizing also keeps the channel serializable. A thrown `Error` carries a
 * stack, a `cause`, and arbitrary own properties; none of it survives a wire
 * hop, and a runner in another process could not reproduce it.
 */
export type IoError = readonly['ioError', IoErrorInfo]

export type IoErrorInfo = {
    readonly code?: string
    readonly message: string
}

/**
 * The result of an operation with no failures of its own: it either produces
 * its value or reports that the runner does not implement it.
 *
 * Every operation's return type is a `Result`, including the ones that cannot
 * fail on their own terms — an operation left on a raw contract would be a hole
 * in the error channel, and a runner may omit a handler for any of them.
 */
export type OpResult<T> = Result<T, NotImplemented>

/**
 * The error channel of anything that performs host IO: a normalized host
 * failure, or the report that the runner does not implement the operation.
 *
 * It is one name rather than a union spelled at each site, and that is a
 * migration property rather than brevity. An effect that does no IO *yet* is
 * one added `readFile` away from doing some, and if each signature names its
 * own errors, that one change walks up every enclosing signature — the failure
 * mode that sank `throws` clauses elsewhere, where engineers eventually
 * declared everything throwing rather than maintain the cascade. Declaring the
 * standard channel once is that concession made deliberately: an IO-touching
 * effect says it fails *the way node IO fails*, and gaining a new way to do so
 * changes nothing above it.
 *
 * It is not a licence to widen. An operation with failures of its own extends
 * the channel (`IoChannel | ParseError`), and a computation whose errors are
 * genuinely narrower should say so — this is the default for IO, not a ceiling.
 */
export type IoChannel = NotImplemented | IoError

/**
 * The result of an operation that performs host IO: its value, a normalized
 * host failure, or the missing-handler report.
 */
export type IoResult<T> = Result<T, IoChannel>

// all

/**
 * Runs its effects concurrently and answers each one's whole `Result`.
 *
 * The nesting is deliberate and belongs to the runner: this envelope says
 * whether `all` itself could be dispatched, and each inner `Result` is what
 * that effect answered. `allOk` (`./module.f.mjs`) is the collapse a fallible
 * chain wants.
 */
export type All = ['all', <T, E>(...effects: Effect<never, T, E>[]) => OpResult<readonly Result<T, E>[]>]

// fetch

export type Fetch = ['fetch', (url: string) => IoResult<Vec>]

// import

export type Module = StringMap<unknown>

export type Import = ['import', (path: string) => IoResult<Module>]

// now

export type Now = readonly['now', () => OpResult<number>]

// sandbox

/**
 * The outcome of a `Sandbox` operation.
 *
 * `result` carries either `['ok', value]` or `['error', thrown]`. `duration`
 * is a floating-point millisecond count with up to microsecond precision,
 * matching `performance.now()` directly. Additional fields (allocated memory,
 * max stack depth, coverage) may be added in future without breaking consumers.
 */
export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    /**
     * Elapsed time in milliseconds (microsecond precision via `performance.now()`).
     * The virtual runner returns `0` for deterministic tests.
     */
    readonly duration: number
}

export type Sandbox = readonly['sandbox', <T>(f: () => T) => OpResult<SandboxResult<T>>]

/**
 * Resolves the return value of a test function inside the effect runner.
 * If `p` is a real `Promise`, it is awaited and rejections propagate as
 * throws. If `p` is any other value it is returned as-is. Plain thenables
 * (objects with a `.then` method that are not `instanceof Promise`) are
 * treated as ordinary values — not awaited. See `fjs/dev/tf/README.md`.
 */
export type Await = readonly['await', (p: unknown) => OpResult<readonly[unknown]>]

/**
 * The operations every runner is expected to be able to implement.
 *
 * A host runner's operation set is this union plus whatever its host adds:
 * `NodeOp` is `CommonOp | MemOp | Fs | Http | …`, and the browser interpreter
 * in [`../browser/module.mjs`](../browser/module.mjs) implements exactly this
 * set against the browser realm. Naming it once is what lets a program say it
 * needs nothing host-specific, and be run by either.
 */
export type CommonOp = All | Await | Fetch | Import | Now | Sandbox
