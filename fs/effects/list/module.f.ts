import type { Effect, Operation } from "../module.f.ts"

export type NextEffect<O extends Operation, T> = readonly[T, ListEffect<O, T>] | undefined

export type ListEffect<O extends Operation, T> =
    Effect<O, NextEffect<O, T>>

/**
 * The empty `ListEffect`: a pure end-of-stream marker (`undefined`).
 *
 * Built as an `Effect` object literal rather than through `pure`. `pure` returns
 * `Effect<never, …>`; widening that to an arbitrary operation set `O` is sound (a pure
 * value performs no operations) and the compiler accepts it for a non-recursive
 * payload, but not when the payload recursively mentions `O` — as `ListEffect`'s cons
 * cell does. Writing the literal directly lets the contextual return type drive the
 * check, so the recursive payload type-checks without a cast. Construct streams through
 * these two combinators.
 */
export const listEffectEnd = <O extends Operation, T>(): ListEffect<O, T> => ({
    value: [undefined],
    step: f => f(undefined),
})

/** Prepends `head` to a `ListEffect` `tail`, as a pure cons cell. See {@link listEffectEnd}. */
export const listEffectCons =
<O extends Operation, T>(head: T, tail: ListEffect<O, T>): ListEffect<O, T> => {
    const node: readonly[T, ListEffect<O, T>] = [head, tail]
    return { value: [node], step: f => f(node) }
}
