// @ts-self-types="./module.f.d.mts"

/**
 * A generic function type.
 *
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func
 */

/**
 * A postfix compose function.
 *
 * @type {<I, X>(g: Func<I, X>) => <O>(f: Func<X, O>) => Func<I, O>}
 */
const compose = g => f => x => f(g(x))

/**
 * A generic identity function.
 *
 * @type {<T>(value: T) => T}
 */
const identity = value => value

/**
 * Flips the arguments of a curried function.
 *
 * @type {<A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => C}
 */
const flip = f => b => a => f(a)(b)

/**
 * A functional utility type that enables seamless chaining of transformations.
 *
 * @template I,O
 * @typedef {{
 *  readonly result: Func<I, O>
 *  readonly then: <T>(g: Func<O, T>) => Fn<I, T>
 * }} Fn
 */

/**
 * Creates an `Fn` instance from a function, enabling chaining of transformations.
 *
 * @type {<I, O>(f: (i: I) => O) => Fn<I, O>}
 *
 * @example
 * const add2 = (x) => x + 2; // Adds 2
 * const multiply3 = (x) => x * 3; // Multiplies by 3
 *
 * // Chain transformations
 * const add2multiply3 = fn(add2).then(multiply3).result;
 * const result = add2multiply3(5); // result is 21. (5 + 2) * 3.
 */
const fn = result => ({
    result,
    then: g => fn(compose(result)(g))
})

export default {
    /** @readonly */
    identity,
    /** @readonly */
    compose,
    /** @readonly */
    flip,
    /** @readonly */
    fn,
}
