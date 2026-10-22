/**
 * Function combinators: composition, identity, sequential iteration, the
 * fixpoint of a step, argument flipping, and the chainable `Fn` wrapper.
 *
 * @module
 *
 * @import { Func, Fn } from './types.ts'
 */

/**
 * A postfix compose function.
 *
 * @type {<I, X>(g: Func<I, X>) => <O>(f: Func<X, O>) => Func<I, O>}
 */
export const compose = g => f => x => f(g(x))

/**
 * A generic identity function.
 *
 * @type {<T>(value: T) => T}
 */
export const identity = value => value

/**
 * Applies `f` to `value` `n` times sequentially.
 *
 * Unlike monoid `repeat`, this performs every application, taking O(n)
 * applications. Balanced recursion uses O(log n) stack frames for positive
 * `n`. A non-positive `n` leaves `value` unchanged.
 *
 * @type {(n: bigint) => <T>(value: T) => (f: (value: T) => T) => T}
 */
export const iterate = n => value => f => {
    if (n <= 0n) { return value }
    if (n === 1n) { return f(value) }
    const half = iterate(n / 2n)
    const result = half(half(value)(f))(f)
    return n % 2n === 0n ? result : f(result)
}

/**
 * Relaxes `start` one round at a time until a round's result is `same` as
 * what it was given, and answers that result.
 *
 * A loop rather than a recursion: a chain of facts each waiting on the next
 * advances one per round, so the rounds can be many, and a recursion that
 * deep is a stack overflow on a few thousand.
 *
 * `same` is the caller's, because only the caller knows its values: `===`
 * decides a primitive, but a round that rebuilds an array rebuilds it even
 * when its contents stop changing, and `===` would never see that round as
 * the last.
 *
 * @type {<T>(step: (value: T) => T, same: (a: T, b: T) => boolean) => (start: T) => T}
 */
export const fixpoint = (step, same) => start => {
    let s = { current: start, next: step(start) }
    while (!same(s.next, s.current)) { s = { current: s.next, next: step(s.next) }; }
    return s.next
}

/**
 * Flips the arguments of a curried function.
 *
 * @type {<A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => C}
 */
export const flip = f => b => a => f(a)(b)

/**
 * Creates an `Fn` instance from a function, enabling chaining of transformations.
 *
 * @type {<I, O>(result: Func<I, O>) => Fn<I, O>}
 */
export const fn = result => ({
    result,
    map: g => fn(compose(result)(g))
})
