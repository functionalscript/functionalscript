/**
 * Type-level API for the IoEffect layer: `IoEffect`, the fallible effect
 * abstraction whose error channel is explicit, and `NotImplemented`, the error
 * a runner answers with when it cannot dispatch an operation.
 *
 * Stage 1 of the migration is types only — no operation, runner, or consumer
 * produces or consumes an `IoEffect` yet, and `step` / `catchStep` /
 * `resultStep` arrive with the sibling `module.f.mjs` in stage 2. Why the layer
 * exists, why the `Result` sits where it does, and what is deliberately absent:
 * [`./README.md`](./README.md).
 */

import type { Assert } from '../../asserts/types.ts'
import type { Unknown as Json } from '../../media/json/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Do, Effect, Operation, Pure } from '../types.ts'

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
 * An effect with an explicit error channel: the raw {@link Effect} whose result
 * is a {@link Result}.
 *
 * **This is the preferred high-level abstraction for fallible work**, and the
 * raw `Effect<O, T>` is the low-level representation it is built from. Both are
 * public during the migration — `IoEffect` for anything that can fail,
 * `Effect` for the representation and for the raw combinators in
 * [`../module.f.mjs`](../module.f.mjs).
 *
 * `E` carries at least {@link NotImplemented}, and an operation with failures of
 * its own extends the channel — `IoEffect<ReadFile, Vec, NotImplemented |
 * IoError>`. That envelope belongs to the *operation's declared return type*
 * (stage 3), not to a wrapper a constructor puts around a raw operation, so
 * that a runner can eventually deliver `error(notImplemented)` through the
 * ordinary continuation.
 *
 * The alias is transparent, so every raw combinator already applies at this
 * instantiation; what stage 2 adds is the branch-aware vocabulary — `step`
 * propagates an error, `catchStep` recovers from one, `resultStep` observes
 * both. Recovery therefore never needs `try`/`catch`, which FunctionalScript
 * does not offer and whose `throw` stays reserved for panics.
 */
export type IoEffect<O extends Operation, T, E> =
    Effect<O, Result<T, E>>

/** @see {@link _WidensOperations} — a second command to widen the op-set with. */
type _AddOp = readonly['add', (a: number, b: number) => Result<number, NotImplemented>]

type _MulOp = readonly['mul', (a: number, b: number) => Result<number, NotImplemented>]

type _Add = IoEffect<_AddOp, number, NotImplemented>

// The alias is transparent: an `IoEffect` *is* a raw effect whose result is a
// `Result`. Nothing wraps, tags, or hides the representation, which is what
// lets raw `step`, `match`, and `runPure` keep working at this instantiation
// while the branch-aware operations are still being written.
type _Transparent = Assert<Equal<_Add, Effect<_AddOp, Result<number, NotImplemented>>>>

// ...so it is still the two-case union a runner discriminates, with the
// `Result` inside the leaves rather than around them.
type _Cases = Assert<Equal<
    _Add,
    Pure<Result<number, NotImplemented>> | Do<_AddOp, Result<number, NotImplemented>>>>

// The error channel widens, which is what lets `step` union `E | F` instead of
// unifying the two sides: a branch that is passed through stays the very tuple
// it arrived as.
type _WidensError = Assert<_Add extends IoEffect<_AddOp, number, NotImplemented | string> ? true : false>

// ...and it widens in that direction only. A wider channel is not silently
// usable where a narrower one is declared, so an unhandled error type is a
// compile error rather than a value nobody looked at.
type _NarrowsError = Assert<Equal<
    IoEffect<_AddOp, number, NotImplemented | string> extends _Add ? true : false,
    false>>

// The success channel widens too — `catchStep` unions `T | R` for the same
// reason `step` unions the errors.
type _WidensOk = Assert<_Add extends IoEffect<_AddOp, number | string, NotImplemented> ? true : false>

// `Effect`'s covariance in `O` survives the alias, so an effect keeps composing
// with one that requests further commands.
type _WidensOperations = Assert<_Add extends IoEffect<_AddOp | _MulOp, number, NotImplemented> ? true : false>

// `NotImplemented` is JSON data. This is the assert the "command name only"
// rule exists to keep true: an operation's payload may hold functions, and
// admitting one here would fail this line. The dependency is type-only and
// confined to this assert — nothing in the effect system imports the JSON data
// model at runtime.
type _Serializable = Assert<NotImplemented extends Json ? true : false>
