import { pure } from "../module.f.mjs"
import type { Effect, Operation } from "../types.ts"

export type NonEmpty<O extends Operation, T> = {
    readonly first: T
    readonly tail: List<O, T>
}

/**
 * The payload of a `List` effect: the next cons cell, or `undefined` at
 * end-of-stream.
 *
 * A `List` suspends only where a `Do` node does. `Pure` is a thunk, but that
 * thunk is a discriminator rather than a suspension, and {@link nonEmpty} takes
 * `tail` as an ordinary argument — already evaluated by the time the cell is
 * built. A chain of pure cells is therefore constructed in full, up front;
 * streaming comes from cells produced inside a command's continuation, where
 * the tail is not reached until a runner performs the command.
 *
 * `Effect<O, Next<O, T>>` is used directly in places where `List<O, T>` cannot
 * be written as a return type (see {@link empty}).
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
 * Prepends `first` to a {@link List} `tail`, as a pure cons cell. `tail` is an
 * ordinary argument, so it is built before the cell is — see {@link Next}.
 */
export const nonEmpty =
<O extends Operation, T>(first: T, tail: List<O, T>): Effect<O, Next<O, T>> =>
    pure({ first, tail })
