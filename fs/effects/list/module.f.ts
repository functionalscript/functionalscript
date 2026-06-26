import { pure, type Effect, type Operation } from "../module.f.ts"

export type Next<O extends Operation, T> =
    () => readonly[T, List<O, T>] | undefined

export type List<O extends Operation, T> =
    Effect<O, Next<O, T>>

const none = () => undefined

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * Built as an `Effect` object literal rather than through `pure`. `pure` returns
 * `Effect<never, …>`; widening that to an arbitrary operation set `O` is sound (a pure
 * value performs no operations) and the compiler accepts it for a non-recursive
 * payload, but not when the payload recursively mentions `O` — as `List`'s cons
 * cell does. Writing the literal directly lets the contextual return type drive the
 * check, so the recursive payload type-checks without a cast. Construct streams through
 * these two combinators.
 */
export const end =
<O extends Operation, T>(): Effect<O, Next<O, T>> =>
    pure(none)

/** Prepends `head` to a `ListEffect` `tail`, as a pure cons cell. See {@link end}. */
export const cons =
<O extends Operation, T>(head: T, tail: List<O, T>): Effect<O, Next<O, T>> =>
    pure(() => [head, tail])
