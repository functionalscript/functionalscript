/**
 * The composition layer's contract, checked rather than merely declared.
 *
 * The `Effect` type itself now lives in [`../types.ts`](../types.ts): the error
 * channel is part of the representation, not a wrapper this directory puts
 * around it. What remains here is the sibling of
 * [`./module.f.mjs`](./module.f.mjs) — the asserts that pin every combinator's
 * signature at a concrete instantiation, and the widening rules the layer rests
 * on. Why the channel exists and what is deliberately absent:
 * [`./README.md`](./README.md).
 *
 * The union rules are the subtle part. A "simplification" that unified an error
 * channel instead of unioning it would still compile at the definition and fail
 * only at some future call site, so each rule is written down as a check here.
 */

import type { Assert } from '../../asserts/types.ts'
import type { Unknown as Json } from '../../media/json/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Do, Effect, NotImplemented, Pure } from '../types.ts'
import type {
    catchStep, mapStep, resultMapStep, resultStep, step, unwrapStep,
} from './module.f.mjs'

/** @see {@link _WidensOperations} — a second command to widen the op-set with. */
type _AddOp = readonly['add', (a: number, b: number) => Result<number, NotImplemented>]

type _MulOp = readonly['mul', (a: number, b: number) => Result<number, NotImplemented>]

type _Add = Effect<_AddOp, number, NotImplemented>

// The representation *is* the two-case union a runner discriminates, with the
// `Result` inside the leaves rather than around them. This used to be two
// asserts — one that `Effect` was a transparent alias for a payload-generic
// `RawEffect`, and one naming the cases underneath. There is one type now, so
// there is one assert.
type _Cases = Assert<Equal<
    _Add,
    Pure<number, NotImplemented> | Do<_AddOp, number, NotImplemented>>>

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

// Covariance in `O` survives the channel becoming primitive, so an effect keeps
// composing with one that requests further commands.
type _WidensOperations = Assert<_Add extends Effect<_AddOp | _MulOp, number, NotImplemented> ? true : false>

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
    Effect<_AddOp | _MulOp, string | number, never>>>

// `resultStep` consumes both branches, so it replaces both channels and unions
// only the operation sets. It is the layer's primitive — `step` and `catchStep`
// are it with a tag test in front — so this signature is the one the other two
// are derived from rather than a third variant beside them.
type _ResultStepSig = Assert<Equal<
    ReturnType<typeof resultStep<_AddOp, number, NotImplemented, _MulOp, string, string>>,
    Effect<_AddOp | _MulOp, string, string>>>

// `mapStep` widens nothing: a pure projection issues no commands and cannot
// fail, so only the success type changes.
type _MapStepSig = Assert<Equal<
    ReturnType<typeof mapStep<_AddOp, number, NotImplemented, string>>,
    Effect<_AddOp, string, NotImplemented>>>

// `resultMapStep` is the both-branches projection, so it replaces the error
// channel as well — this is the assert that says a caller may discard errors
// here, which is the whole reason the name is separate from `mapStep`'s.
type _ResultMapStepSig = Assert<Equal<
    ReturnType<typeof resultMapStep<_AddOp, number, NotImplemented, Result<string, string>>>,
    Effect<_AddOp, string, string>>>

// ...and a projection that only ever answers `ok` empties the channel rather
// than acquiring one. Reading the two halves off `f`'s concrete return type is
// what makes this line pass; matching `Result<R, F>` directly would infer `F`
// from the `ok` payload.
type _ResultMapStepEmpties = Assert<Equal<
    ReturnType<typeof resultMapStep<_AddOp, number, NotImplemented, readonly['ok', string]>>,
    Effect<_AddOp, string, never>>>

// `unwrapStep` panics on the error branch, so what it hands back is an effect
// whose channel is empty — `never` earned by the throw rather than asserted.
type _UnwrapStepSig = Assert<Equal<
    ReturnType<typeof unwrapStep<_AddOp, number, NotImplemented>>,
    Effect<_AddOp, number, never>>>

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
