/**
 * Operations that are nobody's host in particular.
 *
 * `fjs/effects/node` declared these because Node was the only host that ran
 * them. It is not the criterion — an operation belongs to the layer of whoever
 * *implements* it. Declaring them here is what lets a host talk to the shared
 * FunctionalScript logic without importing a module named after a different
 * host.
 *
 * **Two implementers today**, and it is worth naming which rather than
 * summarising: {@link Sandbox} and {@link Catch}, both dispatched by the
 * browser page's interpreter as well as by Node's.
 *
 * **Everything else here has one**, and is here on the layering argument
 * instead — nothing about it is Node's. {@link All} is fan-out, which is an
 * interpreter's job whoever the host is. {@link Import} resolves a path
 * against whatever a host resolves paths against, and the browser supplies its
 * `import()` as an argument today rather than dispatching it, which is the
 * measurement trap below. {@link Write} and {@link Read} are byte streams named
 * by a string; a page renders rows through an operation of its own instead,
 * which is a *different* operation and not an implementation of these.
 *
 * Both are good reasons to be in this module. They are not the same reason, and
 * the count is written out because "everything here has two implementers" is
 * the sort of tidy summary that is easier to keep than to keep true.
 *
 * `effects/node` re-exports them all, so a node-side caller keeps one import
 * and signatures keep reading as one vocabulary. That re-export is not a shim:
 * it would be one if it kept a *dead* coupling alive, and `NodeOp` is
 * genuinely declared over these operations.
 *
 * **What counts as a second implementer is easy to measure wrongly**, and
 * `Import` is the case that showed how: a browser page was said to load its
 * modules "through its own importer rather than an `import` operation", which
 * described a callback it was handed. A callback is an operation nobody has
 * named, so counting by *dispatched commands* misses it. The honest question
 * is which capabilities a host needs supplied, not which commands it issues.
 *
 * @module
 */

import type { List as EffectList } from '../../types/list/types.ts'
import type { RequiredMap } from '../../types/object/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Effect, IoResult, OpResult } from '../types.ts'
import type { StringMap } from '../../types/object/types.ts'

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

/**
 * Runs a plain function in an isolated, measured environment.
 *
 * `Awaited<T>` because a handler that can await one does: a thunk answering
 * `Promise<V>` is measured to where it settled and puts `V` in the result. `T`
 * would promise a caller a promise that is not there.
 *
 * **The rule is one line: what is not a well-known `Promise` is not run as
 * one.** `instanceof Promise`, full stop.
 *
 * Stated that way it is also the safe direction, which is why it needs no
 * refinement. A foreign `then` is never invoked to adopt anything: an object
 * this test rejects is ordinary data, walked like any other returned value and
 * called — if it is called at all — as a test inside this sandbox. The shapes a
 * `then` can take stop being a threat model and become a naming question.
 *
 * It is also the *correct* rule here rather than a cheap approximation of a
 * wider one: a proof's returned value carrying a `then` key is a sub-tree with
 * a test called `then` in it, and adopting it instead of walking it would lose
 * the tests inside.
 *
 * `Awaited<T>` describes the case the rule is about. A bare thenable is typed
 * as the value it would resolve to and stored as the object; so is a promise
 * from another realm, which no structural type can tell apart anyway. Neither
 * is worth a conditional type: this operation measures and traps *ordinary*
 * JavaScript, and enumerating `then` shapes is a rabbit hole with no end and no
 * reader.
 */
export type Sandbox = readonly['sandbox', <T>(f: () => T) => OpResult<SandboxResult<Awaited<T>>>]

/**
 * Runs a pure thunk and answers what it did: its value, or the value it threw.
 *
 * It sits beside {@link Sandbox} and is deliberately *not* it. `sandbox` carries
 * a clock and, in the virtual runner, a fixture convention — its handler is a
 * pass-through whose thunk is expected to answer a {@link SandboxResult}
 * directly, because `../node/virtual` is `.f.mjs` and FunctionalScript has no
 * `try`/`catch` to implement a real one with. Routing a tree walk through
 * `sandbox` would hand that handler a thunk answering something else entirely.
 *
 * This one carries neither, so every runner implements it truthfully: the real
 * Node runner and a browser interpreter with `tryCatch`, and the virtual runner
 * with `ok(ok(f()))` — a pure runner still cannot catch, so a hostile fixture
 * still panics there, which is the same bargain `sandbox` already makes.
 *
 * It exists because reading a *user* value is an operation, not pure logic: the
 * proof traversal enumerates values a test returned, and an enumerable getter or
 * a proxy trap in one of them is a failure of that test rather than of the run.
 */
export type Catch = readonly['catch', <T>(f: () => T) => OpResult<Result<T, unknown>>]

// all

/**
 * Runs its effects concurrently and answers each one's whole `Result`.
 *
 * The nesting is deliberate and belongs to the runner: this envelope says
 * whether `all` itself could be dispatched, and each inner `Result` is what
 * that effect answered. `allOk` (`./module.f.mjs`) is the collapse a fallible
 * chain wants.
 *
 * **Fan-out is an interpreter's job, not a walk's.** A host that has
 * concurrency implements this and keeps it; a host that does not answers the
 * effects in turn, and the shared logic above reads the same either way. That
 * is why it sits here rather than in a module named after one host — and it is
 * the whole reason: unlike its neighbours here, this operation has one
 * implementer today, the Node runners and the registration path they serve.
 * Nothing in a browser dispatches it yet.
 */
export type All = ['all', <T, E>(...effects: Effect<never, T, E>[]) => OpResult<readonly Result<T, E>[]>]

// import

/** A loaded module: its exported names, as values. */
export type Module = StringMap<unknown>

/**
 * Loads a module by path and answers its exports.
 *
 * Node resolves the path against the filesystem and a browser page resolves it
 * against its own document, but *what the operation means* is one thing in both:
 * hand back what that module exports, or say why it could not. Which is the
 * criterion — an operation belongs to the layer of whoever implements it, and
 * this one has two implementers.
 *
 * It answers an `IoResult` rather than an `OpResult` because loading genuinely
 * fails: a module that will not parse, a path that resolves to nothing, a
 * network that dropped. A caller that must report such a failure rather than
 * die needs the reason as a value, which is what the error channel carries.
 */
export type Import = ['import', (path: string) => IoResult<Module>]

// write

/** Named output streams accepted by the `Write` effect. */
export type WriteConsoles = 'stdout' | 'stderr'

/**
 * Raw byte write to a named output stream. Encoding-agnostic — callers supply
 * a `Vec`. The Node runner maps each stream name to the appropriate fd and
 * delegates to the OS via `stream.write()` with backpressure handling.
 */
export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => OpResult<void>]

export type Console = (s: string) => Effect<Write, void>

/**
 * What each output stream is known to be at startup — today, whether it is a
 * TTY.
 *
 * Named, rather than spelled inline where it is used, because two unrelated
 * layers have to agree on it: a host fills it in, and `text/sgr`'s `csiWrite`
 * reads it to decide whether ANSI sequences survive. Spelling it at both ends
 * made the *whole* of a node program's options the argument a pure formatter
 * had to take, which is how an ANSI helper came to name a host.
 */
export type Std = RequiredMap<WriteConsoles, { readonly isTTY: boolean }>

// read

/** Named input streams accepted by the `Read` effect. */
export type ReadConsoles = 'stdin'

/**
 * Reads a single byte from a named input stream — the byte-granular dual of
 * `write`. Resolves to the byte value (`0`–`255`) or `null` at end of
 * input (EOF). One byte at a time: the effect carries no buffering or line
 * policy, so higher-level framing (see `readLine`) lives in pure code
 * rather than the interpreter. Back-pressure is naturally sequential — the next
 * `read` is only issued once the previous byte is consumed.
 */
export type Read = readonly['read', (stream: ReadConsoles) => OpResult<number | null>]

/** @internal */
export type _UtfList = EffectList<number>
