/**
 * Type-level API for the Effect layer: `Effect`, the fallible effect
 * abstraction whose error channel is explicit, and `NotImplemented`, the error
 * a runner answers with when it cannot dispatch an operation.
 *
 * The composition API — `step`, `catchStep`, `resultStep`, the two lifts, and
 * `mapStep` — is the sibling [`./module.f.mjs`](./module.f.mjs), whose
 * signatures the asserts at the bottom of this file pin. Why the layer exists,
 * why the `Result` sits where it does, and what is deliberately absent:
 * [`./README.md`](./README.md).
 */

import type { Assert } from '../../asserts/types.ts'
import type { Unknown as Json } from '../../media/json/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Do, RawEffect, Operation, Pure } from '../types.ts'
import type { catchStep, mapStep, resultStep, step, unwrapStep } from './module.f.mjs'

/**
 * The runner cannot dispatch this operation and has **not** started it.
 *
 * It is ordinary recoverable effect data rather than a fatal runner condition:
 * the program receives control back and decides what an incompatible runner
 * means for it — recover, choose a fallback operation, or treat it as fatal and
 * panic itself (`throw`, e.g. via `unwrap`). Escalation belongs to the program,
 * so the missing-handler path answers with `error(notImplemented)` rather than
 * panicking on the program's behalf.
 *
 * **It identifies the operation by command name only.** An operation's payload
 * may hold functions — `createServer`'s listener, `sandbox`'s thunk, `test`'s
 * body — so carrying it would break the serializability this file's asserts
 * pin against the JSON data model.
 *
 * **It is not a security boundary.** A runner keeps its authority over
 * execution through a separate, out-of-band mechanism: it may interrupt or
 * terminate a program that is malicious, over budget, or violating host policy,
 * and nothing in the error channel obliges it to hand control back. A
 * capability the runner merely lacks is answered with this error; a refusal to
 * continue is an interruption, never dressed up as `NotImplemented`.
 */
export type NotImplemented = readonly['notImplemented', string]

/**
 * An effect with an explicit error channel: the raw {@link RawEffect} whose result
 * is a {@link Result}.
 *
 * **This is the effect abstraction to reach for**, and `RawEffect<O, T>`
 * ([`../types.ts`](../types.ts)) is the representation it is built from. Both
 * names are public, and the division between them is not "fallible" against
 * "infallible" — it is *composition* against *representation*.
 *
 * **Prefer this over a `Result`-valued `RawEffect`, and prefer it even where
 * nothing fails yet.** The two spellings are the same type, so the choice costs
 * nothing today and is not free later. Every effect holding a {@link Do} node is
 * dispatched by a runner that may decline the command (`partialMatch`), so an
 * infallible effect states something about today's implementation rather than
 * about the computation. When that changes, widening `Effect<O, T, never>` to
 * `Effect<O, T, E>` leaves every consumer that merely chains untouched —
 * {@link step} is generic in the channel and unions it, so a continuation still
 * sees only the `ok` value — and errors at exactly the sites that declared the
 * effect infallible. Widening a `RawEffect<O, T>` instead rewrites every
 * consumer *body*, because the raw `step`'s continuation goes from receiving
 * `T` to receiving `Result<T, E>`.
 *
 * The channel is where **short-circuiting** lives, not specifically where a
 * runner's refusal lives. A parse failure, a domain verdict, or a non-zero exit
 * code belongs in it for the same reason {@link NotImplemented} does: `step`
 * should stop the chain and carry it out. `RawEffect` is for the representation
 * itself — `Pure`, `Do`, the runners, `match`, `runPure`, and what
 * `unwrapStep` hands back.
 *
 * **`E` defaults to {@link NotImplemented}**, the one error every operation can
 * answer with, so the common case is written `Effect<Sandbox, T>`. The default
 * is safe to have *now* and was not safe to have during the rename: while every
 * site had to name its channel explicitly, an infallible computation left as
 * `Effect<O, T>` was a compile error rather than a silent acquisition of an
 * error channel it never wanted.
 *
 * An operation's own failures extend the channel — `Effect<ReadFile, Vec,
 * IoChannel>`, that alias being the node standard of
 * `NotImplemented | IoError`. The envelope belongs to the *operation's declared return type*,
 * not to a wrapper a constructor puts around a raw operation, so that a runner
 * can deliver `error(notImplemented)` through the ordinary continuation.
 *
 * The alias is transparent, so every raw combinator already applies at this
 * instantiation. What the sibling module adds is the branch-aware vocabulary —
 * `step` propagates an error, `catchStep` recovers from one, `resultStep`
 * observes both. Recovery therefore never needs `try`/`catch`, which
 * FunctionalScript does not offer and whose `throw` stays reserved for panics.
 */
export type Effect<O extends Operation, T, E = NotImplemented> =
    RawEffect<O, Result<T, E>>

/** @see {@link _WidensOperations} — a second command to widen the op-set with. */
type _AddOp = readonly['add', (a: number, b: number) => Result<number, NotImplemented>]

type _MulOp = readonly['mul', (a: number, b: number) => Result<number, NotImplemented>]

type _Add = Effect<_AddOp, number, NotImplemented>

// The alias is transparent: an `Effect` *is* a raw effect whose result is a
// `Result`. Nothing wraps, tags, or hides the representation, which is what
// lets raw `step`, `match`, and `runPure` keep working at this instantiation
// while the branch-aware operations are still being written.
type _Transparent = Assert<Equal<_Add, RawEffect<_AddOp, Result<number, NotImplemented>>>>

// ...so it is still the two-case union a runner discriminates, with the
// `Result` inside the leaves rather than around them.
type _Cases = Assert<Equal<
    _Add,
    Pure<Result<number, NotImplemented>> | Do<_AddOp, Result<number, NotImplemented>>>>

// The error channel widens, which is what lets `step` union `E | F` instead of
// unifying the two sides: a branch that is passed through stays the very tuple
// it arrived as.
type _WidensError = Assert<_Add extends Effect<_AddOp, number, NotImplemented | string> ? true : false>

// ...and it widens in that direction only. A wider channel is not silently
// usable where a narrower one is declared, so an unhandled error type is a
// compile error rather than a value nobody looked at.
type _NarrowsError = Assert<Equal<
    Effect<_AddOp, number, NotImplemented | string> extends _Add ? true : false,
    false>>

// The success channel widens too — `catchStep` unions `T | R` for the same
// reason `step` unions the errors.
type _WidensOk = Assert<_Add extends Effect<_AddOp, number | string, NotImplemented> ? true : false>

// `RawEffect`'s covariance in `O` survives the alias, so an effect keeps composing
// with one that requests further commands.
type _WidensOperations = Assert<_Add extends Effect<_AddOp | _MulOp, number, NotImplemented> ? true : false>

// The composition signatures, checked rather than merely declared. The union
// rules are the subtle part of this layer — a "simplification" that unified an
// error channel instead of unioning it would still compile at the definition
// and fail only at some future call site, so each is pinned at a concrete
// instantiation here.
//
// `step` unions the operation sets and the errors, and replaces the success
// type with the continuation's.
type _StepSig = Assert<Equal<
    ReturnType<typeof step<_AddOp, number, NotImplemented, _MulOp, string, string>>,
    Effect<_AddOp | _MulOp, string, NotImplemented | string>>>

// `catchStep` mirrors it: the success channel is the union of the preserved
// value and the recovery's, and the error type is the recovery's alone —
// `never` when every error is handled.
type _CatchStepSig = Assert<Equal<
    ReturnType<typeof catchStep<_AddOp, number, NotImplemented, _MulOp, string, never>>,
    Effect<_AddOp | _MulOp, number | string, never>>>

// `resultStep` consumes both branches, so it replaces both channels and unions
// only the operation sets.
type _ResultStepSig = Assert<Equal<
    ReturnType<typeof resultStep<_AddOp, number, NotImplemented, _MulOp, string, string>>,
    Effect<_AddOp | _MulOp, string, string>>>

// `mapStep` widens nothing: a pure projection issues no commands and cannot
// fail, so only the success type changes.
type _MapStepSig = Assert<Equal<
    ReturnType<typeof mapStep<_AddOp, number, NotImplemented, string>>,
    Effect<_AddOp, string, NotImplemented>>>

// `unwrapStep` leaves the layer by panicking, so its result carries the bare
// value rather than a `Result`.
type _UnwrapStepSig = Assert<Equal<
    ReturnType<typeof unwrapStep<_AddOp, number, NotImplemented>>,
    RawEffect<_AddOp, number>>>

// ...and the renderer it takes is what stops that panic from quietly growing.
// A summary written for one channel is *not* usable where a wider channel's
// summary is required — parameters are contravariant — so adding a failure
// upstream breaks the site that chose to panic instead of silently enlarging
// what it crashes on. This is the assert that makes the argument checkable:
// were it to pass, `unwrapStep` would be back to absorbing anything.
type _Summary<E> = Parameters<typeof unwrapStep<_AddOp, number, E>>[1]

type _UnwrapStepPinsItsChannel = Assert<Equal<
    _Summary<NotImplemented> extends _Summary<NotImplemented | string> ? true : false,
    false>>

// `NotImplemented` is JSON data. This is the assert the "command name only"
// rule exists to keep true: an operation's payload may hold functions, and
// admitting one here would fail this line. The dependency is type-only and
// confined to this assert — nothing in the effect system imports the JSON data
// model at runtime.
type _Serializable = Assert<NotImplemented extends Json ? true : false>
