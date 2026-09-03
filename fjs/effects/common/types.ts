/**
 * Operations that are nobody's host in particular.
 *
 * `fjs/effects/node` declared these because Node was the only host that ran
 * them. It is not the criterion — an operation belongs to the layer of whoever
 * *implements* it. Declaring them here is what lets a host talk to the shared
 * FunctionalScript logic without importing a module named after a different
 * host.
 *
 * **Three have two implementers**, all three dispatched rather than counted by
 * argument: {@link Sandbox}, {@link Catch} and {@link Import} are answered by
 * the browser page's interpreter as well as by Node's. `Import` arrived when
 * the page's module loading moved into FunctionalScript — its `import()` had
 * been an injected argument, and naming it is what let the walk over it be
 * shared.
 *
 * **{@link All}, {@link Write} and {@link Read} have one implementer**, and are
 * here on the layering argument instead — nothing about them is Node's: a byte stream named
 * by a string is not a filesystem fact. A page renders rows through an
 * operation of its own, which is a *different* operation rather than an
 * implementation of `Write`. `All` is the layering argument by itself: fan-out
 * is what an interpreter does with sibling effects, whoever the host is. The
 * page briefly implemented it, for a loading walk that fanned out
 * (functionalscript#1818); loading is a sequential fold now and the count is
 * back where it was.
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
 * named, so counting by *dispatched commands* missed it — and once it was
 * named, the page dispatched it like any other. The honest question is which
 * capabilities a host needs supplied, not which commands it issues today.
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
 *
 * **What it is worth, measured.** `emergent_testing` reads user values in two
 * places and both used to be able to end a run: a leaf's returned tree
 * (functionalscript#1809) and a thrown value being described
 * (functionalscript#1832). The second was the worse — `fjs t` describes its
 * failures *after* the last leaf, so a value whose `toString` threw killed the
 * report when every test had already run and been announced: no totals, no exit
 * code, from a run that completed. Each is now one failed record and the run
 * goes on. Both read a value a *failing* test produced, which is why they are
 * guarded at all; a module's `proof` export is ordinary FunctionalScript data
 * and is read directly.
 *
 * A value from *another realm* is not what this defends against, and is not
 * supported: `fjs/AGENTS.md`'s "One realm, one prototype chain" puts a promise
 * built in an iframe, a worker or a `node:vm` context outside the language this
 * runner runs. `emergent_testing/todo/imports-promises-realms.md` measures what
 * each detector would answer and why refusing such a value would fail
 * *reachable* proof trees.
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
 *
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2): making it `readonly` is a breaking change a
 * consumer's mutable tuple could fail, tracked and deferred deliberately —
 * see "Six operation tuples are not `readonly`" in
 * `fjs/effects/todo/node-module-layering.md`.
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
 *
 * The tuple itself is a documented exception to the repo-wide `readonly`
 * rule (`fjs/AGENTS.md` §3.2) — see the note on `All` above.
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
