/**
 * Function combinators: composition, identity, sequential iteration, argument
 * flipping, and the chainable `Fn` wrapper.
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
 * applications. A non-positive `n` leaves `value` unchanged.
 *
 * @type {(n: bigint) => <T>(value: T) => (f: (value: T) => T) => T}
 */
export const iterate = n => value => f => {
    let v = value
    let i = 0n
    while (i < n) {
        v = f(v)
        i = i + 1n
    }
    return v
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
