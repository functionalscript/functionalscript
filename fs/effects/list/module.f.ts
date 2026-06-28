import { pure, type Effect, type Operation } from "../module.f.ts"

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
