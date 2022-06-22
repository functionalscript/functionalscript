/**
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

/** @type {<T>(value: T) => T} */
const identity = value => value

/** @type {<A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => C} */
const flip = f => b => a => f(a)(b)

module.exports = {
    /** @readonly */
    compare: require('./compare/f.js'),
    /** @readonly */
    operator: require('./operator/f.js'),
    /** @readonly */
    identity,
    /** @readonly */
    compose,
    /** @readonly */
    flip,
}
