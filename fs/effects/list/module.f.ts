/**
 * Effectful lists: lazy streams whose every cons cell is an `Effect`, plus the
 * combinators to build ({@link empty}, {@link nonEmpty}) and consume
 * ({@link foldStream}) them.
 *
 * @module
 */
import { okStep, pure, type Effect, type Operation } from "../module.f.ts"
import { error, ok, type Result } from "../../types/result/module.f.ts"

export type NonEmpty<O extends Operation, T> = {
    readonly first: T
    readonly tail: List<O, T>
}

/**
 * The payload of a `List` effect: the next cons cell, or `undefined` at
 * end-of-stream.
 *
 * Since `Pure<T>` is now itself a lazy thunk (`() => T`), the effect alone is the
 * suspension point and the cell needs no extra wrapping thunk. `Effect<O, Next<O, T>>`
 * is used directly in places where `List<O, T>` cannot be written as a return type
 * (see {@link empty}).
 */
export type Next<O extends Operation, T> =
    NonEmpty<O, T> | undefined

export type List<O extends Operation, T> =
    Effect<O, Next<O, T>>

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `Effect<O, Next<O, T>>` return type lets the contextual type drive the
 * check, so the recursive payload type-checks without a cast. Construct streams through
 * these two combinators.
 *
 * Note: we use `Effect<O, Next<O, T>>` because TypeScript can't convert `pure(...)` to
 *       `List<O, T>`.
 */
export const empty =
<O extends Operation, T>(): Effect<O, Next<O, T>> =>
    pure(undefined)

/**
 * Prepends `head` to a `ListEffect` `tail`, as a pure cons cell. See {@link empty}.
 */
export const nonEmpty =
<O extends Operation, T>(first: T, tail: List<O, T>): Effect<O, Next<O, T>> =>
    pure({ first, tail })

/**
 * Folds a stream of `Result` items into a single `Result`, encoding the
 * stream-protocol invariant once: end-of-stream finalizes as `ok` of the
 * accumulator, an `error` item propagates unchanged, and an `ok` chunk is
 * folded by `step`, recursing on `ok` and short-circuiting on `error`.
 *
 * `step` is a Kleisli function of the {@link okStep} shape — it returns an
 * `Effect` — so the combinator subsumes both pure folds
 * (`step = acc => chunk => pure(ok(…))`) and effectful consumers whose
 * per-chunk step performs operations (e.g. positional writes).
 *
 * The stream's operations `O` and the step's operations `SO` are separate
 * type parameters, united only in the result, so a step carrying its own
 * operations can fold a stream that knows nothing about them.
 *
 * Not every consumer fits: the error arms discard the accumulator, so a fold
 * whose error handling needs in-flight accumulator state (e.g. a staging path
 * to delete on failure) must keep its hand-written loop.
 */
export const foldStream =
    <SO extends Operation, I, A>(step: (acc: A) => (chunk: I) => Effect<SO, Result<A, unknown>>) =>
    (init: A) =>
    <O extends Operation>(stream: List<O, Result<I, unknown>>): Effect<O | SO, Result<A, unknown>> =>
        stream.step((node): Effect<O | SO, Result<A, unknown>> => {
            if (node === undefined) { return pure(ok(init)) }
            const { first, tail } = node
            const [t, v] = first
            if (t === 'error') { return pure(error(v)) }
            return step(init)(v).step(okStep((acc: A) => foldStream(step)(acc)(tail)))
        })
