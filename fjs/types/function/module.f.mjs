/** @import { Func, Fn } from './types.ts' */

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
