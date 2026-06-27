import { pure, type Effect, type Operation } from "../module.f.ts"

export type NonEmpty<O extends Operation, T> = {
    readonly first: T
    readonly tail: List<O, T>
}

export type List<O extends Operation, T> =
    Effect<O, NonEmpty<O, T> | undefined>

/**
 * The empty `List`: a pure end-of-stream marker (`undefined`).
 *
 * Since `Pure<T>` is now itself a lazy thunk (`() => T`), the effect alone is the
 * suspension point and the cons cell needs no extra wrapping thunk — the list's
 * payload is the cell (or `undefined`) directly. The explicit return type lets the
 * contextual type drive the check, so the recursive payload type-checks without a
 * cast. Construct streams through these two combinators.
 */
export const empty =
<O extends Operation, T>(): Effect<O, NonEmpty<O, T> | undefined> =>
    pure(undefined)

/**
 * Prepends `head` to a `ListEffect` `tail`, as a pure cons cell. See {@link empty}.
 */
export const nonEmpty =
<O extends Operation, T>(first: T, tail: List<O, T>): Effect<O, NonEmpty<O, T> | undefined> =>
    pure({ first, tail })


